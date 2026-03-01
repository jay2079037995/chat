/**
 * Socket.IO 事件类型定义
 *
 * 前后端共享，确保 WebSocket 事件的类型安全。
 */
import type { Message } from './message';

/** 服务端 → 客户端 事件 */
export interface ServerToClientEvents {
  /** 收到新消息 */
  'message:receive': (message: Message) => void;
  /** 某用户上线 */
  'user:online': (userId: string) => void;
  /** 某用户下线 */
  'user:offline': (userId: string) => void;
  /** 消息已读回执 */
  'message:read': (data: { conversationId: string; userId: string }) => void;
}

/** 客户端 → 服务端 事件 */
export interface ClientToServerEvents {
  /** 发送消息（callback 返回持久化后的消息） */
  'message:send': (data: { conversationId: string; type: Message['type']; content: string; fileName?: string; fileSize?: number; mimeType?: string; codeLanguage?: string }, callback: (message: Message) => void) => void;
  /** 标记会话消息已读 */
  'message:read': (data: { conversationId: string }) => void;
  /** 加入会话房间（订阅该会话的实时消息） */
  'conversation:join': (conversationId: string) => void;
}
