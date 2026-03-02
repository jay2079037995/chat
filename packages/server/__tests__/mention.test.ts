import { ChatService } from '../src/modules/chat/ChatService';
import { RedisMessageRepository } from '../src/repositories/redis/RedisMessageRepository';
import { RedisUserRepository } from '../src/repositories/redis/RedisUserRepository';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('Mention (@提及)', () => {
  let chatService: ChatService;
  let messageRepo: RedisMessageRepository;
  let userRepo: RedisUserRepository;
  let userId1: string;
  let userId2: string;
  let userId3: string;
  let convId: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    messageRepo = new RedisMessageRepository();
    userRepo = new RedisUserRepository();
    chatService = new ChatService(messageRepo, userRepo);

    // 创建测试用户
    const user1 = await userRepo.create({
      id: 'user-1',
      username: 'alice',
      password: 'pass1',
      hashedPassword: 'hash1',
    });
    userId1 = user1.id;

    const user2 = await userRepo.create({
      id: 'user-2',
      username: 'bob',
      password: 'pass2',
      hashedPassword: 'hash2',
    });
    userId2 = user2.id;

    const user3 = await userRepo.create({
      id: 'user-3',
      username: 'charlie',
      password: 'pass3',
      hashedPassword: 'hash3',
    });
    userId3 = user3.id;

    // 创建会话
    const conv = await chatService.getOrCreatePrivateConversation(userId1, userId2);
    convId = conv.id;
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  it('should resolve @username to userId in mentions', async () => {
    const message = await chatService.sendMessage(
      userId1,
      convId,
      'text',
      '你好 @bob 这是一条测试消息',
    );

    expect(message.mentions).toBeDefined();
    expect(message.mentions).toContain(userId2);
    expect(message.mentions).toHaveLength(1);
  });

  it('should resolve multiple @mentions', async () => {
    // 创建一个群聊会话用于测试（需要三个人的会话）
    const redis = getRedisClient();
    const groupConvId = 'group:test-group';
    await redis.hset(`conv:${groupConvId}`, {
      id: groupConvId,
      type: 'group',
      participants: JSON.stringify([userId1, userId2, userId3]),
      updatedAt: String(Date.now()),
    });
    // 将会话添加到用户的会话列表
    const now = Date.now();
    await redis.zadd(`user_convs:${userId1}`, now, groupConvId);

    const message = await chatService.sendMessage(
      userId1,
      groupConvId,
      'text',
      '@bob @charlie 大家注意一下',
    );

    expect(message.mentions).toBeDefined();
    expect(message.mentions).toHaveLength(2);
    expect(message.mentions).toContain(userId2);
    expect(message.mentions).toContain(userId3);
  });

  it('should ignore non-existent @username', async () => {
    const message = await chatService.sendMessage(
      userId1,
      convId,
      'text',
      '你好 @nonexistent 这条消息给不存在的用户',
    );

    expect(message.mentions).toBeUndefined();
  });

  it('should not resolve mentions for non-text types', async () => {
    const message = await chatService.sendMessage(
      userId1,
      convId,
      'code',
      'const user = @bob;',
      { codeLanguage: 'javascript' },
    );

    expect(message.mentions).toBeUndefined();
  });

  it('should resolve mentions in markdown messages', async () => {
    const message = await chatService.sendMessage(
      userId1,
      convId,
      'markdown',
      '**重要** @bob 请查看文档',
    );

    expect(message.mentions).toBeDefined();
    expect(message.mentions).toContain(userId2);
  });

  it('should deduplicate repeated @mentions', async () => {
    const message = await chatService.sendMessage(
      userId1,
      convId,
      'text',
      '@bob @bob @bob 别忘了',
    );

    expect(message.mentions).toBeDefined();
    expect(message.mentions).toHaveLength(1);
    expect(message.mentions).toContain(userId2);
  });

  it('should persist mentions through Redis serialization', async () => {
    const message = await chatService.sendMessage(
      userId1,
      convId,
      'text',
      '提醒 @bob 查看',
    );

    // 从 Redis 重新读取
    const messages = await chatService.getMessages(convId, 0, 10);
    const found = messages.find((m) => m.id === message.id);

    expect(found).toBeDefined();
    expect(found!.mentions).toBeDefined();
    expect(found!.mentions).toContain(userId2);
  });
});
