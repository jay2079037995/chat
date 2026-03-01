import request from 'supertest';
import { app } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('Auth API', () => {
  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('testuser');
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
    });

    it('should return 400 when username is empty', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: '', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('请输入用户名');
    });

    it('should return 400 when password is empty', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('请输入密码');
    });

    it('should return 409 when username already exists', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password456' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('用户名已被占用');
    });

    it('should store password as bcrypt hash', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });

      const redis = getRedisClient();
      const storedPassword = await redis.hget(`user:${res.body.user.id}`, 'password');
      expect(storedPassword).toBeDefined();
      expect(storedPassword).not.toBe('password123');
      expect(storedPassword!.startsWith('$2a$') || storedPassword!.startsWith('$2b$')).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.user.username).toBe('testuser');
    });

    it('should return 401 with wrong username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'wronguser', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('用户名或密码错误');
    });

    it('should return 401 with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('用户名或密码错误');
    });

    it('should create session in Redis on login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      const redis = getRedisClient();
      const userId = await redis.get(`session:${res.body.sessionId}`);
      expect(userId).toBe(res.body.user.id);
    });
  });

  describe('POST /api/auth/session (auto-login)', () => {
    let token: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });
      token = res.body.token;
    });

    it('should create new session with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/session')
        .send({ token });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.user.username).toBe('testuser');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/session')
        .send({ token: 'invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token 无效或已过期');
    });
  });

  describe('GET /api/auth/me', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });
      sessionId = res.body.sessionId;
    });

    it('should return current user with valid session', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('x-session-id', sessionId);

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('testuser');
    });

    it('should return 401 without session', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid session', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('x-session-id', 'invalid-session');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });
      sessionId = res.body.sessionId;
    });

    it('should logout successfully', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('x-session-id', sessionId);

      expect(res.status).toBe(200);
    });

    it('should invalidate session after logout', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('x-session-id', sessionId);

      const res = await request(app)
        .get('/api/auth/me')
        .set('x-session-id', sessionId);

      expect(res.status).toBe(401);
    });
  });
});
