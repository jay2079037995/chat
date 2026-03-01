import type { User, CreateUserDTO } from '@chat/shared';
import { getRedisClient } from './RedisClient';
import type { IUserRepository } from '../interfaces/IUserRepository';

// Redis Key 规则
const USER_KEY = (id: string) => `user:${id}`;       // 用户详情 Hash
const USERNAME_INDEX = 'index:username_to_id';         // 用户名 → ID 映射 Hash
const ALL_USERS_KEY = 'users:all';                     // 所有用户 ID 集合 Set

/**
 * 用户 Repository 的 Redis 实现
 *
 * 数据结构：
 * - user:{id} — Hash，存储用户信息（id, username, password, createdAt, updatedAt）
 * - index:username_to_id — Hash，用户名到 ID 的索引
 * - users:all — Set，所有用户 ID（用于搜索遍历）
 */
export class RedisUserRepository implements IUserRepository {
  /** 创建用户：使用事务同时写入用户 Hash、用户名索引、用户 ID 集合 */
  async create(data: CreateUserDTO & { id: string; hashedPassword: string }): Promise<User> {
    const redis = getRedisClient();
    const now = Date.now();

    const user: User = {
      id: data.id,
      username: data.username,
      createdAt: now,
      updatedAt: now,
    };

    await redis
      .multi()
      .hset(USER_KEY(data.id), {
        id: data.id,
        username: data.username,
        password: data.hashedPassword,
        createdAt: String(now),
        updatedAt: String(now),
      })
      .hset(USERNAME_INDEX, data.username, data.id)
      .sadd(ALL_USERS_KEY, data.id)
      .exec();

    return user;
  }

  async findById(id: string): Promise<User | null> {
    const redis = getRedisClient();
    const data = await redis.hgetall(USER_KEY(id));
    if (!data || !data.id) return null;

    return {
      id: data.id,
      username: data.username,
      createdAt: parseInt(data.createdAt, 10),
      updatedAt: parseInt(data.updatedAt, 10),
    };
  }

  async findByUsername(username: string): Promise<User | null> {
    const redis = getRedisClient();
    const id = await redis.hget(USERNAME_INDEX, username);
    if (!id) return null;
    return this.findById(id);
  }

  /** 搜索用户：遍历所有用户，按用户名模糊匹配（大数据量时需优化为索引搜索） */
  async search(keyword: string): Promise<User[]> {
    const redis = getRedisClient();
    const allUserIds = await redis.smembers(ALL_USERS_KEY);

    const users: User[] = [];
    for (const id of allUserIds) {
      const data = await redis.hgetall(USER_KEY(id));
      if (data && data.username && data.username.toLowerCase().includes(keyword.toLowerCase())) {
        users.push({
          id: data.id,
          username: data.username,
          createdAt: parseInt(data.createdAt, 10),
          updatedAt: parseInt(data.updatedAt, 10),
        });
      }
    }

    return users;
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    const redis = getRedisClient();
    return redis.hget(USER_KEY(userId), 'password');
  }
}
