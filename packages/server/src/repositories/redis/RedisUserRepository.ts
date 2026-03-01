import type { User, CreateUserDTO } from '@chat/shared';
import { getRedisClient } from './RedisClient';
import type { IUserRepository } from '../interfaces/IUserRepository';

const USER_KEY = (id: string) => `user:${id}`;
const USERNAME_INDEX = 'index:username_to_id';
const ALL_USERS_KEY = 'users:all';

export class RedisUserRepository implements IUserRepository {
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
