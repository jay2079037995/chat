import type { User, CreateUserDTO } from '@chat/shared';
import { getRedisClient } from './RedisClient';
import type { IUserRepository } from '../interfaces/IUserRepository';

// Redis Key 规则
const USER_KEY = (id: string) => `user:${id}`;       // 用户详情 Hash
const USERNAME_INDEX = 'index:username_to_id';         // 用户名 → ID 映射 Hash
const ALL_USERS_KEY = 'users:all';                     // 所有用户 ID 集合 Set
const BOT_TOKEN_KEY = (token: string) => `bot_token:${token}`;  // token → botId
const BOT_OWNER_KEY = (ownerId: string) => `bot_owner:${ownerId}`;  // 用户拥有的机器人集合

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
      ...(data.nickname && { nickname: data.nickname }),
      ...(data.avatar && { avatar: data.avatar }),
      ...(data.bio && { bio: data.bio }),
      ...(data.isBot === 'true' && { isBot: true }),
      ...(data.botOwnerId && { botOwnerId: data.botOwnerId }),
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
          ...(data.nickname && { nickname: data.nickname }),
          ...(data.avatar && { avatar: data.avatar }),
          ...(data.bio && { bio: data.bio }),
          ...(data.isBot === 'true' && { isBot: true }),
          ...(data.botOwnerId && { botOwnerId: data.botOwnerId }),
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

  // --- 机器人相关 ---

  async createBot(data: { id: string; username: string; token: string; ownerId: string }): Promise<User> {
    const redis = getRedisClient();
    const now = Date.now();

    const user: User = {
      id: data.id,
      username: data.username,
      isBot: true,
      botOwnerId: data.ownerId,
      createdAt: now,
      updatedAt: now,
    };

    await redis
      .multi()
      .hset(USER_KEY(data.id), {
        id: data.id,
        username: data.username,
        password: '',
        isBot: 'true',
        botOwnerId: data.ownerId,
        botToken: data.token,
        createdAt: String(now),
        updatedAt: String(now),
      })
      .hset(USERNAME_INDEX, data.username, data.id)
      .sadd(ALL_USERS_KEY, data.id)
      .set(BOT_TOKEN_KEY(data.token), data.id)
      .sadd(BOT_OWNER_KEY(data.ownerId), data.id)
      .exec();

    return user;
  }

  async findBotByToken(token: string): Promise<string | null> {
    const redis = getRedisClient();
    return redis.get(BOT_TOKEN_KEY(token));
  }

  async getBotsByOwner(ownerId: string): Promise<User[]> {
    const redis = getRedisClient();
    const botIds = await redis.smembers(BOT_OWNER_KEY(ownerId));
    const bots: User[] = [];
    for (const id of botIds) {
      const user = await this.findById(id);
      if (user && user.isBot) bots.push(user);
    }
    return bots;
  }

  // --- 用户资料 ---

  /** 更新用户资料（nickname/bio/avatar） */
  async updateProfile(userId: string, updates: { nickname?: string; bio?: string; avatar?: string }): Promise<User | null> {
    const redis = getRedisClient();
    const exists = await redis.exists(USER_KEY(userId));
    if (!exists) return null;

    const fields: Record<string, string> = { updatedAt: String(Date.now()) };
    if (updates.nickname !== undefined) fields.nickname = updates.nickname;
    if (updates.bio !== undefined) fields.bio = updates.bio;
    if (updates.avatar !== undefined) fields.avatar = updates.avatar;

    await redis.hset(USER_KEY(userId), fields);
    return this.findById(userId);
  }

  async deleteBot(botId: string): Promise<void> {
    const redis = getRedisClient();
    const data = await redis.hgetall(USER_KEY(botId));
    if (!data || data.isBot !== 'true') return;

    const { username, botToken, botOwnerId } = data;

    await redis
      .multi()
      .del(USER_KEY(botId))
      .hdel(USERNAME_INDEX, username)
      .srem(ALL_USERS_KEY, botId)
      .del(BOT_TOKEN_KEY(botToken))
      .srem(BOT_OWNER_KEY(botOwnerId), botId)
      .del(`bot_updates:${botId}`)
      .del(`bot_update_seq:${botId}`)
      .exec();
  }
}
