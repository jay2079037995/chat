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
}
