import { getRedisClient } from './RedisClient';
import type { ISessionRepository } from '../interfaces/ISessionRepository';

// Redis Key 规则
const SESSION_KEY = (sessionId: string) => `session:${sessionId}`;      // Session → userId 映射
const USER_SESSION_KEY = (userId: string) => `user_session:${userId}`;  // userId → Session 映射（一对一）
const SESSION_TTL = 7 * 24 * 60 * 60; // Session 有效期：7 天

/**
 * Session Repository 的 Redis 实现
 *
 * 每个用户同时只允许一个有效 Session，新建 Session 时会自动销毁旧 Session。
 */
export class RedisSessionRepository implements ISessionRepository {
  /** 生成唯一 Session ID */
  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }

  /** 创建新 Session，自动销毁用户旧 Session */
  async create(userId: string): Promise<string> {
    const redis = getRedisClient();
    const sessionId = this.generateSessionId();

    // 先销毁旧 Session（一个用户只保留一个活跃 Session）
    const oldSessionId = await redis.get(USER_SESSION_KEY(userId));
    if (oldSessionId) {
      await redis.del(SESSION_KEY(oldSessionId));
    }

    await redis
      .multi()
      .set(SESSION_KEY(sessionId), userId, 'EX', SESSION_TTL)
      .set(USER_SESSION_KEY(userId), sessionId, 'EX', SESSION_TTL)
      .exec();

    return sessionId;
  }

  async validate(sessionId: string): Promise<string | null> {
    const redis = getRedisClient();
    return redis.get(SESSION_KEY(sessionId));
  }

  async destroy(sessionId: string): Promise<void> {
    const redis = getRedisClient();
    const userId = await redis.get(SESSION_KEY(sessionId));
    if (userId) {
      await redis.del(USER_SESSION_KEY(userId));
    }
    await redis.del(SESSION_KEY(sessionId));
  }

  async destroyByUserId(userId: string): Promise<void> {
    const redis = getRedisClient();
    const sessionId = await redis.get(USER_SESSION_KEY(userId));
    if (sessionId) {
      await redis.del(SESSION_KEY(sessionId));
    }
    await redis.del(USER_SESSION_KEY(userId));
  }
}
