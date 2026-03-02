import request from 'supertest';
import { app } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('Search & History API', () => {
  let sessionId1: string;
  let sessionId2: string;
  let sessionId3: string;
  let userId1: string;
  let userId2: string;
  let userId3: string;
  let conversationId: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    // 注册三个测试用户
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'searchuser1', password: 'password123' });
    sessionId1 = res1.body.sessionId;
    userId1 = res1.body.user.id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'searchuser2', password: 'password456' });
    sessionId2 = res2.body.sessionId;
    userId2 = res2.body.user.id;

    const res3 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'searchuser3', password: 'password789' });
    sessionId3 = res3.body.sessionId;
    userId3 = res3.body.user.id;

    // 创建私聊会话并发送几条消息
    const convRes = await request(app)
      .post('/api/chat/conversations/private')
      .set('x-session-id', sessionId1)
      .send({ targetUserId: userId2 });
    conversationId = convRes.body.conversation.id;

    // 通过 Socket 或直接插入消息（用 Redis 直接写入更简单）
    // 使用 API 发送消息的替代方式：直接通过 Redis 写入
    const redis2 = getRedisClient();
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const msgId = `msg-${i}`;
      const content = i === 0 ? '你好世界' : i === 1 ? '这是测试消息' : '另一条消息';
      await redis2.hset(`msg:${msgId}`, {
        id: msgId,
        conversationId,
        senderId: userId1,
        type: 'text',
        content,
        createdAt: (now + i).toString(),
      });
      await redis2.zadd(`conv_msgs:${conversationId}`, now + i, msgId);
    }
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  describe('GET /api/chat/messages/search', () => {
    it('should return matching messages', async () => {
      const res = await request(app)
        .get('/api/chat/messages/search')
        .query({ q: '你好' })
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.messages).toBeDefined();
      expect(res.body.messages.length).toBeGreaterThan(0);
      expect(res.body.messages.some((m: any) => m.content.includes('你好'))).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const res = await request(app)
        .get('/api/chat/messages/search')
        .query({ q: '不存在的关键词xyz' })
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
    });

    it('should return 400 for empty keyword', async () => {
      const res = await request(app)
        .get('/api/chat/messages/search')
        .query({ q: '' })
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing keyword', async () => {
      const res = await request(app)
        .get('/api/chat/messages/search')
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(400);
    });

    it('should only return messages from own conversations', async () => {
      // user3 没有参与任何会话，搜索应返回空
      const res = await request(app)
        .get('/api/chat/messages/search')
        .query({ q: '你好' })
        .set('x-session-id', sessionId3);

      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
    });
  });

  describe('GET /api/chat/conversations/:id/messages (permission)', () => {
    it('should return messages for participant', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}/messages`)
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.messages).toBeDefined();
    });

    it('should return 403 for non-participant', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}/messages`)
        .set('x-session-id', sessionId3);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent conversation', async () => {
      const res = await request(app)
        .get('/api/chat/conversations/nonexistent/messages')
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(404);
    });

    it('should support offset pagination', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}/messages`)
        .query({ offset: 0, limit: 2 })
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBeLessThanOrEqual(2);
    });

    it('should return empty for offset beyond messages', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}/messages`)
        .query({ offset: 1000 })
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
    });
  });
});
