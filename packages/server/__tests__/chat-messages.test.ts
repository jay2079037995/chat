/**
 * v1.3.0 消息增强 — 服务端测试
 *
 * 测试消息撤回、编辑、引用回复、表情回应功能。
 * 直接测试 ChatService 方法 + RedisMessageRepository 数据层。
 */
import request from 'supertest';
import { app } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';
import { RedisMessageRepository } from '../src/repositories/redis/RedisMessageRepository';
import { RedisUserRepository } from '../src/repositories/redis/RedisUserRepository';
import { ChatService } from '../src/modules/chat/ChatService';
import type { Message } from '@chat/shared';

describe('v1.3.0 消息增强', () => {
  let chatService: ChatService;
  let messageRepo: RedisMessageRepository;
  let userRepo: RedisUserRepository;
  let userId1: string;
  let userId2: string;
  let conversationId: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    messageRepo = new RedisMessageRepository();
    userRepo = new RedisUserRepository();
    chatService = new ChatService(messageRepo, userRepo);

    // 注册两个测试用户
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser1', password: 'password123' });
    userId1 = res1.body.user.id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser2', password: 'password456' });
    userId2 = res2.body.user.id;

    // 创建会话
    const conv = await chatService.getOrCreatePrivateConversation(userId1, userId2);
    conversationId = conv.id;
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  /** 辅助：发送测试消息 */
  async function sendTestMessage(
    senderId: string,
    type: Message['type'] = 'text',
    content = '测试消息',
    metadata?: { replyTo?: string },
  ): Promise<Message> {
    return chatService.sendMessage(senderId, conversationId, type, content, metadata);
  }

  // ========== 消息撤回 ==========
  describe('消息撤回', () => {
    it('发送者 2 分钟内可撤回', async () => {
      const msg = await sendTestMessage(userId1);
      await chatService.recallMessage(msg.id, userId1);

      const updated = await messageRepo.getMessage(msg.id);
      expect(updated?.recalled).toBe(true);
    });

    it('超过 2 分钟不可撤回', async () => {
      const msg = await sendTestMessage(userId1);

      // 直接修改 createdAt 模拟超时
      await messageRepo.updateMessage(msg.id, {} as any);
      const redis = getRedisClient();
      await redis.hset(`msg:${msg.id}`, 'createdAt', String(Date.now() - 3 * 60 * 1000));

      await expect(chatService.recallMessage(msg.id, userId1))
        .rejects.toThrow('RECALL_TIMEOUT');
    });

    it('非发送者不可撤回', async () => {
      const msg = await sendTestMessage(userId1);

      await expect(chatService.recallMessage(msg.id, userId2))
        .rejects.toThrow('FORBIDDEN');
    });

    it('已撤回的消息不可重复撤回', async () => {
      const msg = await sendTestMessage(userId1);
      await chatService.recallMessage(msg.id, userId1);

      await expect(chatService.recallMessage(msg.id, userId1))
        .rejects.toThrow('ALREADY_RECALLED');
    });

    it('不存在的消息撤回报错', async () => {
      await expect(chatService.recallMessage('nonexistent', userId1))
        .rejects.toThrow('MESSAGE_NOT_FOUND');
    });
  });

  // ========== 消息编辑 ==========
  describe('消息编辑', () => {
    it('发送者 5 分钟内可编辑文本消息', async () => {
      const msg = await sendTestMessage(userId1, 'text', '原始内容');
      const editedAt = await chatService.editMessage(msg.id, userId1, '编辑后内容');

      const updated = await messageRepo.getMessage(msg.id);
      expect(updated?.content).toBe('编辑后内容');
      expect(updated?.edited).toBe(true);
      expect(updated?.editedAt).toBe(editedAt);
    });

    it('超过 5 分钟不可编辑', async () => {
      const msg = await sendTestMessage(userId1);

      // 修改 createdAt 模拟超时
      const redis = getRedisClient();
      await redis.hset(`msg:${msg.id}`, 'createdAt', String(Date.now() - 6 * 60 * 1000));

      await expect(chatService.editMessage(msg.id, userId1, '新内容'))
        .rejects.toThrow('EDIT_TIMEOUT');
    });

    it('非发送者不可编辑', async () => {
      const msg = await sendTestMessage(userId1);

      await expect(chatService.editMessage(msg.id, userId2, '新内容'))
        .rejects.toThrow('FORBIDDEN');
    });

    it('仅文本类型可编辑', async () => {
      // image 类型消息用 /uploads/ 开头的 URL
      const msg = await sendTestMessage(userId1, 'image', '/uploads/test.jpg');

      await expect(chatService.editMessage(msg.id, userId1, '新内容'))
        .rejects.toThrow('EDIT_NOT_SUPPORTED');
    });

    it('markdown 类型可编辑', async () => {
      const msg = await sendTestMessage(userId1, 'markdown', '# 标题');
      await chatService.editMessage(msg.id, userId1, '# 新标题');

      const updated = await messageRepo.getMessage(msg.id);
      expect(updated?.content).toBe('# 新标题');
      expect(updated?.edited).toBe(true);
    });

    it('已撤回消息不可编辑', async () => {
      const msg = await sendTestMessage(userId1);
      await chatService.recallMessage(msg.id, userId1);

      await expect(chatService.editMessage(msg.id, userId1, '新内容'))
        .rejects.toThrow('MESSAGE_RECALLED');
    });

    it('空内容拒绝编辑', async () => {
      const msg = await sendTestMessage(userId1);

      await expect(chatService.editMessage(msg.id, userId1, '   '))
        .rejects.toThrow('EMPTY_MESSAGE');
    });

    it('超长内容拒绝编辑', async () => {
      const msg = await sendTestMessage(userId1);
      const longContent = 'a'.repeat(10001);

      await expect(chatService.editMessage(msg.id, userId1, longContent))
        .rejects.toThrow('MESSAGE_TOO_LONG');
    });
  });

  // ========== 引用回复 ==========
  describe('引用回复', () => {
    it('发送带 replyTo 的消息保存引用快照', async () => {
      const original = await sendTestMessage(userId1, 'text', '原始消息');
      const reply = await sendTestMessage(userId2, 'text', '回复消息', { replyTo: original.id });

      expect(reply.replyTo).toBe(original.id);
      expect(reply.replySnapshot).toBeDefined();
      expect(reply.replySnapshot?.senderId).toBe(userId1);
      expect(reply.replySnapshot?.content).toBe('原始消息');
      expect(reply.replySnapshot?.type).toBe('text');
    });

    it('引用快照内容截断 200 字', async () => {
      const longContent = '长'.repeat(300);
      const original = await sendTestMessage(userId1, 'text', longContent);
      const reply = await sendTestMessage(userId2, 'text', '回复', { replyTo: original.id });

      expect(reply.replySnapshot?.content.length).toBe(200);
    });

    it('原消息不存在时忽略 replyTo', async () => {
      const reply = await sendTestMessage(userId1, 'text', '回复不存在的消息', { replyTo: 'nonexistent' });

      expect(reply.replyTo).toBeUndefined();
      expect(reply.replySnapshot).toBeUndefined();
    });

    it('不传 replyTo 时无引用字段', async () => {
      const msg = await sendTestMessage(userId1);

      expect(msg.replyTo).toBeUndefined();
      expect(msg.replySnapshot).toBeUndefined();
    });

    it('引用快照正确序列化/反序列化', async () => {
      const original = await sendTestMessage(userId1, 'text', '原始消息');
      const reply = await sendTestMessage(userId2, 'text', '回复消息', { replyTo: original.id });

      // 从 Redis 重新读取验证反序列化
      const loaded = await messageRepo.getMessage(reply.id);
      expect(loaded?.replyTo).toBe(original.id);
      expect(loaded?.replySnapshot).toEqual({
        senderId: userId1,
        content: '原始消息',
        type: 'text',
      });
    });
  });

  // ========== 消息表情回应 ==========
  describe('消息表情回应', () => {
    it('首次 toggle 添加 reaction', async () => {
      const msg = await sendTestMessage(userId1);
      const reactions = await chatService.toggleReaction(msg.id, userId2, '👍');

      expect(reactions['👍']).toContain(userId2);
    });

    it('再次 toggle 取消 reaction', async () => {
      const msg = await sendTestMessage(userId1);
      await chatService.toggleReaction(msg.id, userId2, '👍');
      const reactions = await chatService.toggleReaction(msg.id, userId2, '👍');

      expect(reactions['👍']).toBeUndefined();
    });

    it('多用户对同一 emoji reaction', async () => {
      const msg = await sendTestMessage(userId1);
      await chatService.toggleReaction(msg.id, userId1, '👍');
      const reactions = await chatService.toggleReaction(msg.id, userId2, '👍');

      expect(reactions['👍']).toHaveLength(2);
      expect(reactions['👍']).toContain(userId1);
      expect(reactions['👍']).toContain(userId2);
    });

    it('同一消息不同 emoji', async () => {
      const msg = await sendTestMessage(userId1);
      await chatService.toggleReaction(msg.id, userId2, '👍');
      const reactions = await chatService.toggleReaction(msg.id, userId2, '❤️');

      expect(reactions['👍']).toContain(userId2);
      expect(reactions['❤️']).toContain(userId2);
    });

    it('最后一个用户取消后清理 emoji 键', async () => {
      const msg = await sendTestMessage(userId1);
      await chatService.toggleReaction(msg.id, userId2, '👍');
      const reactions = await chatService.toggleReaction(msg.id, userId2, '👍');

      expect(reactions['👍']).toBeUndefined();
    });

    it('已撤回消息不可回应', async () => {
      const msg = await sendTestMessage(userId1);
      await chatService.recallMessage(msg.id, userId1);

      await expect(chatService.toggleReaction(msg.id, userId2, '👍'))
        .rejects.toThrow('MESSAGE_RECALLED');
    });

    it('reactions 正确持久化到 Redis', async () => {
      const msg = await sendTestMessage(userId1);
      await chatService.toggleReaction(msg.id, userId1, '👍');
      await chatService.toggleReaction(msg.id, userId2, '👍');
      await chatService.toggleReaction(msg.id, userId2, '❤️');

      // 从 Redis 重新读取
      const loaded = await messageRepo.getMessage(msg.id);
      expect(loaded?.reactions?.['👍']).toHaveLength(2);
      expect(loaded?.reactions?.['❤️']).toHaveLength(1);
    });
  });

  // ========== Redis 数据层 ==========
  describe('Redis 数据层', () => {
    it('getMessage 获取单条消息', async () => {
      const msg = await sendTestMessage(userId1);
      const loaded = await messageRepo.getMessage(msg.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(msg.id);
      expect(loaded?.content).toBe('测试消息');
    });

    it('getMessage 不存在返回 null', async () => {
      const result = await messageRepo.getMessage('nonexistent');
      expect(result).toBeNull();
    });

    it('updateMessage 更新消息字段', async () => {
      const msg = await sendTestMessage(userId1);
      await messageRepo.updateMessage(msg.id, {
        content: '更新内容',
        recalled: true,
        edited: true,
        editedAt: 12345,
        reactions: { '👍': [userId1] },
      });

      const loaded = await messageRepo.getMessage(msg.id);
      expect(loaded?.content).toBe('更新内容');
      expect(loaded?.recalled).toBe(true);
      expect(loaded?.edited).toBe(true);
      expect(loaded?.editedAt).toBe(12345);
      expect(loaded?.reactions).toEqual({ '👍': [userId1] });
    });

    it('新字段正确序列化/反序列化', async () => {
      const original = await sendTestMessage(userId1, 'text', '原始消息');
      const reply = await chatService.sendMessage(
        userId2, conversationId, 'text', '回复消息',
        { replyTo: original.id },
      );

      const loaded = await messageRepo.getMessage(reply.id);
      expect(loaded?.replyTo).toBe(original.id);
      expect(loaded?.replySnapshot).toEqual({
        senderId: userId1,
        content: '原始消息',
        type: 'text',
      });
    });

    it('兼容旧消息（无新字段）', async () => {
      // 直接写入一条不含新字段的消息到 Redis
      const redis = getRedisClient();
      await redis.hset('msg:old-msg', {
        id: 'old-msg',
        conversationId,
        senderId: userId1,
        type: 'text',
        content: '旧消息',
        createdAt: String(Date.now()),
      });

      const loaded = await messageRepo.getMessage('old-msg');
      expect(loaded).not.toBeNull();
      expect(loaded?.content).toBe('旧消息');
      expect(loaded?.recalled).toBeUndefined();
      expect(loaded?.edited).toBeUndefined();
      expect(loaded?.editedAt).toBeUndefined();
      expect(loaded?.replyTo).toBeUndefined();
      expect(loaded?.replySnapshot).toBeUndefined();
      expect(loaded?.reactions).toBeUndefined();
    });
  });
});
