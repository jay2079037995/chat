import type { User } from '@chat/shared';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';

export class UserService {
  constructor(private userRepo: IUserRepository) {}

  async search(keyword: string, excludeUserId?: string): Promise<User[]> {
    const users = await this.userRepo.search(keyword);
    if (excludeUserId) {
      return users.filter((u) => u.id !== excludeUserId);
    }
    return users;
  }
}
