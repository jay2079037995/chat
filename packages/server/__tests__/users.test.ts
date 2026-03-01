import request from 'supertest';
import { app } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('Users API', () => {
  let sessionId: string;
  let userId: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    // Register test user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'searcher', password: 'password123' });
    sessionId = res.body.sessionId;
    userId = res.body.user.id;

    // Register some users to search
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'password123' });
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', password: 'password123' });
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice_wang', password: 'password123' });
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  describe('GET /api/users/search', () => {
    it('should return matching users', async () => {
      const res = await request(app)
        .get('/api/users/search?q=alice')
        .set('x-session-id', sessionId);

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(2);
      expect(res.body.users.map((u: { username: string }) => u.username)).toContain('alice');
      expect(res.body.users.map((u: { username: string }) => u.username)).toContain('alice_wang');
    });

    it('should return empty array when no match', async () => {
      const res = await request(app)
        .get('/api/users/search?q=nonexistent')
        .set('x-session-id', sessionId);

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(0);
    });

    it('should exclude current user from results', async () => {
      const res = await request(app)
        .get('/api/users/search?q=searcher')
        .set('x-session-id', sessionId);

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(0);
    });

    it('should return 401 without session', async () => {
      const res = await request(app)
        .get('/api/users/search?q=alice');

      expect(res.status).toBe(401);
    });

    it('should return 400 with empty query', async () => {
      const res = await request(app)
        .get('/api/users/search?q=')
        .set('x-session-id', sessionId);

      expect(res.status).toBe(400);
    });
  });
});
