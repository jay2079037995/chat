import crypto from 'crypto';
import type { Message, MessageMetadata, BotUpdate, MastraLLMConfig, BotRunMode, AgentGenerationLog } from '@chat/shared';
import { generateId } from '@chat/shared';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import { getRedisClient } from '../../repositories/redis/RedisClient';
import { encryptApiKey, decryptApiKey, maskApiKey } from './CryptoUtils';

const BOT_UPDATES_KEY = (botId: string) => `bot_updates:${botId}`;
const BOT_UPDATE_SEQ_KEY = (botId: string) => `bot_update_seq:${botId}`;
const BOT_CONV_HISTORY_KEY = (botId: string, convId: string) => `bot_conv_history:${botId}:${convId}`;
const BOT_MASTRA_CONFIG_KEY = (botId: string) => `bot_mastra_config:${botId}`;
const BOT_GEN_LOGS_KEY = (botId: string) => `bot_gen_logs:${botId}`;
const LOCAL_BOTS_KEY = 'local_bots';

/** 每个 Bot 最多保留的日志条数 */
const MAX_LOGS = 100;
/** 日志 TTL（7 天） */
const LOGS_TTL = 7 * 24 * 60 * 60;

/**
 * 机器人服务
 *
 * 处理机器人创建/删除、消息队列入队等核心逻辑。
 * 仅支持本地模式（Electron/Mastra）。
 */
export class BotService {
  constructor(
    private userRepo: IUserRepository,
    private messageRepo: IMessageRepository,
  ) {}

