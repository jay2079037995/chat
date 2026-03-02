/** 消息类型枚举 */
export type MessageType = 'text' | 'image' | 'audio' | 'code' | 'markdown' | 'file';

/** 引用消息快照（防止原消息被删除后引用丢失） */
export interface ReplySnapshot {
  senderId: string;
  content: string;
  type: MessageType;
}

/** 聊天消息实体 */
export interface Message {
  /** 消息唯一标识 */
  id: string;
  /** 所属会话 ID */
  conversationId: string;
  /** 发送者用户 ID */
  senderId: string;
  /** 消息类型 */
  type: MessageType;
  /** 消息内容（文本/URL/代码等） */
  content: string;
  /** 文件名（type 为 file/image/audio 时使用） */
  fileName?: string;
  /** 文件大小（字节） */
  fileSize?: number;
  /** MIME 类型 */
  mimeType?: string;
  /** 代码语言（type 为 code 时使用） */
  codeLanguage?: string;
  /** 被 @提及 的用户 ID 列表 */
  mentions?: string[];
  /** 是否已撤回 */
  recalled?: boolean;
  /** 是否已编辑 */
  edited?: boolean;
  /** 编辑时间戳 */
  editedAt?: number;
  /** 引用的消息 ID */
  replyTo?: string;
  /** 被引用消息的快照 */
  replySnapshot?: ReplySnapshot;
  /** 表情回应：emoji → userId[] */
  reactions?: Record<string, string[]>;
  /** 发送时间戳 */
  createdAt: number;
}

/** 会话实体 */
export interface Conversation {
  /** 会话唯一标识 */
  id: string;
  /** 会话类型：private=私聊，group=群聊 */
  type: 'private' | 'group';
  /** 参与者用户 ID 列表 */
  participants: string[];
  /** 最后一条消息（用于会话列表展示） */
  lastMessage?: Message;
  /** 最后更新时间戳 */
  updatedAt: number;
}
