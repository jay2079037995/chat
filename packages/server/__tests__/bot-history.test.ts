/**
 * Bot getHistory API 测试
 */
import { BotService } from '../src/modules/bot/BotService';
import { ChatService } from '../src/modules/chat/ChatService';
import { RedisMessageRepository } from '../src/repositories/redis/RedisMessageRepository';
import { RedisUserRepository } from '../src/repositories/redis/RedisUserRepository';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('Bot getHistory（Bot 历史消息 API）', () => {
  let botService: BotService;
  let chatService: ChatService;
  let messageRepo: RedisMessageRepository;
  let userRepo: RedisUserRepository;
  let ownerId: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    messageRepo = new RedisMessageRepository();
    userRepo = new RedisUserRepository();
    botService = new BotService(userRepo, messageRepo);
    chatService = new ChatService(messageRepo, userRepo);

    const owner = await userRepo.create({
      id: 'owner-1',
      username: 'historyowner',
      password: 'pass',
      hashedPassword: 'hash',
    });
    ownerId = owner.id;
  });

  afterEach(async () => {
    await botService.close();
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  it('should return history messages with botUserId and total', async () => {
    const bot = await botService.createBot(ownerId, 'histbot');
    const conv = await chatService.getOrCreatePrivateConversation(ownerId, bot.id);

    // 发送几条消息
    await chatService.sendMessage(ownerId, conv.id, 'text', '你好');
    await botService.sendMessage(bot.token, conv.id, '你好！有什么可以帮助你的？');
    await chatService.sendMessage(ownerId, conv.id, 'text', '天气怎么样');

    const result = await botService.getHistory(bot.token, conv.id);
    expect(result.botUserId).toBe(bot.id);
    expect(result.total).toBe(3);
    expect(result.messages.length).toBe(3);
  });

  it('should support pagination with limit and offset', async () => {
    const bot = await botService.createBot(ownerId, 'pagebot');
    const conv = await chatService.getOrCreatePrivateConversation(ownerId, bot.id);

    // 发送 5 条消息
    for (let i = 1; i <= 5; i++) {
      await chatService.sendMessage(ownerId, conv.id, 'text', `消息 ${i}`);
    }

    // 第一页 limit=2
    const page1 = await botService.getHistory(bot.token, conv.id, 2, 0);
    expect(page1.messages.length).toBe(2);
    expect(page1.total).toBe(5);

    // 第二页 offset=2
    const page2 = await botService.getHistory(bot.token, conv.id, 2, 2);
    expect(page2.messages.length).toBe(2);
  });

  it('should reject invalid token', async () => {
    await expect(
      botService.getHistory('invalid-token', 'conv-1'),
    ).rejects.toThrow('INVALID_TOKEN');
  });

  it('should reject non-participant bot', async () => {
    const bot = await botService.createBot(ownerId, 'outsidebot');
    const other = await userRepo.create({
      id: 'user-other',
      username: 'someone',
      password: 'pass',
      hashedPassword: 'hash',
    });
    // 创建 owner 和 other 的私聊，bot 不是参与者
    const conv = await chatService.getOrCreatePrivateConversation(ownerId, other.id);

    await expect(
      botService.getHistory(bot.token, conv.id),
    ).rejects.toThrow('NOT_PARTICIPANT');
  });

  it('should return empty for conversation with no messages', async () => {
    const bot = await botService.createBot(ownerId, 'emptybot');
    const conv = await chatService.getOrCreatePrivateConversation(ownerId, bot.id);

    const result = await botService.getHistory(bot.token, conv.id);
    expect(result.messages).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.botUserId).toBe(bot.id);
  });

  it('should reject missing conversationId (via service)', async () => {
    const bot = await botService.createBot(ownerId, 'noconvbot');
    // getConversation will return null for non-existent conv
    await expect(
      botService.getHistory(bot.token, 'nonexistent'),
    ).rejects.toThrow('CONVERSATION_NOT_FOUND');
  });
});