  /** 创建机器人 */
  async createBot(
    ownerId: string,
    username: string,
    runMode: BotRunMode = 'local',
    _llmConfig?: unknown,
    mastraConfig?: MastraLLMConfig,
  ) {
    // 机器人用户名必须以 bot 结尾
    if (!username.toLowerCase().endsWith('bot')) {
      throw new Error('BOT_NAME_INVALID');
    }

    // 必须提供 Mastra 配置
    if (!mastraConfig) {
      throw new Error('LOCAL_MODE_REQUIRES_MASTRA_CONFIG');
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

    await this.saveMastraConfig(id, mastraConfig);
    await redis.sadd(LOCAL_BOTS_KEY, id);

    return { ...user, token, runMode };
  }

  /** 获取某用户拥有的机器人列表 */
  async listBots(ownerId: string) {
    return this.userRepo.getBotsByOwner(ownerId);
  }

  /** 获取 Bot 的 owner userId */
  async getBotOwnerId(botId: string): Promise<string | null> {
    const bot = await this.userRepo.findById(botId);
    return bot?.botOwnerId || null;
  }

  /** 删除机器人（需校验所有权） */
  async deleteBot(botId: string, requesterId: string) {
    const bot = await this.userRepo.findById(botId);
    if (!bot || !bot.isBot) throw new Error('BOT_NOT_FOUND');
    if (bot.botOwnerId !== requesterId) throw new Error('FORBIDDEN');

    const redis = getRedisClient();
    await redis.del(BOT_MASTRA_CONFIG_KEY(botId));
    await redis.srem(LOCAL_BOTS_KEY, botId);
    await redis.del(BOT_GEN_LOGS_KEY(botId));

    // 清理对话历史
    const historyKeys = await redis.keys(`bot_conv_history:${botId}:*`);
    if (historyKeys.length > 0) {
      await redis.del(...historyKeys);
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

  /** 机器人直接发送消息（内部调用） */
  async sendMessageByBotId(
    botId: string,
    conversationId: string,
    content: string,
    type: Message['type'] = 'text',
    metadata?: MessageMetadata,
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
      ...(metadata ? { metadata } : {}),
      createdAt: Date.now(),
    };

    return this.messageRepo.saveMessage(message);
  }

  /** 以 Bot 身份发送文件/图片消息 */
  async sendFileMessageByBotId(
    botId: string,
    conversationId: string,
    fileUrl: string,
    type: 'file' | 'image',
    fileName: string,
    fileSize: number,
    mimeType: string,
  ): Promise<Message> {
    const conv = await this.messageRepo.getConversation(conversationId);
    if (!conv) throw new Error('CONVERSATION_NOT_FOUND');
    if (!conv.participants.includes(botId)) throw new Error('NOT_PARTICIPANT');

    const message: Message = {
      id: generateId(),
      conversationId,
      senderId: botId,
      type,
      content: fileUrl,
      fileName,
      fileSize,
      mimeType,
      createdAt: Date.now(),
    };

    return this.messageRepo.saveMessage(message);
  }

  /** 获取 Bot 运行模式 */
  async getBotRunMode(botId: string): Promise<BotRunMode> {
    const redis = getRedisClient();
    const mode = await redis.hget(`user:${botId}`, 'runMode');
    return (mode as BotRunMode) || 'local';
  }

  /** 保存对话历史到 Redis */
  async saveConvHistory(botId: string, convId: string, message: { role: string; content: string }): Promise<void> {
    const redis = getRedisClient();
    await redis.rpush(BOT_CONV_HISTORY_KEY(botId, convId), JSON.stringify(message));
  }

  /** 获取 Redis 对话历史 */
  async getConvHistory(botId: string, convId: string, limit?: number): Promise<Array<{ role: string; content: string }>> {
    const redis = getRedisClient();
    const key = BOT_CONV_HISTORY_KEY(botId, convId);
    const items = limit
      ? await redis.lrange(key, -limit, -1)
      : await redis.lrange(key, 0, -1);
    return items.map((item) => JSON.parse(item));
  }

  /** 清除某个会话的 Redis 对话历史 */
  async clearConvHistory(botId: string, convId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(BOT_CONV_HISTORY_KEY(botId, convId));
  }

  // ========================
  // Agent 生成批次日志
  // ========================

  /** 保存 Agent 生成批次日志 */
  async saveAgentGenerationLog(log: AgentGenerationLog): Promise<void> {
    const redis = getRedisClient();
    const key = BOT_GEN_LOGS_KEY(log.botId);
    await redis.zadd(key, log.startTime, JSON.stringify(log));
    const count = await redis.zcard(key);
    if (count > MAX_LOGS) {
      await redis.zremrangebyrank(key, 0, count - MAX_LOGS - 1);
    }
    await redis.expire(key, LOGS_TTL);
  }

  /** 分页查询 Agent 生成批次日志（倒序，最新在前） */
  async getAgentGenerationLogs(botId: string, offset: number = 0, limit: number = 20): Promise<{ logs: AgentGenerationLog[]; total: number }> {
    const redis = getRedisClient();
    const key = BOT_GEN_LOGS_KEY(botId);
    const total = await redis.zcard(key);
    const items = await redis.zrevrange(key, offset, offset + limit - 1);
    const logs = items.map((item) => JSON.parse(item) as AgentGenerationLog);
    return { logs, total };
  }

  /** 清空 Agent 生成批次日志 */
  async clearAgentGenerationLogs(botId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(BOT_GEN_LOGS_KEY(botId));
  }

  // ========================
  // 本地 Bot Mastra 配置
  // ========================

  /** 保存本地 Bot Mastra 配置（apiKey 加密存储） */
  async saveMastraConfig(botId: string, mastraConfig: MastraLLMConfig): Promise<void> {
    const redis = getRedisClient();
    const encrypted = encryptApiKey(mastraConfig.apiKey);
    await redis.hset(BOT_MASTRA_CONFIG_KEY(botId), {
      provider: mastraConfig.provider,
      encryptedApiKey: encrypted,
      model: mastraConfig.model,
      systemPrompt: mastraConfig.systemPrompt,
      contextLength: String(mastraConfig.contextLength),
    });
  }

  /** 获取本地 Bot Mastra 配置（解密 apiKey） */
  async getMastraConfig(botId: string): Promise<MastraLLMConfig | null> {
    const redis = getRedisClient();
    const data = await redis.hgetall(BOT_MASTRA_CONFIG_KEY(botId));
    if (!data || !data.provider) return null;

    return {
      provider: data.provider as MastraLLMConfig['provider'],
      apiKey: decryptApiKey(data.encryptedApiKey),
      model: data.model,
      systemPrompt: data.systemPrompt,
      contextLength: parseInt(data.contextLength, 10) || 10,
    };
  }

  /** 获取脱敏的 Mastra 配置（给前端展示） */
  async getMastraConfigMasked(botId: string): Promise<(Omit<MastraLLMConfig, 'apiKey'> & { apiKey: string }) | null> {
    const redis = getRedisClient();
    const data = await redis.hgetall(BOT_MASTRA_CONFIG_KEY(botId));
    if (!data || !data.provider) return null;

    const realKey = decryptApiKey(data.encryptedApiKey);
    return {
      provider: data.provider as MastraLLMConfig['provider'],
      apiKey: maskApiKey(realKey),
      model: data.model,
      systemPrompt: data.systemPrompt,
      contextLength: parseInt(data.contextLength, 10) || 10,
    };
  }

  /** 获取某用户拥有的所有本地 Bot 配置（供 Electron 启动时批量拉取） */
  async getLocalBotConfigs(ownerId: string): Promise<Array<{ botId: string; config: MastraLLMConfig }>> {
    const bots = await this.userRepo.getBotsByOwner(ownerId);
    const results: Array<{ botId: string; config: MastraLLMConfig }> = [];
    for (const bot of bots) {
      const config = await this.getMastraConfig(bot.id);
      if (config) {
        results.push({ botId: bot.id, config });
      }
    }
    return results;
  }
}
