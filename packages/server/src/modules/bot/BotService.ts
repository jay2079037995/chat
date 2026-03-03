import crypto from 'crypto';
import Redis from 'ioredis';
import type { Message, BotUpdate, LLMConfig, BotRunMode, BotStatus, LLMCallLog } from '@chat/shared';
import { generateId } from '@chat/shared';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import { getRedisClient } from '../../repositories/redis/RedisClient';
import { config } from '../../config';
import { encryptApiKey, decryptApiKey, maskApiKey } from './CryptoUtils';

const BOT_UPDATES_KEY = (botId: string) => `bot_updates:${botId}`;
const BOT_UPDATE_SEQ_KEY = (botId: string) => `bot_update_seq:${botId}`;
const BOT_CONFIG_KEY = (botId: string) => `bot_config:${botId}`;
const BOT_CONV_HISTORY_KEY = (botId: string, convId: string) => `bot_conv_history:${botId}:${convId}`;
const BOT_LLM_LOGS_KEY = (botId: string) => `bot_llm_logs:${botId}`;
const SERVER_BOTS_KEY = 'server_bots';

/** 每个 Bot 最多保留的日志条数 */
const MAX_LLM_LOGS = 100;
/** 日志 TTL（7 天） */
const LLM_LOGS_TTL = 7 * 24 * 60 * 60;

/**
 * 机器人服务
 *
 * 处理机器人创建/删除、消息队列入队/出队、机器人发消息等核心逻辑。
 * 注意：BLPOP 是阻塞命令，会独占 Redis 连接，因此使用独立连接。
 */
export class BotService {
  /** 专用于 BLPOP 的独立 Redis 连接（避免阻塞主连接） */
  private blockingRedis: Redis;

