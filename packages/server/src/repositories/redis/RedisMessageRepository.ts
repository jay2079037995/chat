import type { Message, Conversation } from '@chat/shared';
import { getRedisClient } from './RedisClient';
import type { IMessageRepository } from '../interfaces/IMessageRepository';

// Redis Key 规则
const MSG_KEY = (id: string) => `msg:${id}`;                         // 消息详情 Hash
const CONV_MSGS_KEY = (convId: string) => `conv_msgs:${convId}`;     // 会话消息列表 Sorted Set (score=createdAt)
const CONV_KEY = (convId: string) => `conv:${convId}`;               // 会话元数据 Hash
const USER_CONVS_KEY = (userId: string) => `user_convs:${userId}`;   // 用户会话列表 Sorted Set (score=updatedAt)
const UNREAD_KEY = (convId: string) => `unread:${convId}`;           // 未读计数 Hash (field=userId)

/**
 * 消息 Repository 的 Redis 实现
 *
 * 数据结构：
 * - msg:{id}         — Hash，消息完整信息
 * - conv_msgs:{id}   — Sorted Set，score=createdAt，member=messageId
 * - conv:{id}        — Hash，会话元数据（id, type, participants, lastMessage, updatedAt）
 * - user_convs:{uid} — Sorted Set，score=updatedAt，member=conversationId
 * - unread:{convId}  — Hash，field=userId，value=未读消息数
 */
