import type { Message, Conversation } from '@chat/shared';

/** 消息数据访问接口（v0.3.0+ 实现，Repository 模式） */
export interface IMessageRepository {
  /** 保存消息 */
  saveMessage(message: Message): Promise<Message>;
  /** 获取单条消息 */
  getMessage(id: string): Promise<Message | null>;
  /** 更新消息字段 */
  updateMessage(id: string, updates: Partial<Message>): Promise<void>;
  /** 分页查询会话消息（offset + limit） */
  getMessages(conversationId: string, offset: number, limit: number): Promise<Message[]>;
  /** 在会话中搜索包含关键词的消息 */
  searchMessages(conversationId: string, keyword: string): Promise<Message[]>;
  /** 获取单个会话 */
  getConversation(id: string): Promise<Conversation | null>;
  /** 获取用户参与的所有会话 */
  getConversationsByUserId(userId: string): Promise<Conversation[]>;
  /** 创建新会话 */
  createConversation(conversation: Conversation): Promise<Conversation>;
  /** 更新会话信息（如最后消息、时间戳） */
  updateConversation(id: string, data: Partial<Conversation>): Promise<void>;
  /** 获取用户在某会话中的未读消息数 */
  getUnreadCount(conversationId: string, userId: string): Promise<number>;
  /** 清零用户在某会话中的未读计数 */
  clearUnread(conversationId: string, userId: string): Promise<void>;
  /** 将用户标记为在线 */
  setUserOnline(userId: string, socketId: string): Promise<void>;
  /** 将用户标记为离线 */
  setUserOffline(userId: string): Promise<void>;
  /** 获取所有在线用户 ID */
  getOnlineUsers(): Promise<string[]>;
  /** 获取用户在某会话的最后已读时间戳 */
  getLastReadAt(conversationId: string, userId: string): Promise<number>;
  /** 设置用户在某会话的最后已读时间戳 */
  setLastReadAt(conversationId: string, userId: string, timestamp: number): Promise<void>;

  // --- 会话管理（per-user）---

  /** 切换用户置顶会话状态，返回新状态 */
  togglePinnedConversation(userId: string, conversationId: string): Promise<boolean>;
  /** 获取用户所有置顶的会话 ID */
  getPinnedConversations(userId: string): Promise<string[]>;
  /** 切换用户免打扰会话状态，返回新状态 */
  toggleMutedConversation(userId: string, conversationId: string): Promise<boolean>;
  /** 获取用户所有免打扰的会话 ID */
  getMutedConversations(userId: string): Promise<string[]>;
  /** 切换用户归档会话状态，返回新状态 */
  toggleArchivedConversation(userId: string, conversationId: string): Promise<boolean>;
  /** 获取用户所有归档的会话 ID */
  getArchivedConversations(userId: string): Promise<string[]>;
  /** 删除会话（从用户的会话列表中移除，软删除） */
  deleteConversationForUser(userId: string, conversationId: string): Promise<void>;
  /** 清空会话所有消息（保留会话本身） */
  clearConversationMessages(conversationId: string): Promise<number>;
  /** 设置用户对某会话的标签 */
  setConversationTags(userId: string, conversationId: string, tags: string[]): Promise<void>;
  /** 获取用户所有会话的标签映射 */
  getConversationTags(userId: string): Promise<Record<string, string[]>>;

  // --- 消息置顶（per-conversation，所有人可见）---

  /** 置顶/取消置顶消息，返回新状态 */
  togglePinnedMessage(conversationId: string, messageId: string): Promise<boolean>;
  /** 获取会话中所有置顶消息 ID */
  getPinnedMessageIds(conversationId: string): Promise<string[]>;
}
