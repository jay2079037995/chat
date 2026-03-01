import type { Message, Conversation } from '@chat/shared';
import { generateId, MAX_MESSAGE_LENGTH } from '@chat/shared';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';

/**
 * 聊天服务
 *
 * 处理私聊会话创建、消息发送/查询、已读状态等核心聊天逻辑。
 * 通过构造函数注入 Repository 依赖。
 */
export class ChatService {
  constructor(private messageRepo: IMessageRepository) {}

  /**
   * 生成确定性私聊会话 ID
   *
   * 规则：private:{较小ID}:{较大ID}，保证同一对用户始终返回相同 ID。
   */
  private getPrivateConversationId(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `private:${sorted[0]}:${sorted[1]}`;
  }

  /** 获取或创建私聊会话（幂等操作） */
  async getOrCreatePrivateConversation(userId1: string, userId2: string): Promise<Conversation> {
    const convId = this.getPrivateConversationId(userId1, userId2);
    const existing = await this.messageRepo.getConversation(convId);
    if (existing) return existing;

    const conversation: Conversation = {
      id: convId,
      type: 'private',
      participants: [userId1, userId2],
      updatedAt: Date.now(),
    };
    return this.messageRepo.createConversation(conversation);
  }

  /** 发送消息：验证内容 → 创建 Message → 持久化 */
  async sendMessage(
    senderId: string,
    conversationId: string,
    type: Message['type'],
    content: string,
  ): Promise<Message> {
    if (!content || content.trim().length === 0) {
      throw new Error('EMPTY_MESSAGE');
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error('MESSAGE_TOO_LONG');
    }

    const message: Message = {
      id: generateId(),
      conversationId,
      senderId,
      type,
      content: content.trim(),
      createdAt: Date.now(),
    };

    return this.messageRepo.saveMessage(message);
  }

  /** 分页查询会话消息 */
  async getMessages(conversationId: string, offset: number, limit: number): Promise<Message[]> {
    return this.messageRepo.getMessages(conversationId, offset, limit);
  }

  /** 获取用户所有会话（含 lastMessage 和未读计数） */
  async getConversations(userId: string): Promise<(Conversation & { unreadCount: number })[]> {
    const conversations = await this.messageRepo.getConversationsByUserId(userId);

    const results: (Conversation & { unreadCount: number })[] = [];
    for (const conv of conversations) {
      const unreadCount = await this.messageRepo.getUnreadCount(conv.id, userId);
      results.push({ ...conv, unreadCount });
    }

    return results;
  }

  /** 标记会话为已读（清零未读计数） */
  async markAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messageRepo.clearUnread(conversationId, userId);
  }
}
