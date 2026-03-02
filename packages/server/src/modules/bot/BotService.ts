import crypto from 'crypto';
import type { Message, BotUpdate } from '@chat/shared';
import { generateId } from '@chat/shared';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import { getRedisClient } from '../../repositories/redis/RedisClient';

const BOT_UPDATES_KEY = (botId: string) => `bot_updates:${botId}`;
const BOT_UPDATE_SEQ_KEY = (botId: string) => `bot_update_seq:${botId}`;

/**
 * 机器人服务
 *
 * 处理机器人创建/删除、消息队列入队/出队、机器人发消息等核心逻辑。
 */
export class BotService {
  constructor(
    private userRepo: IUserRepository,
    private messageRepo: IMessageRepository,
  ) {}

  /** 创建机器人 */
  async createBot(ownerId: string, username: string) {
    // 机器人用户名必须以 bot 结尾
    if (!username.toLowerCase().endsWith('bot')) {
      throw new Error('BOT_NAME_INVALID');
    }

    // 检查用户名是否已存在
    const existing = await this.userRepo.findByUsername(username);
    if (existing) throw new Error('USERNAME_TAKEN');

    const id = generateId();
    const token = crypto.randomBytes(32).toString('hex');

    const user = await this.userRepo.createBot({ id, username, token, ownerId });
    return { ...user, token };
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

    const redis = getRedisClient();
    // BLPOP 阻塞等待，timeout 秒后返回 null
    const result = await redis.blpop(BOT_UPDATES_KEY(botId), timeout);
    if (!result) return [];

    // BLPOP 返回 [key, value]
    const updates: BotUpdate[] = [JSON.parse(result[1])];

    // 取出队列中剩余的（非阻塞）
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

  /** 通过 token 获取机器人 ID */
  async getBotIdByToken(token: string): Promise<string | null> {
    return this.userRepo.findBotByToken(token);
  }
}
