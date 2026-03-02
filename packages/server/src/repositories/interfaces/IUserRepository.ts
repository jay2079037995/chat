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

  // --- 机器人相关 ---

  /** 创建机器人用户 */
  createBot(data: { id: string; username: string; token: string; ownerId: string }): Promise<User>;
  /** 通过 token 查找机器人用户 ID */
  findBotByToken(token: string): Promise<string | null>;
  /** 获取某用户拥有的所有机器人 */
  getBotsByOwner(ownerId: string): Promise<User[]>;
  /** 删除机器人 */
  deleteBot(botId: string): Promise<void>;

  // --- 用户资料 ---

  /** 更新用户资料（nickname/bio/avatar） */
  updateProfile(userId: string, updates: { nickname?: string; bio?: string; avatar?: string }): Promise<User | null>;
}
