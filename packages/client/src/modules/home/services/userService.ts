/**
 * 用户服务 —— 封装与 /api/users 相关的 HTTP 请求
 */
import type { User } from '@chat/shared';
import { api } from '../../../services/api';

export const userService = {
  /** 按关键词搜索用户（模糊匹配用户名） */
  async search(query: string): Promise<User[]> {
    const res = await api.get<{ users: User[] }>('/users/search', {
      params: { q: query },
    });
    return res.data.users;
  },
};