  constructor(
    private userRepo: IUserRepository,
    private messageRepo: IMessageRepository,
  ) {
    this.blockingRedis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
    });
  }

  /** 创建机器人 */
  async createBot(
    ownerId: string,
    username: string,
    runMode: BotRunMode = 'client',
    llmConfig?: LLMConfig,
  ) {
    // 机器人用户名必须以 bot 结尾
    if (!username.toLowerCase().endsWith('bot')) {
      throw new Error('BOT_NAME_INVALID');
    }

    // 服务端模式必须提供 LLM 配置
    if (runMode === 'server' && !llmConfig) {
      throw new Error('SERVER_MODE_REQUIRES_LLM_CONFIG');
    }

    // 检查用户名是否已存在
    const existing = await this.userRepo.findByUsername(username);
    if (existing) throw new Error('USERNAME_TAKEN');

    const id = generateId();
    const token = crypto.randomBytes(32).toString('hex');

    const user = await this.userRepo.createBot({ id, username, token, ownerId });

    // 设置运行模式
    const redis = getRedisClient();
    await redis.hset(`user:${id}`, 'runMode', runMode);

    if (runMode === 'server' && llmConfig) {
      await this.saveServerBotConfig(id, llmConfig);
      await redis.sadd(SERVER_BOTS_KEY, id);
      await this.setBotStatus(id, 'stopped');
    }

    return { ...user, token, runMode };
  }

  /** 获取某用户拥有的机器人列表 */
  async listBots(ownerId: string) {
    return this.userRepo.getBotsByOwner(ownerId);
  }

  /** 删除机器人（需校验所有权） */
  async deleteBot(botId: string, requesterId: string) {
    const bot = await this.userRepo.findById(botId);
    if (!bot || !bot.isBot) throw new Error('BOT_NOT_FOUND');
    if (bot.botOwnerId !== requesterId) throw new Error('FORBIDDEN');

    // 清理服务端模式相关数据
    const redis = getRedisClient();
    const runMode = await this.getBotRunMode(botId);
    if (runMode === 'server') {
      await redis.del(BOT_CONFIG_KEY(botId));
      await redis.srem(SERVER_BOTS_KEY, botId);
      // 清理所有对话历史
      const historyKeys = await redis.keys(`bot_conv_history:${botId}:*`);
      if (historyKeys.length > 0) {
        await redis.del(...historyKeys);
      }
      // 清理 LLM 调用日志
      await redis.del(BOT_LLM_LOGS_KEY(botId));
      // 清理 Skill 权限
      await redis.del(`bot_skills:${botId}`);
    }

    await this.userRepo.deleteBot(botId);
  }

  /** 将消息入队到机器人的更新队列 */
  async enqueueUpdate(botId: string, message: Message, conversationId: string) {
    const redis = getRedisClient();
    const updateId = await redis.incr(BOT_UPDATE_SEQ_KEY(botId));
    const update: BotUpdate = { updateId, message, conversationId };
    await redis.rpush(BOT_UPDATES_KEY(botId), JSON.stringify(update));
  }

  /** 长轮询获取机器人消息更新 */
  async getUpdates(token: string, timeout: number = 30): Promise<BotUpdate[]> {
    const botId = await this.userRepo.findBotByToken(token);
    if (!botId) throw new Error('INVALID_TOKEN');

    // 使用独立连接执行 BLPOP，避免阻塞主 Redis 连接
    const result = await this.blockingRedis.blpop(BOT_UPDATES_KEY(botId), timeout);
    if (!result) return [];

    // BLPOP 返回 [key, value]
    const updates: BotUpdate[] = [JSON.parse(result[1])];

    // 取出队列中剩余的（非阻塞，用主连接即可）
    const redis = getRedisClient();
    let item: string | null;
    // eslint-disable-next-line no-cond-assign
    while ((item = await redis.lpop(BOT_UPDATES_KEY(botId))) !== null) {
      updates.push(JSON.parse(item));
    }

    return updates;
  }

  /** 机器人发送消息 */
  async sendMessage(
    token: string,
    conversationId: string,
    content: string,
    type: Message['type'] = 'text',
  ): Promise<Message> {
    const botId = await this.userRepo.findBotByToken(token);
    if (!botId) throw new Error('INVALID_TOKEN');

    // 验证机器人是会话参与者
    const conv = await this.messageRepo.getConversation(conversationId);
    if (!conv) throw new Error('CONVERSATION_NOT_FOUND');
    if (!conv.participants.includes(botId)) throw new Error('NOT_PARTICIPANT');

    const message: Message = {
      id: generateId(),
      conversationId,
      senderId: botId,
      type,
      content: content.trim(),
      createdAt: Date.now(),
    };

    return this.messageRepo.saveMessage(message);
  }

  /** 获取会话历史消息（供 Bot 加载上下文） */
  async getHistory(
    token: string,
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ messages: Message[]; botUserId: string; total: number }> {
    const botId = await this.userRepo.findBotByToken(token);
    if (!botId) throw new Error('INVALID_TOKEN');

    const conv = await this.messageRepo.getConversation(conversationId);
    if (!conv) throw new Error('CONVERSATION_NOT_FOUND');
    if (!conv.participants.includes(botId)) throw new Error('NOT_PARTICIPANT');

    const redis = getRedisClient();
    const total = await redis.zcard(`conv_msgs:${conversationId}`);
    const messages = await this.messageRepo.getMessages(conversationId, offset, limit);

    return { messages, botUserId: botId, total };
  }

  /** 通过 token 获取机器人 ID */
  async getBotIdByToken(token: string): Promise<string | null> {
    return this.userRepo.findBotByToken(token);
  }

  // ========================
  // 服务端机器人专用方法
  // ========================

  /** 机器人直接发送消息（内部调用，不验证 token） */
  async sendMessageByBotId(
    botId: string,
    conversationId: string,
    content: string,
    type: Message['type'] = 'text',
  ): Promise<Message> {
    const conv = await this.messageRepo.getConversation(conversationId);
    if (!conv) throw new Error('CONVERSATION_NOT_FOUND');
    if (!conv.participants.includes(botId)) throw new Error('NOT_PARTICIPANT');

    const message: Message = {
      id: generateId(),
      conversationId,
      senderId: botId,
      type,
      content: content.trim(),
      createdAt: Date.now(),
    };

    return this.messageRepo.saveMessage(message);
  }

  /** 保存服务端 Bot LLM 配置（apiKey 加密存储） */
  async saveServerBotConfig(botId: string, llmConfig: LLMConfig): Promise<void> {
    const redis = getRedisClient();
    const encrypted = encryptApiKey(llmConfig.apiKey);
    await redis.hset(BOT_CONFIG_KEY(botId), {
      provider: llmConfig.provider,
      encryptedApiKey: encrypted,
      model: llmConfig.model,
      systemPrompt: llmConfig.systemPrompt,
      contextLength: String(llmConfig.contextLength),
      customBaseUrl: llmConfig.customBaseUrl || '',
      customModel: llmConfig.customModel || '',
    });
  }

  /** 获取服务端 Bot LLM 配置（解密 apiKey） */
  async getServerBotConfig(botId: string): Promise<LLMConfig | null> {
    const redis = getRedisClient();
    const data = await redis.hgetall(BOT_CONFIG_KEY(botId));
    if (!data || !data.provider) return null;

    return {
      provider: data.provider as LLMConfig['provider'],
      apiKey: decryptApiKey(data.encryptedApiKey),
      model: data.model,
      systemPrompt: data.systemPrompt,
      contextLength: parseInt(data.contextLength, 10) || 10,
      customBaseUrl: data.customBaseUrl || undefined,
      customModel: data.customModel || undefined,
    };
  }

  /** 获取脱敏的 LLM 配置（给前端展示） */
  async getServerBotConfigMasked(botId: string): Promise<Omit<LLMConfig, 'apiKey'> & { apiKey: string } | null> {
    const redis = getRedisClient();
    const data = await redis.hgetall(BOT_CONFIG_KEY(botId));
    if (!data || !data.provider) return null;

    const realKey = decryptApiKey(data.encryptedApiKey);
    return {
      provider: data.provider as LLMConfig['provider'],
      apiKey: maskApiKey(realKey),
      model: data.model,
      systemPrompt: data.systemPrompt,
      contextLength: parseInt(data.contextLength, 10) || 10,
      customBaseUrl: data.customBaseUrl || undefined,
      customModel: data.customModel || undefined,
    };
  }

  /** 设置 Bot 运行模式 */
  async setBotRunMode(botId: string, runMode: BotRunMode): Promise<void> {
    const redis = getRedisClient();
    await redis.hset(`user:${botId}`, 'runMode', runMode);
  }

  /** 获取 Bot 运行模式 */
  async getBotRunMode(botId: string): Promise<BotRunMode> {
    const redis = getRedisClient();
    const mode = await redis.hget(`user:${botId}`, 'runMode');
    return (mode as BotRunMode) || 'client';
  }

  /** 设置服务端 Bot 运行状态 */
  async setBotStatus(botId: string, status: BotStatus, error?: string): Promise<void> {
    const redis = getRedisClient();
    await redis.hset(`user:${botId}`, 'status', status);
    if (error) {
      await redis.hset(`user:${botId}`, 'statusError', error);
    } else {
      await redis.hdel(`user:${botId}`, 'statusError');
    }
  }

  /** 获取服务端 Bot 运行状态 */
  async getBotStatus(botId: string): Promise<{ status: BotStatus; error?: string }> {
    const redis = getRedisClient();
    const [status, error] = await Promise.all([
      redis.hget(`user:${botId}`, 'status'),
      redis.hget(`user:${botId}`, 'statusError'),
    ]);
    return {
      status: (status as BotStatus) || 'stopped',
      error: error || undefined,
    };
  }

  /** 获取所有服务端模式的 Bot ID */
  async getRunningServerBots(): Promise<string[]> {
    const redis = getRedisClient();
    return redis.smembers(SERVER_BOTS_KEY);
  }

  /** 获取会话历史（内部调用，不验证 token） */
  async getHistoryByBotId(
    botId: string,
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ messages: Message[]; botUserId: string; total: number }> {
    const conv = await this.messageRepo.getConversation(conversationId);
    if (!conv) throw new Error('CONVERSATION_NOT_FOUND');
    if (!conv.participants.includes(botId)) throw new Error('NOT_PARTICIPANT');

    const redis = getRedisClient();
    const total = await redis.zcard(`conv_msgs:${conversationId}`);
    const messages = await this.messageRepo.getMessages(conversationId, offset, limit);

    return { messages, botUserId: botId, total };
  }

  /** 保存服务端 Bot 对话历史到 Redis */
  async saveConvHistory(botId: string, convId: string, message: { role: string; content: string }): Promise<void> {
    const redis = getRedisClient();
    await redis.rpush(BOT_CONV_HISTORY_KEY(botId, convId), JSON.stringify(message));
  }

  /** 获取服务端 Bot 的 Redis 对话历史 */
  async getConvHistory(botId: string, convId: string, limit?: number): Promise<Array<{ role: string; content: string }>> {
    const redis = getRedisClient();
    const key = BOT_CONV_HISTORY_KEY(botId, convId);
    const items = limit
      ? await redis.lrange(key, -limit, -1)
      : await redis.lrange(key, 0, -1);
    return items.map((item) => JSON.parse(item));
  }

  /** 清除服务端 Bot 某个会话的 Redis 对话历史 */
  async clearConvHistory(botId: string, convId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(BOT_CONV_HISTORY_KEY(botId, convId));
  }

  /** 获取 Bot 允许使用的 Skill 函数列表（默认 ['*'] 表示全部允许） */
  async getBotAllowedSkills(botId: string): Promise<string[]> {
    const redis = getRedisClient();
    const members = await redis.smembers(`bot_skills:${botId}`);
    return members.length > 0 ? members : ['*'];
  }

  /** 设置 Bot 允许使用的 Skill 函数列表 */
  async setBotAllowedSkills(botId: string, skills: string[]): Promise<void> {
    const redis = getRedisClient();
    const key = `bot_skills:${botId}`;
    await redis.del(key);
    if (skills.length > 0) {
      await redis.sadd(key, ...skills);
    }
  }

  // ========================
  // LLM 调用日志
  // ========================

  /** 保存 LLM 调用日志 */
  async saveLLMCallLog(log: LLMCallLog): Promise<void> {
    const redis = getRedisClient();
    const key = BOT_LLM_LOGS_KEY(log.botId);
    await redis.zadd(key, log.timestamp, JSON.stringify(log));
    // 裁剪到最多 MAX_LLM_LOGS 条（保留最新的）
    const count = await redis.zcard(key);
    if (count > MAX_LLM_LOGS) {
      await redis.zremrangebyrank(key, 0, count - MAX_LLM_LOGS - 1);
    }
    // 刷新 TTL
    await redis.expire(key, LLM_LOGS_TTL);
  }

  /** 分页查询 LLM 调用日志（倒序，最新在前） */
  async getLLMCallLogs(botId: string, offset: number = 0, limit: number = 20): Promise<{ logs: LLMCallLog[]; total: number }> {
    const redis = getRedisClient();
    const key = BOT_LLM_LOGS_KEY(botId);
    const total = await redis.zcard(key);
    // ZREVRANGE 倒序取
    const items = await redis.zrevrange(key, offset, offset + limit - 1);
    const logs = items.map((item) => JSON.parse(item) as LLMCallLog);
    return { logs, total };
  }

  /** 清空 LLM 调用日志 */
  async clearLLMCallLogs(botId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(BOT_LLM_LOGS_KEY(botId));
  }

  /** 关闭专用 Redis 连接（用于测试清理和优雅关机） */
  async close() {
    await this.blockingRedis.quit();
  }
}
