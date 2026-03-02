import { BotService } from '../src/modules/bot/BotService';
import { ChatService } from '../src/modules/chat/ChatService';
import { RedisMessageRepository } from '../src/repositories/redis/RedisMessageRepository';
import { RedisUserRepository } from '../src/repositories/redis/RedisUserRepository';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('Bot（机器人系统）', () => {
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

    // 创建机器人所有者
    const owner = await userRepo.create({
      id: 'owner-1',
      username: 'owner',
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

  it('should create a bot and return token', async () => {
    const result = await botService.createBot(ownerId, 'mybot');
    expect(result.id).toBeDefined();
    expect(result.username).toBe('mybot');
    expect(result.isBot).toBe(true);
    expect(result.botOwnerId).toBe(ownerId);
    expect(result.token).toBeDefined();
    expect(result.token.length).toBe(64);
  });

  it('should reject bot name not ending with bot', async () => {
    await expect(botService.createBot(ownerId, 'helper')).rejects.toThrow('BOT_NAME_INVALID');
    await expect(botService.createBot(ownerId, 'myBot')).resolves.toBeDefined(); // 大小写不敏感
  });

  it('should reject duplicate bot username', async () => {
    await botService.createBot(ownerId, 'dupebot');
    await expect(botService.createBot(ownerId, 'dupebot')).rejects.toThrow('USERNAME_TAKEN');
  });

  it('should list bots for owner', async () => {
    await botService.createBot(ownerId, 'alphabot');
    await botService.createBot(ownerId, 'betabot');

    const bots = await botService.listBots(ownerId);
    expect(bots.length).toBe(2);
    expect(bots.map((b) => b.username).sort()).toEqual(['alphabot', 'betabot']);
  });

  it('should not list other owners bots', async () => {
    const other = await userRepo.create({
      id: 'owner-2',
      username: 'other',
      password: 'pass',
      hashedPassword: 'hash',
    });
    await botService.createBot(ownerId, 'ownerbot');
    await botService.createBot(other.id, 'otherbot');

    const myBots = await botService.listBots(ownerId);
    expect(myBots.length).toBe(1);
    expect(myBots[0].username).toBe('ownerbot');
  });

  it('should delete bot by owner', async () => {
    const bot = await botService.createBot(ownerId, 'delbot');
    await botService.deleteBot(bot.id, ownerId);

    const bots = await botService.listBots(ownerId);
    expect(bots.length).toBe(0);

    // Token should be invalidated
    const botId = await userRepo.findBotByToken(bot.token);
    expect(botId).toBeNull();
  });

  it('should reject delete by non-owner', async () => {
    const other = await userRepo.create({
      id: 'owner-3',
      username: 'stranger',
      password: 'pass',
      hashedPassword: 'hash',
    });
    const bot = await botService.createBot(ownerId, 'protectedbot');
    await expect(botService.deleteBot(bot.id, other.id)).rejects.toThrow('FORBIDDEN');
  });

  it('getUpdates should return empty on timeout', async () => {
    const bot = await botService.createBot(ownerId, 'timeoutbot');
    // Use token to call getUpdates with 1 second timeout
    const updates = await botService.getUpdates(bot.token, 1);
    expect(updates).toEqual([]);
  });

  it('should enqueue and dequeue updates for private chat', async () => {
    const bot = await botService.createBot(ownerId, 'chatbot');

    // Create private conversation
    const conv = await chatService.getOrCreatePrivateConversation(ownerId, bot.id);

    // Send a message to the conversation
    const message = await chatService.sendMessage(ownerId, conv.id, 'text', 'Hello bot!');

    // Manually enqueue (normally ChatModule does this)
    await botService.enqueueUpdate(bot.id, message, conv.id);

    // Bot retrieves updates
    const updates = await botService.getUpdates(bot.token, 1);
    expect(updates.length).toBe(1);
    expect(updates[0].message.content).toBe('Hello bot!');
    expect(updates[0].conversationId).toBe(conv.id);
    expect(updates[0].updateId).toBe(1);
  });

  it('should allow bot to send message', async () => {
    const bot = await botService.createBot(ownerId, 'senderbot');
    const conv = await chatService.getOrCreatePrivateConversation(ownerId, bot.id);

    const message = await botService.sendMessage(bot.token, conv.id, 'Hello human!');
    expect(message.senderId).toBe(bot.id);
    expect(message.content).toBe('Hello human!');
    expect(message.conversationId).toBe(conv.id);
  });

  it('should reject bot sendMessage to non-participant conversation', async () => {
    const bot = await botService.createBot(ownerId, 'rejectbot');
    const other = await userRepo.create({
      id: 'user-other',
      username: 'someone',
      password: 'pass',
      hashedPassword: 'hash',
    });
    const conv = await chatService.getOrCreatePrivateConversation(ownerId, other.id);

    await expect(botService.sendMessage(bot.token, conv.id, 'sneaky')).rejects.toThrow('NOT_PARTICIPANT');
  });

  it('should reject invalid token for getUpdates', async () => {
    await expect(botService.getUpdates('invalid-token', 1)).rejects.toThrow('INVALID_TOKEN');
  });

  it('should reject invalid token for sendMessage', async () => {
    await expect(botService.sendMessage('invalid-token', 'conv', 'hi')).rejects.toThrow('INVALID_TOKEN');
  });

  it('bot user should have isBot=true in findById', async () => {
    const bot = await botService.createBot(ownerId, 'flagbot');
    const user = await userRepo.findById(bot.id);
    expect(user).not.toBeNull();
    expect(user!.isBot).toBe(true);
    expect(user!.botOwnerId).toBe(ownerId);
  });
});
