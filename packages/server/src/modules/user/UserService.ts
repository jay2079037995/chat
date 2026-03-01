import type { User } from '@chat/shared';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';

/**
 * 用户服务
 *
 * 处理用户搜索等业务逻辑。通过构造函数注入 Repository 依赖。
 */
export class UserService {
  constructor(private userRepo: IUserRepository) {}

  /** 按关键词搜索用户，可排除指定用户（当前登录用户） */
  async search(keyword: string, excludeUserId?: string): Promise<User[]> {
    const users = await this.userRepo.search(keyword);
    if (excludeUserId) {
      return users.filter((u) => u.id !== excludeUserId);
    }
    return users;
  }
}