export class RedisMessageRepository implements IMessageRepository {
  /** 生成唯一消息 ID */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }

  /** 将 Message 对象序列化为 Redis Hash 字段 */
  private serializeMessage(msg: Message): Record<string, string> {
    const data: Record<string, string> = {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      type: msg.type,
      content: msg.content,
      createdAt: String(msg.createdAt),
    };
    if (msg.fileName) data.fileName = msg.fileName;
    if (msg.fileSize !== undefined) data.fileSize = String(msg.fileSize);
    if (msg.mimeType) data.mimeType = msg.mimeType;
    if (msg.codeLanguage) data.codeLanguage = msg.codeLanguage;
    if (msg.mentions && msg.mentions.length > 0) data.mentions = JSON.stringify(msg.mentions);
    if (msg.recalled) data.recalled = '1';
    if (msg.edited) data.edited = '1';
    if (msg.editedAt) data.editedAt = String(msg.editedAt);
    if (msg.replyTo) data.replyTo = msg.replyTo;
    if (msg.replySnapshot) data.replySnapshot = JSON.stringify(msg.replySnapshot);
    if (msg.reactions) data.reactions = JSON.stringify(msg.reactions);
    return data;
  }

  /** 从 Redis Hash 数据反序列化为 Message 对象 */
  private deserializeMessage(data: Record<string, string>): Message {
    const msg: Message = {
      id: data.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      type: data.type as Message['type'],
      content: data.content,
      createdAt: parseInt(data.createdAt, 10),
    };
    if (data.fileName) msg.fileName = data.fileName;
    if (data.fileSize) msg.fileSize = parseInt(data.fileSize, 10);
    if (data.mimeType) msg.mimeType = data.mimeType;
    if (data.codeLanguage) msg.codeLanguage = data.codeLanguage;
    if (data.mentions) msg.mentions = JSON.parse(data.mentions);
    if (data.recalled === '1') msg.recalled = true;
    if (data.edited === '1') msg.edited = true;
    if (data.editedAt) msg.editedAt = parseInt(data.editedAt, 10);
    if (data.replyTo) msg.replyTo = data.replyTo;
    if (data.replySnapshot) msg.replySnapshot = JSON.parse(data.replySnapshot);
    if (data.reactions) msg.reactions = JSON.parse(data.reactions);
    return msg;
  }

  /** 获取单条消息 */
  async getMessage(id: string): Promise<Message | null> {
    const redis = getRedisClient();
    const data = await redis.hgetall(MSG_KEY(id));
    if (!data || !data.id) return null;
    return this.deserializeMessage(data);
  }

  /** 更新消息字段（直接修改 Redis Hash） */
  async updateMessage(id: string, updates: Partial<Message>): Promise<void> {
    const redis = getRedisClient();
    const fields: Record<string, string> = {};
    if (updates.content !== undefined) fields.content = updates.content;
    if (updates.recalled !== undefined) fields.recalled = updates.recalled ? '1' : '0';
    if (updates.edited !== undefined) fields.edited = updates.edited ? '1' : '0';
    if (updates.editedAt !== undefined) fields.editedAt = String(updates.editedAt);
    if (updates.reactions !== undefined) fields.reactions = JSON.stringify(updates.reactions);
    if (Object.keys(fields).length > 0) {
      await redis.hset(MSG_KEY(id), fields);
    }
  }

  /** 保存消息：写入消息 Hash + 更新会话消息列表 + 更新会话元数据 + 更新用户会话排序 + 增加未读计数 */
  async saveMessage(message: Message): Promise<Message> {
    const redis = getRedisClient();
    const msg: Message = { ...message, id: message.id || this.generateId() };
    const conv = await this.getConversation(msg.conversationId);
    if (!conv) throw new Error('CONVERSATION_NOT_FOUND');

    const pipeline = redis.multi();

    // 存储消息
    pipeline.hset(MSG_KEY(msg.id), this.serializeMessage(msg));

    // 添加到会话消息列表
    pipeline.zadd(CONV_MSGS_KEY(msg.conversationId), msg.createdAt, msg.id);

    // 更新会话元数据（lastMessage + updatedAt）
    pipeline.hset(CONV_KEY(msg.conversationId), {
      lastMessage: JSON.stringify(msg),
      updatedAt: String(msg.createdAt),
    });

    // 更新所有参与者的会话排序 + 非发送者的未读计数
    for (const userId of conv.participants) {
      pipeline.zadd(USER_CONVS_KEY(userId), msg.createdAt, msg.conversationId);
      if (userId !== msg.senderId) {
        pipeline.hincrby(UNREAD_KEY(msg.conversationId), userId, 1);
      }
    }

    await pipeline.exec();
    return msg;
  }

  /** 分页查询会话消息（按时间倒序，offset + limit） */
  async getMessages(conversationId: string, offset: number, limit: number): Promise<Message[]> {
    const redis = getRedisClient();
    const messageIds = await redis.zrevrange(
      CONV_MSGS_KEY(conversationId),
      offset,
      offset + limit - 1,
    );

    if (messageIds.length === 0) return [];

    const messages: Message[] = [];
    for (const id of messageIds) {
      const data = await redis.hgetall(MSG_KEY(id));
      if (data && data.id) {
        messages.push(this.deserializeMessage(data));
      }
    }

    return messages;
  }

  /** 在会话中搜索包含关键词的消息 */
  async searchMessages(conversationId: string, keyword: string): Promise<Message[]> {
    const redis = getRedisClient();
    const allMsgIds = await redis.zrevrange(CONV_MSGS_KEY(conversationId), 0, -1);
    const lowerKeyword = keyword.toLowerCase();

    const results: Message[] = [];
    for (const id of allMsgIds) {
      const data = await redis.hgetall(MSG_KEY(id));
      if (data && data.content && data.content.toLowerCase().includes(lowerKeyword)) {
        results.push(this.deserializeMessage(data));
      }
    }

    return results;
  }

  /** 获取单个会话 */
  async getConversation(id: string): Promise<Conversation | null> {
    const redis = getRedisClient();
    const data = await redis.hgetall(CONV_KEY(id));
    if (!data || !data.id) return null;

    return {
      id: data.id,
      type: data.type as Conversation['type'],
      participants: JSON.parse(data.participants),
      lastMessage: data.lastMessage ? JSON.parse(data.lastMessage) : undefined,
      updatedAt: parseInt(data.updatedAt, 10),
    };
  }

  /** 获取用户参与的所有会话（按最后更新时间倒序） */
  async getConversationsByUserId(userId: string): Promise<Conversation[]> {
    const redis = getRedisClient();
    const convIds = await redis.zrevrange(USER_CONVS_KEY(userId), 0, -1);

    if (convIds.length === 0) return [];

    const conversations: Conversation[] = [];
    for (const convId of convIds) {
      const conv = await this.getConversation(convId);
      if (conv) {
        conversations.push(conv);
      }
    }

    return conversations;
  }

  /** 创建新会话 */
  async createConversation(conversation: Conversation): Promise<Conversation> {
    const redis = getRedisClient();
    const pipeline = redis.multi();

    // 存储会话元数据
    pipeline.hset(CONV_KEY(conversation.id), {
      id: conversation.id,
      type: conversation.type,
      participants: JSON.stringify(conversation.participants),
      updatedAt: String(conversation.updatedAt),
    });

    // 将会话添加到所有参与者的会话列表
    for (const userId of conversation.participants) {
      pipeline.zadd(USER_CONVS_KEY(userId), conversation.updatedAt, conversation.id);
    }

    await pipeline.exec();
    return conversation;
  }

  /** 更新会话信息 */
  async updateConversation(id: string, data: Partial<Conversation>): Promise<void> {
    const redis = getRedisClient();
    const updates: Record<string, string> = {};

    if (data.lastMessage) updates.lastMessage = JSON.stringify(data.lastMessage);
    if (data.updatedAt !== undefined) updates.updatedAt = String(data.updatedAt);
    if (data.participants) updates.participants = JSON.stringify(data.participants);

    if (Object.keys(updates).length > 0) {
      await redis.hset(CONV_KEY(id), updates);
    }
  }

  /** 获取用户在某会话中的未读消息数 */
  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    const redis = getRedisClient();
    const count = await redis.hget(UNREAD_KEY(conversationId), userId);
    return count ? parseInt(count, 10) : 0;
  }

  /** 清零用户在某会话中的未读计数 */
  async clearUnread(conversationId: string, userId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.hset(UNREAD_KEY(conversationId), userId, '0');
  }

  /** 将用户标记为在线 */
  async setUserOnline(userId: string, socketId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.multi()
      .sadd('online_users', userId)
      .hset('user_sockets', userId, socketId)
      .exec();
  }

  /** 将用户标记为离线 */
  async setUserOffline(userId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.multi()
      .srem('online_users', userId)
      .hdel('user_sockets', userId)
      .exec();
  }

  /** 获取所有在线用户 ID */
  async getOnlineUsers(): Promise<string[]> {
    const redis = getRedisClient();
    return redis.smembers('online_users');
  }
}
