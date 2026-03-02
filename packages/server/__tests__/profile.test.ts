import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app';
// path/fs kept for afterAll cleanup
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('Profile API', () => {
  let token: string;
  let sessionId: string;
  let userId: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    // 注册并登录
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'profileuser', password: 'password123' });
    token = res.body.token;
    sessionId = res.body.sessionId;
    userId = res.body.user.id;
  });

  afterAll(async () => {
    // 清理测试上传文件
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }
    await closeRedisClient();
  });

  describe('PUT /api/auth/profile', () => {
    it('should update nickname and bio', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('x-session-id', sessionId)
        .send({ nickname: '测试昵称', bio: '这是我的简介' });

      expect(res.status).toBe(200);
      expect(res.body.user.nickname).toBe('测试昵称');
      expect(res.body.user.bio).toBe('这是我的简介');
    });

    it('should update only nickname', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('x-session-id', sessionId)
        .send({ nickname: '仅昵称' });

      expect(res.status).toBe(200);
      expect(res.body.user.nickname).toBe('仅昵称');
    });

    it('should reject nickname exceeding max length', async () => {
      const longName = 'a'.repeat(31);
      const res = await request(app)
        .put('/api/auth/profile')
        .set('x-session-id', sessionId)
        .send({ nickname: longName });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject bio exceeding max length', async () => {
      const longBio = 'a'.repeat(201);
      const res = await request(app)
        .put('/api/auth/profile')
        .set('x-session-id', sessionId)
        .send({ bio: longBio });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 401 without session', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ nickname: 'test' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/avatar', () => {
    it('should upload avatar successfully', async () => {
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      const res = await request(app)
        .post('/api/auth/avatar')
        .set('x-session-id', sessionId)
        .attach('file', pngBuffer, { filename: 'avatar.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.avatar).toBeDefined();
    });

    it('should return 401 without session', async () => {
      const res = await request(app)
        .post('/api/auth/avatar');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/user/:id', () => {
    it('should return user profile', async () => {
      const res = await request(app)
        .get(`/api/auth/user/${userId}`)
        .set('x-session-id', sessionId);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('profileuser');
      expect(res.body.user.id).toBe(userId);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/auth/user/nonexistent-id')
        .set('x-session-id', sessionId);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('用户不存在');
    });

    it('should return 401 without session', async () => {
      const res = await request(app)
        .get(`/api/auth/user/${userId}`);

      expect(res.status).toBe(401);
    });
  });
});
