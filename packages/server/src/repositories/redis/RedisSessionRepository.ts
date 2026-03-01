import { getRedisClient } from './RedisClient';
import type { ISessionRepository } from '../interfaces/ISessionRepository';

const SESSION_KEY = (sessionId: string) => `session:${sessionId}`;
const USER_SESSION_KEY = (userId: string) => `user_session:${userId}`;
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days

export class RedisSessionRepository implements ISessionRepository {
  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }

  async create(userId: string): Promise<string> {
    const redis = getRedisClient();
    const sessionId = this.generateSessionId();

    // Destroy old session if exists
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
