import type { User } from '@chat/shared';
import { api } from '../../../services/api';

export const userService = {
  async search(query: string): Promise<User[]> {
    const res = await api.get<{ users: User[] }>('/users/search', {
      params: { q: query },
    });
    return res.data.users;
  },
};
