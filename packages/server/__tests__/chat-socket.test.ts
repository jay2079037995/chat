/**
 * v1.3.0 Socket 广播测试
 *
 * 通过 mock io/socket 对象，单元测试 socket handler 的广播逻辑。
 * 验证撤回、编辑、表情回应事件正确广播给会话中的其他成员。
 */
import request from 'supertest';
import { app, socketHandlers } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';
import { RedisMessageRepository } from '../src/repositories/redis/RedisMessageRepository';
import { RedisUserRepository } from '../src/repositories/redis/RedisUserRepository';
import { ChatService } from '../src/modules/chat/ChatService';
import type { Message } from '@chat/shared';

describe('v1.3.0 Socket 广播', () => {
  let chatService: ChatService;
  let messageRepo: RedisMessageRepository;
  let userId1: string;
  let userId2: string;
  let conversationId: string;

  /** 注册到 mock socket 上的事件处理器 */
  let registeredHandlers: Record<string, (...args: any[]) => any>;

  /** mock socket.to().emit() 的调用记录 */
  let socketToEmit: jest.Mock;
  /** mock io.to().emit() 的调用记录 */
  let ioToEmit: jest.Mock;
  /** mock socket.to() 返回值 */
  let mockSocketTo: jest.Mock;
  /** mock io.to() 返回值 */
  let mockIoTo: jest.Mock;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    messageRepo = new RedisMessageRepository();
    const userRepo = new RedisUserRepository();
    chatService = new ChatService(messageRepo, userRepo);

    // 注册两个测试用户
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'sockuser1', password: 'password123' });
    userId1 = res1.body.user.id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'sockuser2', password: 'password456' });
    userId2 = res2.body.user.id;

    // 创建会话
    const conv = await chatService.getOrCreatePrivateConversation(userId1, userId2);
    conversationId = conv.id;

    // 构建 mock socket 和 io
    registeredHandlers = {};
    socketToEmit = jest.fn();
    ioToEmit = jest.fn();

    mockSocketTo = jest.fn().mockReturnValue({ emit: socketToEmit });
    mockIoTo = jest.fn().mockReturnValue({ emit: ioToEmit });

    const mockSocket: any = {
      data: { userId: userId1 },
      on: jest.fn((event: string, handler: (...args: any[]) => any) => {
        registeredHandlers[event] = handler;
      }),
      join: jest.fn(),
      to: mockSocketTo,
      emit: jest.fn(),
    };

    const mockIo: any = {
      to: mockIoTo,
      emit: jest.fn(),
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
    };

    // 调用所有模块 socket handler，注册事件处理器
    for (const handler of socketHandlers) {
      handler(mockIo, mockSocket);
    }
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  /** 辅助：发送测试消息 */
  async function sendTestMessage(
    senderId: string,
    content = '测试消息',
  ): Promise<Message> {
    return chatService.sendMessage(senderId, conversationId, 'text', content);
  }

  // ========== 消息撤回广播 ==========
  describe('消息撤回广播', () => {
    it('撤回成功后广播 message:recalled 给会话', async () => {
      const msg = await sendTestMessage(userId1);

      const callback = jest.fn();
      await registeredHandlers['message:recall'](
        { messageId: msg.id, conversationId },
        callback,
      );

      // 验证 callback 返回成功
      expect(callback).toHaveBeenCalledWith({ success: true });

      // 验证 socket.to(conversationId).emit('message:recalled', ...) 被调用
      expect(mockSocketTo).toHaveBeenCalledWith(conversationId);
      expect(socketToEmit).toHaveBeenCalledWith('message:recalled', {
        messageId: msg.id,
        conversationId,
        senderId: userId1,
      });
    });

    it('撤回失败不广播', async () => {
      const msg = await sendTestMessage(userId2); // userId2 的消息

      const callback = jest.fn();
      await registeredHandlers['message:recall'](
        { messageId: msg.id, conversationId },
        callback,
      );

      // 验证 callback 返回失败
      expect(callback).toHaveBeenCalledWith({ success: false, error: 'FORBIDDEN' });
      // 不应广播
      expect(socketToEmit).not.toHaveBeenCalledWith(
        'message:recalled',
        expect.anything(),
      );
    });
  });

  // ========== 消息编辑广播 ==========
  describe('消息编辑广播', () => {
    it('编辑成功后广播 message:edited（含 newContent + editedAt）', async () => {
      const msg = await sendTestMessage(userId1, '原始内容');

      const callback = jest.fn();
      await registeredHandlers['message:edit'](
        { messageId: msg.id, conversationId, newContent: '编辑后内容' },
        callback,
      );

      expect(callback).toHaveBeenCalledWith({ success: true });
      expect(mockSocketTo).toHaveBeenCalledWith(conversationId);
      expect(socketToEmit).toHaveBeenCalledWith('message:edited', {
        messageId: msg.id,
        conversationId,
        newContent: '编辑后内容',
        editedAt: expect.any(Number),
      });
    });

    it('编辑失败不广播', async () => {
      const msg = await sendTestMessage(userId2); // userId2 的消息

      const callback = jest.fn();
      await registeredHandlers['message:edit'](
        { messageId: msg.id, conversationId, newContent: '新内容' },
        callback,
      );

      expect(callback).toHaveBeenCalledWith({ success: false, error: 'FORBIDDEN' });
      expect(socketToEmit).not.toHaveBeenCalledWith(
        'message:edited',
        expect.anything(),
      );
    });
  });

  // ========== 表情回应广播 ==========
  describe('表情回应广播', () => {
    it('reaction 后广播 message:reacted（含完整 reactions）', async () => {
      const msg = await sendTestMessage(userId1);

      await registeredHandlers['message:react']({
        messageId: msg.id,
        conversationId,
        emoji: '👍',
      });

      // message:react 使用 io.to()（广播给所有人含发送者）
      expect(mockIoTo).toHaveBeenCalledWith(conversationId);
      expect(ioToEmit).toHaveBeenCalledWith('message:reacted', {
        messageId: msg.id,
        conversationId,
        reactions: { '👍': [userId1] },
      });
    });

    it('多次 reaction 后广播完整 reactions 对象', async () => {
      const msg = await sendTestMessage(userId1);

      // 第一次 reaction
      await registeredHandlers['message:react']({
        messageId: msg.id,
        conversationId,
        emoji: '👍',
      });

      ioToEmit.mockClear();
      mockIoTo.mockClear();
      mockIoTo.mockReturnValue({ emit: ioToEmit });

      // 再次 toggle（取消）
      await registeredHandlers['message:react']({
        messageId: msg.id,
        conversationId,
        emoji: '👍',
      });

      expect(ioToEmit).toHaveBeenCalledWith('message:reacted', {
        messageId: msg.id,
        conversationId,
        reactions: {},
      });
    });
  });
});
