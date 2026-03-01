import Redis from 'ioredis';

/**
 * 清空测试数据 — 每次调用创建独立连接，避免跨测试文件的连接关闭问题
 */
export async function flushTestData(): Promise<void> {
  const redis = new Redis({ db: 0 });
  await redis.flushdb();
  await redis.quit();
}

/**
 * 关闭 Redis 连接 — 已改为无操作（连接在 flushTestData 中自动管理）
 */
export async function closeRedis(): Promise<void> {
  // no-op: 每次操作使用独立连接，无需全局关闭
}
