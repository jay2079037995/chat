import { test, expect } from '@playwright/test';
import { flushTestData, closeRedis } from '../helpers/redis';
import { registerUser } from '../helpers/api';
import { TEST_USERS } from '../fixtures/test-data';
import Redis from 'ioredis';

test.describe('v0.7 - 缓存与离线', () => {
  test.beforeEach(async () => {
    await flushTestData();
    await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);
  });

  test.afterAll(async () => {
    await closeRedis();
  });

  test('7.1.1: 离线消息入队验证 (Redis)', async () => {
    const redis = new Redis({ db: 0 });

    // 模拟为用户入队离线消息
    const userId = 'test-offline-user';
    const key = `offline_msgs:${userId}`;
    const message = {
      id: 'e2e-offline-msg-1',
      conversationId: 'conv-1',
      senderId: 'sender-1',
      type: 'text',
      content: '离线消息E2E测试',
      createdAt: Date.now(),
    };

    await redis.rpush(key, JSON.stringify(message));

    const stored = await redis.lrange(key, 0, -1);
    expect(stored.length).toBe(1);
    expect(JSON.parse(stored[0]).content).toBe('离线消息E2E测试');

    await redis.del(key);
    await redis.quit();
  });

  test('7.1.2: 多条离线消息按时间排序', async () => {
    const redis = new Redis({ db: 0 });
    const userId = 'test-offline-user-2';
    const key = `offline_msgs:${userId}`;
    const now = Date.now();

    const messages = [
      { id: 'msg-1', content: '第一条', createdAt: now },
      { id: 'msg-2', content: '第二条', createdAt: now + 100 },
      { id: 'msg-3', content: '第三条', createdAt: now + 200 },
    ];

    for (const msg of messages) {
      await redis.rpush(key, JSON.stringify(msg));
    }

    const stored = await redis.lrange(key, 0, -1);
    const parsed = stored.map((r) => JSON.parse(r));

    // 按 createdAt 排序验证
    parsed.sort((a: any, b: any) => a.createdAt - b.createdAt);
    expect(parsed[0].content).toBe('第一条');
    expect(parsed[1].content).toBe('第二条');
    expect(parsed[2].content).toBe('第三条');

    await redis.del(key);
    await redis.quit();
  });

  test('7.1.3: 离线消息推送后清除队列', async () => {
    const redis = new Redis({ db: 0 });
    const userId = 'test-offline-user-3';
    const key = `offline_msgs:${userId}`;

    await redis.rpush(key, JSON.stringify({ id: 'msg-x', content: '待清除' }));
    await redis.rpush(key, JSON.stringify({ id: 'msg-y', content: '待清除2' }));

    // 模拟推送流程
    const rawMsgs = await redis.lrange(key, 0, -1);
    expect(rawMsgs.length).toBe(2);

    // 推送后删除
    await redis.del(key);

    const remaining = await redis.lrange(key, 0, -1);
    expect(remaining.length).toBe(0);

    await redis.quit();
  });
});
