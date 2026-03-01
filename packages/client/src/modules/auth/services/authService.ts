import type { User } from '@chat/shared';
import { api } from '../../../services/api';

interface AuthResponse {
  token: string;
  user: User;
  sessionId: string;
}

interface SessionResponse {
  user: User;
  sessionId: string;
}

export const authService = {
  async register(username: string, password: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/register', { username, password });
    return res.data;
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/login', { username, password });
    return res.data;
  },

  async createSession(token: string): Promise<SessionResponse> {
    const res = await api.post<SessionResponse>('/auth/session', { token });
    return res.data;
  },

  async getMe(): Promise<{ user: User }> {
    const res = await api.get<{ user: User }>('/auth/me');
    return res.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};
