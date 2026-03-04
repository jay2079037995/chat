/**
 * Socket.IO 事件类型定义
 *
 * 前后端共享，确保 WebSocket 事件的类型安全。
 */
import type { Message, Conversation } from './message';
import type { Group } from './group';
import type { GenericToolExecRequest, GenericToolExecResult } from './claude-skill';

/** 服务端 → 客户端 事件 */
export interface ServerToClientEvents {
  /** 收到新消息 */
  'message:receive': (message: Message) => void;
  /** 某用户上线 */
  'user:online': (userId: string) => void;
  /** 某用户下线 */
  'user:offline': (userId: string) => void;
  /** 当前所有在线用户列表（连接时一次性下发） */
  'users:online_list': (userIds: string[]) => void;
  /** 消息已读回执 */
  'message:read': (data: { conversationId: string; userId: string; lastReadAt?: number }) => void;
  /** 有用户正在输入 */
  'typing:start': (data: { conversationId: string; userId: string }) => void;
  /** 有用户停止输入 */
  'typing:stop': (data: { conversationId: string; userId: string }) => void;
  /** 消息已撤回 */
  'message:recalled': (data: { messageId: string; conversationId: string; senderId: string }) => void;
  /** 消息已编辑 */
  'message:edited': (data: { messageId: string; conversationId: string; newContent: string; editedAt: number }) => void;
  /** 消息表情回应变更 */
  'message:reacted': (data: { messageId: string; conversationId: string; reactions: Record<string, string[]> }) => void;
  /** 群组成员加入通知 */
  'group:member_added': (data: { groupId: string; userId: string; username: string }) => void;
  /** 群组成员移除通知 */
  'group:member_removed': (data: { groupId: string; userId: string }) => void;
  /** 被邀请加入群组 */
  'group:invited': (data: { group: Group; conversation: Conversation }) => void;
  /** 被移出群组 */
  'group:kicked': (data: { groupId: string; conversationId: string }) => void;
  /** 群组已解散 */
  'group:dissolved': (data: { groupId: string; conversationId: string }) => void;
  /** 上线后推送离线消息 */
  'sync:offline_messages': (messages: Message[]) => void;
  /** 消息被置顶/取消置顶 */
  'message:pinned': (data: { conversationId: string; messageId: string; pinned: boolean; pinnedBy: string }) => void;
  /** 某条消息中 @提及 了当前用户 */
  'mention:notify': (data: { message: Message; conversationId: string; senderName: string }) => void;
  /** 通用工具执行请求（服务端 Bot → 用户 Electron 客户端） */
  'tool:exec': (request: GenericToolExecRequest) => void;
  /** 请求 Bot 的 Skill 指令内容（服务端 → Electron 客户端） */
  'bot:request-skills': (data: { botId: string }) => void;
}

/** 客户端 → 服务端 事件 */
export interface ClientToServerEvents {
  /** 发送消息（callback 返回持久化后的消息） */
  'message:send': (data: { conversationId: string; type: Message['type']; content: string; fileName?: string; fileSize?: number; mimeType?: string; codeLanguage?: string; replyTo?: string }, callback: (message: Message) => void) => void;
  /** 撤回消息 */
  'message:recall': (data: { messageId: string; conversationId: string }, callback: (result: { success: boolean; error?: string }) => void) => void;
  /** 编辑消息 */
  'message:edit': (data: { messageId: string; conversationId: string; newContent: string }, callback: (result: { success: boolean; error?: string }) => void) => void;
  /** 消息表情回应（toggle） */
  'message:react': (data: { messageId: string; conversationId: string; emoji: string }) => void;
  /** 标记会话消息已读 */
  'message:read': (data: { conversationId: string }) => void;
  /** 用户开始输入 */
  'typing:start': (data: { conversationId: string }) => void;
  /** 用户停止输入 */
  'typing:stop': (data: { conversationId: string }) => void;
  /** 置顶/取消置顶消息（会话内所有人可见） */
  'message:pin': (data: { messageId: string; conversationId: string }, callback: (result: { success: boolean; error?: string; pinned?: boolean }) => void) => void;
  /** 加入会话房间（订阅该会话的实时消息） */
  'conversation:join': (conversationId: string) => void;
  /** 通用工具执行结果（Electron 客户端 → 服务端） */
  'tool:result': (result: GenericToolExecResult) => void;
  /** 推送 Bot 的 Skill 指令内容（Electron 客户端 → 服务端） */
  'bot:skill-instructions': (data: { botId: string; instructions: string }) => void;
}
