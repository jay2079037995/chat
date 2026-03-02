/**
 * 消息置顶 Socket 事件测试
 *
 * 通过 mock io/socket 对象，单元测试 message:pin handler 的置顶/取消置顶 + 广播逻辑。
 */
import request from 'supertest';
import { app, socketHandlers } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';
import { RedisMessageRepository } from '../src/repositories/redis/RedisMessageRepository';
import { RedisUserRepository } from '../src/repositories/redis/RedisUserRepository';
import { ChatService } from '../src/modules/chat/ChatService';
import type { Message } from '@chat/shared';

describe('消息置顶 Socket', () => {
  let chatService: ChatService;
  let messageRepo: RedisMessageRepository;
  let userId1: string;
  let userId2: string;
  let conversationId: string;

  let registeredHandlers: Record<string, (...args: any[]) => any>;
  let ioToEmit: jest.Mock;
  let mockIoTo: jest.Mock;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    messageRepo = new RedisMessageRepository();
    const userRepo = new RedisUserRepository();
    chatService = new ChatService(messageRepo, userRepo);

    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'pinuser1', password: 'password123' });
    userId1 = res1.body.user.id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'pinuser2', password: 'password456' });
    userId2 = res2.body.user.id;

    const conv = await chatService.getOrCreatePrivateConversation(userId1, userId2);
    conversationId = conv.id;

    // 构建 mock socket 和 io
    registeredHandlers = {};
    ioToEmit = jest.fn();
    mockIoTo = jest.fn().mockReturnValue({ emit: ioToEmit });

    const mockSocket: any = {
      data: { userId: userId1 },
      on: jest.fn((event: string, handler: (...args: any[]) => any) => {
        registeredHandlers[event] = handler;
      }),
      join: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      emit: jest.fn(),
    };

    const mockIo: any = {
      to: mockIoTo,
      emit: jest.fn(),
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
    };

    for (const handler of socketHandlers) {
      handler(mockIo, mockSocket);
    }
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  async function sendTestMessage(senderId: string, content = '测试消息'): Promise<Message> {
    return chatService.sendMessage(senderId, conversationId, 'text', content);
  }

  it('置顶消息成功后广播 message:pinned', async () => {
    const msg = await sendTestMessage(userId1, '要置顶的消息');

    const callback = jest.fn();
    await registeredHandlers['message:pin'](
      { messageId: msg.id, conversationId },
      callback,
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, pinned: true }),
    );

    // 验证广播
    expect(mockIoTo).toHaveBeenCalledWith(conversationId);
    expect(ioToEmit).toHaveBeenCalledWith(
      'message:pinned',
      expect.objectContaining({
        conversationId,
        messageId: msg.id,
        pinned: true,
        pinnedBy: userId1,
      }),
    );
  });

  it('取消置顶消息成功后广播 pinned=false', async () => {
    const msg = await sendTestMessage(userId1, '先置顶再取消');

    // 先置顶
    const cb1 = jest.fn();
    await registeredHandlers['message:pin'](
      { messageId: msg.id, conversationId },
      cb1,
    );
    expect(cb1).toHaveBeenCalledWith(expect.objectContaining({ pinned: true }));

    // 重置 mock
    ioToEmit.mockClear();
    mockIoTo.mockClear().mockReturnValue({ emit: ioToEmit });

    // 取消置顶
    const cb2 = jest.fn();
    await registeredHandlers['message:pin'](
      { messageId: msg.id, conversationId },
      cb2,
    );

    expect(cb2).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, pinned: false }),
    );
    expect(ioToEmit).toHaveBeenCalledWith(
      'message:pinned',
      expect.objectContaining({ pinned: false }),
    );
  });
});
