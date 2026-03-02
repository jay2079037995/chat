import type { Message, Conversation, ReplySnapshot } from '@chat/shared';
import { generateId, MAX_MESSAGE_LENGTH } from '@chat/shared';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';

/**
 * 聊天服务
 *
 * 处理私聊会话创建、消息发送/查询、已读状态等核心聊天逻辑。
 * 通过构造函数注入 Repository 依赖。
 */
export class ChatService {
  constructor(
    private messageRepo: IMessageRepository,
    private userRepo: IUserRepository,
  ) {}

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

  /** 获取单个会话 */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.messageRepo.getConversation(conversationId);
  }

  /** 发送消息：验证内容 → 类型校验 → 创建 Message → 持久化 */
  async sendMessage(
    senderId: string,
    conversationId: string,
    type: Message['type'],
    content: string,
    metadata?: {
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      codeLanguage?: string;
      replyTo?: string;
    },
  ): Promise<Message> {
    if (!content || content.trim().length === 0) {
      throw new Error('EMPTY_MESSAGE');
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error('MESSAGE_TOO_LONG');
    }

    // 类型特定校验
    switch (type) {
      case 'image':
      case 'audio':
        if (!content.startsWith('/uploads/')) throw new Error('INVALID_FILE_URL');
        break;
      case 'code':
        if (!metadata?.codeLanguage) throw new Error('CODE_LANGUAGE_REQUIRED');
        break;
      case 'file':
        if (!content.startsWith('/uploads/')) throw new Error('INVALID_FILE_URL');
        if (!metadata?.fileName) throw new Error('FILE_NAME_REQUIRED');
        break;
    }

    // 解析 @username 提及，转换为 userId 列表
    let mentions: string[] | undefined;
    if (type === 'text' || type === 'markdown') {
      const mentionPattern = /@(\S+)/g;
      const usernames = [...content.matchAll(mentionPattern)].map((m) => m[1]);
      if (usernames.length > 0) {
        const resolved: string[] = [];
        const seen = new Set<string>();
        for (const uname of usernames) {
          if (seen.has(uname)) continue;
          seen.add(uname);
          const user = await this.userRepo.findByUsername(uname);
          if (user) resolved.push(user.id);
        }
        if (resolved.length > 0) mentions = resolved;
      }
    }

    // 处理引用回复
    let replyTo: string | undefined;
    let replySnapshot: ReplySnapshot | undefined;
    if (metadata?.replyTo) {
      const originalMsg = await this.messageRepo.getMessage(metadata.replyTo);
      if (originalMsg) {
        replyTo = metadata.replyTo;
        replySnapshot = {
          senderId: originalMsg.senderId,
          content: originalMsg.content.substring(0, 200),
          type: originalMsg.type,
        };
      }
    }

    const message: Message = {
      id: generateId(),
      conversationId,
      senderId,
      type,
      content: content.trim(),
      createdAt: Date.now(),
      ...(metadata?.fileName && { fileName: metadata.fileName }),
      ...(metadata?.fileSize !== undefined && { fileSize: metadata.fileSize }),
      ...(metadata?.mimeType && { mimeType: metadata.mimeType }),
      ...(metadata?.codeLanguage && { codeLanguage: metadata.codeLanguage }),
      ...(mentions && { mentions }),
      ...(replyTo && { replyTo }),
      ...(replySnapshot && { replySnapshot }),
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

  /**
   * 跨会话搜索消息
   *
   * 遍历用户参与的所有会话，搜索包含关键词的消息，
   * 合并结果按时间降序返回。
   */
  async searchMessages(userId: string, keyword: string): Promise<Message[]> {
    const conversations = await this.messageRepo.getConversationsByUserId(userId);
    const allResults: Message[] = [];

    for (const conv of conversations) {
      const results = await this.messageRepo.searchMessages(conv.id, keyword);
      allResults.push(...results);
    }

    allResults.sort((a, b) => b.createdAt - a.createdAt);
    return allResults;
  }

  /** 撤回消息（2 分钟内，仅发送者） */
  async recallMessage(messageId: string, userId: string): Promise<void> {
    const msg = await this.messageRepo.getMessage(messageId);
    if (!msg) throw new Error('MESSAGE_NOT_FOUND');
    if (msg.senderId !== userId) throw new Error('FORBIDDEN');
    if (msg.recalled) throw new Error('ALREADY_RECALLED');

    const elapsed = Date.now() - msg.createdAt;
    if (elapsed > 2 * 60 * 1000) throw new Error('RECALL_TIMEOUT');

    await this.messageRepo.updateMessage(messageId, { recalled: true });
  }

  /** 编辑消息（5 分钟内，仅文本类消息，仅发送者） */
  async editMessage(messageId: string, userId: string, newContent: string): Promise<number> {
    const msg = await this.messageRepo.getMessage(messageId);
    if (!msg) throw new Error('MESSAGE_NOT_FOUND');
    if (msg.senderId !== userId) throw new Error('FORBIDDEN');
    if (msg.recalled) throw new Error('MESSAGE_RECALLED');
    if (msg.type !== 'text' && msg.type !== 'markdown') throw new Error('EDIT_NOT_SUPPORTED');

    const elapsed = Date.now() - msg.createdAt;
    if (elapsed > 5 * 60 * 1000) throw new Error('EDIT_TIMEOUT');

    if (!newContent || newContent.trim().length === 0) throw new Error('EMPTY_MESSAGE');
    if (newContent.length > MAX_MESSAGE_LENGTH) throw new Error('MESSAGE_TOO_LONG');

    const editedAt = Date.now();
    await this.messageRepo.updateMessage(messageId, {
      content: newContent.trim(),
      edited: true,
      editedAt,
    });
    return editedAt;
  }

  /** Toggle 消息表情回应 */
  async toggleReaction(messageId: string, userId: string, emoji: string): Promise<Record<string, string[]>> {
    const msg = await this.messageRepo.getMessage(messageId);
    if (!msg) throw new Error('MESSAGE_NOT_FOUND');
    if (msg.recalled) throw new Error('MESSAGE_RECALLED');

    const reactions = msg.reactions ? { ...msg.reactions } : {};

    if (!reactions[emoji]) {
      reactions[emoji] = [userId];
    } else if (reactions[emoji].includes(userId)) {
      reactions[emoji] = reactions[emoji].filter((id) => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...reactions[emoji], userId];
    }

    await this.messageRepo.updateMessage(messageId, { reactions });
    return reactions;
  }
}
