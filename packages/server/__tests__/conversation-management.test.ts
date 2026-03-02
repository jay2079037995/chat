/**
 * 会话管理 API 测试
 *
 * 测试置顶/免打扰/归档/删除/标签/消息置顶/消息转发接口。
 */
import request from 'supertest';
import { app } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';
import { RedisMessageRepository } from '../src/repositories/redis/RedisMessageRepository';
import { RedisUserRepository } from '../src/repositories/redis/RedisUserRepository';
import { ChatService } from '../src/modules/chat/ChatService';
import type { Message } from '@chat/shared';

describe('Conversation Management API', () => {
  let sessionId1: string;
  let sessionId2: string;
  let userId1: string;
  let userId2: string;
  let conversationId: string;
  let messageRepo: RedisMessageRepository;
  let userRepo: RedisUserRepository;
  let chatService: ChatService;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    messageRepo = new RedisMessageRepository();
    userRepo = new RedisUserRepository();
    chatService = new ChatService(messageRepo, userRepo);

    // 注册两个测试用户
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'mgmtuser1', password: 'password123' });
    sessionId1 = res1.body.sessionId;
    userId1 = res1.body.user.id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'mgmtuser2', password: 'password456' });
    sessionId2 = res2.body.sessionId;
    userId2 = res2.body.user.id;

    // 创建会话
    const convRes = await request(app)
      .post('/api/chat/conversations/private')
      .set('x-session-id', sessionId1)
      .send({ targetUserId: userId2 });
    conversationId = convRes.body.conversation.id;
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  // ---------- 置顶 ----------
  describe('POST /api/chat/conversations/:id/pin', () => {
    it('should toggle pin on', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/pin`)
        .set('x-session-id', sessionId1);
      expect(res.status).toBe(200);
      expect(res.body.pinned).toBe(true);
    });

    it('should toggle pin off', async () => {
      await request(app)
        .post(`/api/chat/conversations/${conversationId}/pin`)
        .set('x-session-id', sessionId1);
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/pin`)
        .set('x-session-id', sessionId1);
      expect(res.status).toBe(200);
      expect(res.body.pinned).toBe(false);
    });

    it('should return 403 for non-participant', async () => {
      const res3 = await request(app)
        .post('/api/auth/register')
        .send({ username: 'outsider', password: 'password789' });
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/pin`)
        .set('x-session-id', res3.body.sessionId);
      expect(res.status).toBe(403);
    });
  });

  // ---------- 免打扰 ----------
  describe('POST /api/chat/conversations/:id/mute', () => {
    it('should toggle mute on', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/mute`)
        .set('x-session-id', sessionId1);
      expect(res.status).toBe(200);
      expect(res.body.muted).toBe(true);
    });

    it('should toggle mute off', async () => {
      await request(app)
        .post(`/api/chat/conversations/${conversationId}/mute`)
        .set('x-session-id', sessionId1);
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/mute`)
        .set('x-session-id', sessionId1);
      expect(res.status).toBe(200);
      expect(res.body.muted).toBe(false);
    });
  });

  // ---------- 归档 ----------
  describe('POST /api/chat/conversations/:id/archive', () => {
    it('should toggle archive on', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/archive`)
        .set('x-session-id', sessionId1);
      expect(res.status).toBe(200);
      expect(res.body.archived).toBe(true);
    });

    it('should toggle archive off', async () => {
      await request(app)
        .post(`/api/chat/conversations/${conversationId}/archive`)
        .set('x-session-id', sessionId1);
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/archive`)
        .set('x-session-id', sessionId1);
      expect(res.status).toBe(200);
      expect(res.body.archived).toBe(false);
    });
  });

  // ---------- 删除 ----------
  describe('DELETE /api/chat/conversations/:id', () => {
    it('should soft-delete for user', async () => {
      const res = await request(app)
        .delete(`/api/chat/conversations/${conversationId}`)
        .set('x-session-id', sessionId1);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should not affect other user after deletion', async () => {
      await request(app)
        .delete(`/api/chat/conversations/${conversationId}`)
        .set('x-session-id', sessionId1);

      // 另一用户仍然可以看到该会话
      const res = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId2);
      expect(res.status).toBe(200);
      const convIds = res.body.conversations.map((c: any) => c.id);
      expect(convIds).toContain(conversationId);
    });
  });

  // ---------- 标签 ----------
  describe('POST /api/chat/conversations/:id/tag', () => {
    it('should set tags', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/tag`)
        .set('x-session-id', sessionId1)
        .send({ tags: ['工作', '重要'] });
      expect(res.status).toBe(200);
      expect(res.body.tags).toEqual(['工作', '重要']);
    });

    it('should replace tags', async () => {
      await request(app)
        .post(`/api/chat/conversations/${conversationId}/tag`)
        .set('x-session-id', sessionId1)
        .send({ tags: ['工作'] });
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/tag`)
        .set('x-session-id', sessionId1)
        .send({ tags: ['生活'] });
      expect(res.body.tags).toEqual(['生活']);
    });

    it('should reject too many tags', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/tag`)
        .set('x-session-id', sessionId1)
        .send({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
      expect(res.status).toBe(400);
    });

    it('should reject too long tag', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/tag`)
        .set('x-session-id', sessionId1)
        .send({ tags: ['a'.repeat(21)] });
      expect(res.status).toBe(400);
    });
  });

  // ---------- 置顶消息 ----------
  describe('GET /api/chat/conversations/:id/pinned', () => {
    it('should return empty list initially', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}/pinned`)
        .set('x-session-id', sessionId1);
      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
    });
  });

  // ---------- GET conversations 增强 ----------
  describe('GET /api/chat/conversations (enhanced)', () => {
    it('should include pinnedIds, mutedIds, archivedIds, tags', async () => {
      // 设置一些状态
      await request(app)
        .post(`/api/chat/conversations/${conversationId}/pin`)
        .set('x-session-id', sessionId1);
      await request(app)
        .post(`/api/chat/conversations/${conversationId}/tag`)
        .set('x-session-id', sessionId1)
        .send({ tags: ['测试'] });

      const res = await request(app)
        .get('/api/chat/conversations')
        .set('x-session-id', sessionId1);
      expect(res.status).toBe(200);
      expect(res.body.pinnedIds).toContain(conversationId);
      expect(res.body.mutedIds).toBeDefined();
      expect(res.body.archivedIds).toBeDefined();
      expect(res.body.tags[conversationId]).toEqual(['测试']);
    });
  });

  // ---------- 消息转发 ----------
  describe('POST /api/chat/messages/:id/forward', () => {
    let messageId: string;
    let targetConvId: string;

    beforeEach(async () => {
      // 发送一条消息用于转发
      const msg = await chatService.sendMessage(userId1, conversationId, 'text', '待转发消息');
      messageId = msg.id;

      // 注册第三个用户，创建第二个会话
      const res3 = await request(app)
        .post('/api/auth/register')
        .send({ username: 'mgmtuser3', password: 'password789' });
      const convRes = await request(app)
        .post('/api/chat/conversations/private')
        .set('x-session-id', sessionId1)
        .send({ targetUserId: res3.body.user.id });
      targetConvId = convRes.body.conversation.id;
    });

    it('should forward message successfully', async () => {
      const res = await request(app)
        .post(`/api/chat/messages/${messageId}/forward`)
        .set('x-session-id', sessionId1)
        .send({ targetConversationId: targetConvId });
      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
      expect(res.body.message.content).toBe('待转发消息');
      expect(res.body.message.forwardedFrom).toBeDefined();
      expect(res.body.message.forwardedFrom.senderName).toBe('mgmtuser1');
    });

    it('should reject forwarding recalled message', async () => {
      // 先撤回消息
      await chatService.recallMessage(messageId, userId1);
      const res = await request(app)
        .post(`/api/chat/messages/${messageId}/forward`)
        .set('x-session-id', sessionId1)
        .send({ targetConversationId: targetConvId });
      expect(res.status).toBe(400);
    });

    it('should reject non-participant', async () => {
      const res3 = await request(app)
        .post('/api/auth/register')
        .send({ username: 'outsider2', password: 'password000' });
      const res = await request(app)
        .post(`/api/chat/messages/${messageId}/forward`)
        .set('x-session-id', res3.body.sessionId)
        .send({ targetConversationId: targetConvId });
      expect(res.status).toBe(403);
    });
  });
});
