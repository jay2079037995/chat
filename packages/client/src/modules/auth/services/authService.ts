/**
 * 认证服务 —— 封装所有与 /api/auth 相关的 HTTP 请求
 */
import type { User } from '@chat/shared';
import { api } from '../../../services/api';

/** 登录/注册接口返回体 */
interface AuthResponse {
  token: string;
  user: User;
  sessionId: string;
}

/** 会话创建接口返回体 */
interface SessionResponse {
  user: User;
  sessionId: string;
}

export const authService = {
  /** 用户注册 */
  async register(username: string, password: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/register', { username, password });
    return res.data;
  },

  /** 用户登录 */
  async login(username: string, password: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/login', { username, password });
    return res.data;
  },

  /** 用 JWT token 创建新会话（用于自动登录） */
  async createSession(token: string): Promise<SessionResponse> {
    const res = await api.post<SessionResponse>('/auth/session', { token });
    return res.data;
  },

  /** 获取当前登录用户信息 */
  async getMe(): Promise<{ user: User }> {
    const res = await api.get<{ user: User }>('/auth/me');
    return res.data;
  },

  /** 退出登录 */
  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  /** 更新用户资料（nickname/bio） */
  async updateProfile(data: { nickname?: string; bio?: string }): Promise<{ user: User }> {
    const res = await api.put<{ user: User }>('/auth/profile', data);
    return res.data;
  },

  /** 上传头像 */
  async uploadAvatar(file: File): Promise<{ user: User; avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ user: User; avatarUrl: string }>('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
