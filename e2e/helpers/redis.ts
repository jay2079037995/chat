import Redis from 'ioredis';

const redis = new Redis({ db: 0 });

export async function flushTestData(): Promise<void> {
  await redis.flushdb();
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
