import Redis from 'ioredis';
import { config } from '../../config';

/** Redis 客户端单例（懒加载，首次调用时创建连接） */
let redisClient: Redis | null = null;

/** 获取 Redis 客户端（单例模式，自动重连） */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected');
    });
  }

  return redisClient;
}

/** 关闭 Redis 连接（用于测试清理） */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
