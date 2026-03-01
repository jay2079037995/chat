import type { User } from '@chat/shared';
import { RedisUserRepository } from '../repositories/redis/RedisUserRepository';

const userRepo = new RedisUserRepository();

export class UserService {
  async search(keyword: string, excludeUserId?: string): Promise<User[]> {
    const users = await userRepo.search(keyword);
    if (excludeUserId) {
      return users.filter((u) => u.id !== excludeUserId);
    }
    return users;
  }
}
