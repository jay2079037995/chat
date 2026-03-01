import request from 'supertest';
import { app } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('Chat API', () => {
  let sessionId1: string;
  let sessionId2: string;
  let userId1: string;
  let userId2: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    // 注册两个测试用户
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'chatuser1', password: 'password123' });
    sessionId1 = res1.body.sessionId;
    userId1 = res1.body.user.id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'chatuser2', password: 'password456' });
    sessionId2 = res2.body.sessionId;
    userId2 = res2.body.user.id;
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  describe('POST /api/chat/conversations/private', () => {
    it('should create a private conversation', async () => {
      const res = await request(app)
        .post('/api/chat/conversations/private')
        .set('x-session-id', sessionId1)
        .send({ targetUserId: userId2 });

      expect(res.status).toBe(200);
      expect(res.body.conversation).toBeDefined();
      expect(res.body.conversation.type).toBe('private');
      expect(res.body.conversation.participants).toContain(userId1);
      expect(res.body.conversation.participants).toContain(userId2);
      expect(res.body.participantNames).toBeDefined();
      expect(res.body.participantNames[userId1]).toBe('chatuser1');
      expect(res.body.participantNames[userId2]).toBe('chatuser2');
    });

    it('should return same conversation for same pair', async () => {
      const res1 = await request(app)
        .post('/api/chat/conversations/private')
        .set('x-session-id', sessionId1)
        .send({ targetUserId: userId2 });

      const res2 = await request(app)
        .post('/api/chat/conversations/private')
        .set('x-session-id', sessionId2)
        .send({ targetUserId: userId1 });

      expect(res1.body.conversation.id).toBe(res2.body.conversation.id);
    });

    it('should return 400 when targetUserId is missing', async () => {
      const res = await request(app)
        .post('/api/chat/conversations/private')
        .set('x-session-id', sessionId1)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 when chatting with self', async () => {
      const res = await request(app)
        .post('/api/chat/conversations/private')
        .set('x-session-id', sessionId1)
        .send({ targetUserId: userId1 });

      expect(res.status).toBe(400);
    });

    it('should return 404 when target user not found', async () => {
      const res = await request(app)
        .post('/api/chat/conversations/private')
        .set('x-session-id', sessionId1)
        .send({ targetUserId: 'nonexistent' });

      expect(res.status).toBe(404);
    });

    it('should return 401 without session', async () => {
      const res = await request(app)
        .post('/api/chat/conversations/private')
        .send({ targetUserId: userId2 });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/chat/conversations', () => {
    it('should return empty list initially', async () => {
      const res = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toEqual([]);
    });

    it('should return conversations after creating one', async () => {
      // 创建会话
      await request(app)
        .post('/api/chat/conversations/private')
        .set('x-session-id', sessionId1)
        .send({ targetUserId: userId2 });

      const res = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(1);
      expect(res.body.conversations[0].type).toBe('private');
      expect(res.body.participantNames).toBeDefined();
    });
  });

  describe('GET /api/chat/conversations/:id/messages', () => {
    it('should return empty messages for new conversation', async () => {
      const createRes = await request(app)
        .post('/api/chat/conversations/private')
        .set('x-session-id', sessionId1)
        .send({ targetUserId: userId2 });

      const convId = createRes.body.conversation.id;

      const res = await request(app)
        .get(`/api/chat/conversations/${convId}/messages`)
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
    });
  });

  describe('POST /api/chat/conversations/:id/read', () => {
    it('should mark conversation as read', async () => {
      const createRes = await request(app)
        .post('/api/chat/conversations/private')
        .set('x-session-id', sessionId1)
        .send({ targetUserId: userId2 });

      const convId = createRes.body.conversation.id;

      const res = await request(app)
        .post(`/api/chat/conversations/${convId}/read`)
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
