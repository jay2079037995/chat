import type { Message } from './message';

/** 机器人实体（前端展示用） */
export interface Bot {
  id: string;
  username: string;
  ownerId: string;
  createdAt: number;
}

/** 机器人创建后返回（含 token，仅显示一次） */
export interface BotWithToken extends Bot {
  token: string;
}

/** 机器人收到的消息更新 */
export interface BotUpdate {
  updateId: number;
  message: Message;
  conversationId: string;
}
