import { test, expect, request } from '@playwright/test';
import { flushTestData, closeRedis } from '../helpers/redis';
import { registerUser } from '../helpers/api';
import { TEST_USERS } from '../fixtures/test-data';

test.describe('v0.6 - 聊天记录与搜索', () => {
  test.beforeEach(async () => {
    await flushTestData();
    await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);
  });

  test.afterAll(async () => {
    await closeRedis();
  });

  /** 辅助函数：创建私聊会话并发送消息 */
  async function setupConversationWithMessages(sessionId: string, targetUserId: string, messages: string[]) {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': sessionId },
    });

    // 创建私聊
    const convRes = await ctx.post('/api/chat/conversations/private', {
      data: { targetUserId },
    });
    const convBody = await convRes.json();
    const conversationId = convBody.conversation.id;

    // 直接通过 Redis 写入消息（避免 Socket 依赖）
    const { getRedisClient } = await import('../helpers/redis');
    const redis = getRedisClient();
    const now = Date.now();
    for (let i = 0; i < messages.length; i++) {
      const msgId = `e2e-msg-${Date.now()}-${i}`;
      await redis.hset(`msg:${msgId}`, {
        id: msgId,
        conversationId,
        senderId: targetUserId,
        type: 'text',
        content: messages[i],
        createdAt: (now + i).toString(),
      });
      await redis.zadd(`conv_msgs:${conversationId}`, now + i, msgId);
    }

    await ctx.dispose();
    return conversationId;
  }

  test('6.1.1: 搜索消息返回匹配结果 (API)', async () => {
    await flushTestData();
    const user1 = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    const user2 = await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);

    await setupConversationWithMessages(user1.sessionId, user2.user.id, [
      '你好世界',
      '今天天气不错',
      '测试消息',
    ]);

    const ctx = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': user1.sessionId },
    });

    const res = await ctx.get('/api/chat/messages/search?q=你好');
    const body = await res.json();
    await ctx.dispose();

    expect(res.status()).toBe(200);
    expect(body.messages.length).toBeGreaterThan(0);
    expect(body.messages.some((m: any) => m.content.includes('你好'))).toBe(true);
  });

  test('6.1.2: 搜索无结果返回空 (API)', async () => {
    await flushTestData();
    const user1 = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    const user2 = await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);

    await setupConversationWithMessages(user1.sessionId, user2.user.id, [
      '你好世界',
    ]);

    const ctx = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': user1.sessionId },
    });

    const res = await ctx.get('/api/chat/messages/search?q=完全不匹配的关键词xyz');
    const body = await res.json();
    await ctx.dispose();

    expect(res.status()).toBe(200);
    expect(body.messages).toEqual([]);
  });

  test('6.1.3: 历史消息分页正确 (API)', async () => {
    await flushTestData();
    const user1 = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    const user2 = await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);

    // 插入多条消息
    const messages = Array.from({ length: 5 }, (_, i) => `分页测试消息${i}`);
    const convId = await setupConversationWithMessages(user1.sessionId, user2.user.id, messages);

    const ctx = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': user1.sessionId },
    });

    // 第一页
    const res1 = await ctx.get(`/api/chat/conversations/${convId}/messages?offset=0&limit=3`);
    const body1 = await res1.json();
    expect(res1.status()).toBe(200);
    expect(body1.messages.length).toBe(3);

    // 第二页
    const res2 = await ctx.get(`/api/chat/conversations/${convId}/messages?offset=3&limit=3`);
    const body2 = await res2.json();
    expect(res2.status()).toBe(200);
    expect(body2.messages.length).toBe(2);

    // 超出范围
    const res3 = await ctx.get(`/api/chat/conversations/${convId}/messages?offset=100&limit=3`);
    const body3 = await res3.json();
    expect(res3.status()).toBe(200);
    expect(body3.messages).toEqual([]);

    await ctx.dispose();
  });
});
