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
  /** 用户置顶的会话 ID 列表 */
  pinnedIds?: string[];
  /** 用户免打扰的会话 ID 列表 */
  mutedIds?: string[];
  /** 用户归档的会话 ID 列表 */
  archivedIds?: string[];
  /** 会话标签映射：convId → string[] */
  tags?: Record<string, string[]>;
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

/** 图片最大体积阈值（超过此值自动压缩） */
const IMAGE_COMPRESS_THRESHOLD = 2 * 1024 * 1024; // 2MB
/** 压缩后的最大宽/高 */
const IMAGE_MAX_DIMENSION = 1920;

/** 使用 Canvas 压缩图片（处理手机相机拍摄的超大图） */
function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    // 小于阈值的图片不压缩
    if (file.size <= IMAGE_COMPRESS_THRESHOLD) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      // 按比例缩小到最大尺寸
      if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
        const ratio = Math.min(IMAGE_MAX_DIMENSION / width, IMAGE_MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file); // 压缩后反而更大则用原图
            return;
          }
          const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
            type: 'image/jpeg',
          });
          resolve(compressed);
        },
        'image/jpeg',
        0.85,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // 加载失败则用原图
    };

    img.src = url;
  });
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

  /** 上传图片（自动压缩超大图片） */
  async uploadImage(file: File): Promise<UploadResult> {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append('file', compressed);
    const res = await api.post<UploadResult>('/chat/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /** 切换置顶会话 */
  async togglePinConversation(conversationId: string): Promise<{ pinned: boolean }> {
    const res = await api.post<{ pinned: boolean }>(`/chat/conversations/${conversationId}/pin`);
    return res.data;
  },

  /** 切换免打扰会话 */
  async toggleMuteConversation(conversationId: string): Promise<{ muted: boolean }> {
    const res = await api.post<{ muted: boolean }>(`/chat/conversations/${conversationId}/mute`);
    return res.data;
  },

  /** 切换归档会话 */
  async toggleArchiveConversation(conversationId: string): Promise<{ archived: boolean }> {
    const res = await api.post<{ archived: boolean }>(`/chat/conversations/${conversationId}/archive`);
    return res.data;
  },

  /** 删除会话 */
  async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`/chat/conversations/${conversationId}`);
  },

  /** 设置会话标签 */
  async setConversationTags(conversationId: string, tags: string[]): Promise<void> {
    await api.post(`/chat/conversations/${conversationId}/tag`, { tags });
  },

  /** 获取置顶消息列表 */
  async getPinnedMessages(conversationId: string): Promise<Message[]> {
    const res = await api.get<{ messages: Message[] }>(`/chat/conversations/${conversationId}/pinned`);
    return res.data.messages;
  },

  /** 转发消息 */
  async forwardMessage(messageId: string, targetConversationId: string): Promise<Message> {
    const res = await api.post<{ message: Message }>(`/chat/messages/${messageId}/forward`, { targetConversationId });
    return res.data.message;
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
