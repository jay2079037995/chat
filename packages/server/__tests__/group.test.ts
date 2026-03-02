import request from 'supertest';
import { app } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('Group API', () => {
  let sessionId1: string;
  let sessionId2: string;
  let sessionId3: string;
  let userId1: string;
  let userId2: string;
  let userId3: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    // 注册三个测试用户
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'groupuser1', password: 'password123' });
    sessionId1 = res1.body.sessionId;
    userId1 = res1.body.user.id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'groupuser2', password: 'password456' });
    sessionId2 = res2.body.sessionId;
    userId2 = res2.body.user.id;

    const res3 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'groupuser3', password: 'password789' });
    sessionId3 = res3.body.sessionId;
    userId3 = res3.body.user.id;
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  describe('POST /api/group', () => {
    it('should create a group', async () => {
      const res = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '测试群组', memberIds: [userId2, userId3] });

      expect(res.status).toBe(200);
      expect(res.body.group).toBeDefined();
      expect(res.body.group.name).toBe('测试群组');
      expect(res.body.group.ownerId).toBe(userId1);
      expect(res.body.group.members).toContain(userId1);
      expect(res.body.group.members).toContain(userId2);
      expect(res.body.group.members).toContain(userId3);
      expect(res.body.conversation).toBeDefined();
      expect(res.body.conversation.type).toBe('group');
      expect(res.body.participantNames).toBeDefined();
    });

    it('should return 400 for empty group name', async () => {
      const res = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '', memberIds: [userId2] });

      expect(res.status).toBe(400);
    });

    it('should return 400 for group name too short', async () => {
      const res = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: 'A', memberIds: [userId2] });

      expect(res.status).toBe(400);
    });

    it('should return 400 for empty memberIds', async () => {
      const res = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '测试群组', memberIds: [] });

      expect(res.status).toBe(400);
    });

    it('should return 401 without session', async () => {
      const res = await request(app)
        .post('/api/group')
        .send({ name: '测试群组', memberIds: [userId2] });

      expect(res.status).toBe(401);
    });

    it('should auto-include creator as member and owner', async () => {
      const res = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '测试群组', memberIds: [userId2] });

      expect(res.body.group.ownerId).toBe(userId1);
      expect(res.body.group.members).toContain(userId1);
    });
  });

  describe('GET /api/group/:id', () => {
    it('should return group info', async () => {
      const createRes = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '测试群组', memberIds: [userId2, userId3] });

      const groupId = createRes.body.group.id;

      const res = await request(app)
        .get(`/api/group/${groupId}`)
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.group).toBeDefined();
      expect(res.body.group.name).toBe('测试群组');
      expect(res.body.memberNames).toBeDefined();
    });
  });

  describe('POST /api/group/:id/members', () => {
    let groupId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '双人群', memberIds: [userId2] });
      groupId = createRes.body.group.id;
    });

    it('should add a member (owner only)', async () => {
      const res = await request(app)
        .post(`/api/group/${groupId}/members`)
        .set('x-session-id', sessionId1)
        .send({ userId: userId3 });

      expect(res.status).toBe(200);
      expect(res.body.group.members).toContain(userId3);
    });

    it('should return 409 for duplicate member', async () => {
      const res = await request(app)
        .post(`/api/group/${groupId}/members`)
        .set('x-session-id', sessionId1)
        .send({ userId: userId2 });

      expect(res.status).toBe(409);
    });

    it('should return 403 for non-owner', async () => {
      const res = await request(app)
        .post(`/api/group/${groupId}/members`)
        .set('x-session-id', sessionId2)
        .send({ userId: userId3 });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/group/:id/members/:userId', () => {
    let groupId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '三人群', memberIds: [userId2, userId3] });
      groupId = createRes.body.group.id;
    });

    it('should remove a member (owner only)', async () => {
      const res = await request(app)
        .delete(`/api/group/${groupId}/members/${userId3}`)
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.group.members).not.toContain(userId3);
    });

    it('should return 403 for non-owner', async () => {
      const res = await request(app)
        .delete(`/api/group/${groupId}/members/${userId3}`)
        .set('x-session-id', sessionId2);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/group/:id/leave', () => {
    let groupId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '退出测试群', memberIds: [userId2, userId3] });
      groupId = createRes.body.group.id;
    });

    it('should allow member to leave group', async () => {
      const res = await request(app)
        .post(`/api/group/${groupId}/leave`)
        .set('x-session-id', sessionId2);

      expect(res.status).toBe(200);
      expect(res.body.group.members).not.toContain(userId2);
    });

    it('should return 400 when owner tries to leave', async () => {
      const res = await request(app)
        .post(`/api/group/${groupId}/leave`)
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-member', async () => {
      // 先让 user3 退出
      await request(app)
        .post(`/api/group/${groupId}/leave`)
        .set('x-session-id', sessionId3);

      // 再次退出应 404
      const res = await request(app)
        .post(`/api/group/${groupId}/leave`)
        .set('x-session-id', sessionId3);

      expect(res.status).toBe(404);
    });

    it('should remove group from leaver conversation list', async () => {
      await request(app)
        .post(`/api/group/${groupId}/leave`)
        .set('x-session-id', sessionId2);

      const res = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId2);

      expect(res.body.conversations.some((c: any) => c.id === groupId)).toBe(false);
    });
  });

  describe('DELETE /api/group/:id', () => {
    let groupId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '解散测试群', memberIds: [userId2, userId3] });
      groupId = createRes.body.group.id;
    });

    it('should allow owner to dissolve group', async () => {
      const res = await request(app)
        .delete(`/api/group/${groupId}`)
        .set('x-session-id', sessionId1);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 for non-owner', async () => {
      const res = await request(app)
        .delete(`/api/group/${groupId}`)
        .set('x-session-id', sessionId2);

      expect(res.status).toBe(403);
    });

    it('should remove group from all members conversation lists', async () => {
      await request(app)
        .delete(`/api/group/${groupId}`)
        .set('x-session-id', sessionId1);

      const res1 = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId1);
      expect(res1.body.conversations.some((c: any) => c.id === groupId)).toBe(false);

      const res2 = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId2);
      expect(res2.body.conversations.some((c: any) => c.id === groupId)).toBe(false);

      const res3 = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId3);
      expect(res3.body.conversations.some((c: any) => c.id === groupId)).toBe(false);
    });
  });

  describe('Group in conversation list', () => {
    it('should show group in conversation list for all members', async () => {
      await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '群组可见测试', memberIds: [userId2, userId3] });

      // 所有成员都应该能看到群组
      const res1 = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId1);
      expect(res1.body.conversations.some((c: any) => c.type === 'group')).toBe(true);
      expect(res1.body.groupNames).toBeDefined();

      const res2 = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId2);
      expect(res2.body.conversations.some((c: any) => c.type === 'group')).toBe(true);

      const res3 = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId3);
      expect(res3.body.conversations.some((c: any) => c.type === 'group')).toBe(true);
    });

    it('should not show group for removed member', async () => {
      const createRes = await request(app)
        .post('/api/group')
        .set('x-session-id', sessionId1)
        .send({ name: '移除测试群', memberIds: [userId2, userId3] });

      const groupId = createRes.body.group.id;

      // 移除 userId3
      await request(app)
        .delete(`/api/group/${groupId}/members/${userId3}`)
        .set('x-session-id', sessionId1);

      // userId3 不应该看到群组
      const res = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId3);
      expect(res.body.conversations.some((c: any) => c.type === 'group')).toBe(false);
    });
  });
});
