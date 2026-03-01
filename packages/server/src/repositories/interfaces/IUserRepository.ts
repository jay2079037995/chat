import type { User, CreateUserDTO } from '@chat/shared';

/** 用户数据访问接口（Repository 模式，便于切换 Redis/MongoDB 实现） */
export interface IUserRepository {
  /** 创建用户 */
  create(data: CreateUserDTO & { id: string; hashedPassword: string }): Promise<User>;
  /** 按 ID 查找用户 */
  findById(id: string): Promise<User | null>;
  /** 按用户名查找用户 */
  findByUsername(username: string): Promise<User | null>;
  /** 按关键词搜索用户（模糊匹配用户名） */
  search(keyword: string): Promise<User[]>;
  /** 获取用户密码哈希（用于登录校验） */
  getPasswordHash(userId: string): Promise<string | null>;
}
