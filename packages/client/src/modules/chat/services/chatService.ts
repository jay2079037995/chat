/**
 * 聊天服务 —— 封装所有与 /api/chat 相关的 HTTP 请求
 */
import type { Message, Conversation } from '@chat/shared';
import { api } from '../../../services/api';

/** 带未读计数的会话 */
export interface ConversationWithUnread extends Conversation {
  unreadCount: number;
}

/** 会话列表 API 返回值 */
interface ConversationsResponse {
  conversations: ConversationWithUnread[];
  participantNames: Record<string, string>;
}

/** 创建私聊 API 返回值 */
interface CreateConversationResponse {
  conversation: Conversation;
  participantNames: Record<string, string>;
}

export const chatService = {
  /** 获取当前用户的会话列表（含参与者用户名映射） */
  async getConversations(): Promise<ConversationsResponse> {
    const res = await api.get<ConversationsResponse>('/chat/conversations');
    return res.data;
  },

  /** 分页获取会话消息 */
  async getMessages(conversationId: string, offset = 0, limit = 50): Promise<Message[]> {
    const res = await api.get<{ messages: Message[] }>(
      `/chat/conversations/${conversationId}/messages`,
      { params: { offset, limit } },
    );
    return res.data.messages;
  },

  /** 创建/获取私聊会话（含参与者用户名映射） */
  async createPrivateConversation(targetUserId: string): Promise<CreateConversationResponse> {
    const res = await api.post<CreateConversationResponse>('/chat/conversations/private', {
      targetUserId,
    });
    return res.data;
  },

  /** 标记会话已读 */
  async markAsRead(conversationId: string): Promise<void> {
    await api.post(`/chat/conversations/${conversationId}/read`);
  },
};
