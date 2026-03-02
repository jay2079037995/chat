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
  groupNames: Record<string, string>;
  botUserIds?: string[];
  /** 各参与者的最后已读时间戳：convId → { userId → timestamp } */
  lastReadMap?: Record<string, Record<string, number>>;
  /** 参与者头像映射：userId → avatarUrl */
  participantAvatars?: Record<string, string>;
}

/** 创建私聊 API 返回值 */
interface CreateConversationResponse {
  conversation: Conversation;
  participantNames: Record<string, string>;
}

/** 文件上传结果 */
export interface UploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
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

  /** 搜索聊天记录（跨所有会话） */
  async searchMessages(keyword: string): Promise<Message[]> {
    const res = await api.get<{ messages: Message[] }>('/chat/messages/search', {
      params: { q: keyword },
    });
    return res.data.messages;
  },

  /** 上传图片 */
  async uploadImage(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<UploadResult>('/chat/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /** 上传文件（含音频） */
  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<UploadResult>('/chat/upload/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });
    return res.data;
  },
};
