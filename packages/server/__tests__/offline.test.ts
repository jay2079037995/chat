import request from 'supertest';
import { app } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('Offline Message Queue', () => {
  let sessionId1: string;
  let sessionId2: string;
  let userId1: string;
  let userId2: string;
  let conversationId: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    // 注册两个测试用户
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'offlineuser1', password: 'password123' });
    sessionId1 = res1.body.sessionId;
    userId1 = res1.body.user.id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'offlineuser2', password: 'password456' });
    sessionId2 = res2.body.sessionId;
    userId2 = res2.body.user.id;

    // 创建私聊会话
    const convRes = await request(app)
      .post('/api/chat/conversations/private')
      .set('x-session-id', sessionId1)
      .send({ targetUserId: userId2 });
    conversationId = convRes.body.conversation.id;
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  it('should enqueue offline messages via rpush', async () => {
    const redis = getRedisClient();
    const key = `offline_msgs:${userId2}`;

    // 模拟为 userId2 入队一条离线消息
    const message = {
      id: 'test-msg-1',
      conversationId,
      senderId: userId1,
      type: 'text',
      content: '离线消息测试',
      createdAt: Date.now(),
    };
    await redis.rpush(key, JSON.stringify(message));

    const stored = await redis.lrange(key, 0, -1);
    expect(stored.length).toBe(1);
    expect(JSON.parse(stored[0]).content).toBe('离线消息测试');
  });

  it('should preserve order for multiple offline messages', async () => {
    const redis = getRedisClient();
    const key = `offline_msgs:${userId2}`;

    const now = Date.now();
    const messages = [
      { id: 'msg-a', conversationId, senderId: userId1, type: 'text', content: '第一条', createdAt: now },
      { id: 'msg-b', conversationId, senderId: userId1, type: 'text', content: '第二条', createdAt: now + 1 },
      { id: 'msg-c', conversationId, senderId: userId1, type: 'text', content: '第三条', createdAt: now + 2 },
    ];

    for (const msg of messages) {
      await redis.rpush(key, JSON.stringify(msg));
    }

    const stored = await redis.lrange(key, 0, -1);
    expect(stored.length).toBe(3);

    const parsed = stored.map((r) => JSON.parse(r));
    expect(parsed[0].content).toBe('第一条');
    expect(parsed[1].content).toBe('第二条');
    expect(parsed[2].content).toBe('第三条');
  });

  it('should clear queue after retrieval (lrange + del)', async () => {
    const redis = getRedisClient();
    const key = `offline_msgs:${userId2}`;

    await redis.rpush(key, JSON.stringify({ id: 'msg-x', content: '待推送' }));
    await redis.rpush(key, JSON.stringify({ id: 'msg-y', content: '待推送2' }));

    // 模拟推送流程：读取所有 → 删除队列
    const rawMsgs = await redis.lrange(key, 0, -1);
    expect(rawMsgs.length).toBe(2);

    await redis.del(key);

    const remaining = await redis.lrange(key, 0, -1);
    expect(remaining.length).toBe(0);
  });
});
