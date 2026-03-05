import { BotService } from '../src/modules/bot/BotService';
import { RedisMessageRepository } from '../src/repositories/redis/RedisMessageRepository';
import { RedisUserRepository } from '../src/repositories/redis/RedisUserRepository';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

const MASTRA_CONFIG = {
  provider: 'deepseek' as const,
  apiKey: 'test-key',
  model: 'deepseek-chat',
  systemPrompt: 'You are a test bot.',
  contextLength: 10,
};

describe('Bot（机器人系统）', () => {
  let botService: BotService;
  let messageRepo: RedisMessageRepository;
  let userRepo: RedisUserRepository;
  let ownerId: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    messageRepo = new RedisMessageRepository();
    userRepo = new RedisUserRepository();
    botService = new BotService(userRepo, messageRepo);

    // 创建机器人所有者
    const owner = await userRepo.create({
      id: 'owner-1',
      username: 'owner',
      password: 'pass',
      hashedPassword: 'hash',
    });
    ownerId = owner.id;
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  it('should create a local bot', async () => {
    const result = await botService.createBot(ownerId, 'mybot', 'local', undefined, MASTRA_CONFIG);
    expect(result.id).toBeDefined();
    expect(result.username).toBe('mybot');
    expect(result.isBot).toBe(true);
    expect(result.botOwnerId).toBe(ownerId);
    expect(result.runMode).toBe('local');
  });

  it('should reject bot name not ending with bot', async () => {
    await expect(botService.createBot(ownerId, 'helper', 'local', undefined, MASTRA_CONFIG)).rejects.toThrow('BOT_NAME_INVALID');
    await expect(botService.createBot(ownerId, 'myBot', 'local', undefined, MASTRA_CONFIG)).resolves.toBeDefined();
  });

  it('should reject duplicate bot username', async () => {
    await botService.createBot(ownerId, 'dupebot', 'local', undefined, MASTRA_CONFIG);
    await expect(botService.createBot(ownerId, 'dupebot', 'local', undefined, MASTRA_CONFIG)).rejects.toThrow('USERNAME_TAKEN');
  });

  it('should reject missing model config', async () => {
    await expect(botService.createBot(ownerId, 'noconfbot', 'local')).rejects.toThrow('LOCAL_MODE_REQUIRES_MODEL_CONFIG');
  });

  it('should list bots for owner', async () => {
    await botService.createBot(ownerId, 'alphabot', 'local', undefined, MASTRA_CONFIG);
    await botService.createBot(ownerId, 'betabot', 'local', undefined, MASTRA_CONFIG);

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
    await botService.createBot(ownerId, 'ownerbot', 'local', undefined, MASTRA_CONFIG);
    await botService.createBot(other.id, 'otherbot', 'local', undefined, MASTRA_CONFIG);

    const myBots = await botService.listBots(ownerId);
    expect(myBots.length).toBe(1);
    expect(myBots[0].username).toBe('ownerbot');
  });

  it('should delete bot by owner', async () => {
    const bot = await botService.createBot(ownerId, 'delbot', 'local', undefined, MASTRA_CONFIG);
    await botService.deleteBot(bot.id, ownerId);

    const bots = await botService.listBots(ownerId);
    expect(bots.length).toBe(0);
  });

  it('should reject delete by non-owner', async () => {
    const other = await userRepo.create({
      id: 'owner-3',
      username: 'stranger',
      password: 'pass',
      hashedPassword: 'hash',
    });
    const bot = await botService.createBot(ownerId, 'protectedbot', 'local', undefined, MASTRA_CONFIG);
    await expect(botService.deleteBot(bot.id, other.id)).rejects.toThrow('FORBIDDEN');
  });

  it('bot user should have isBot=true in findById', async () => {
    const bot = await botService.createBot(ownerId, 'flagbot', 'local', undefined, MASTRA_CONFIG);
    const user = await userRepo.findById(bot.id);
    expect(user).not.toBeNull();
    expect(user!.isBot).toBe(true);
    expect(user!.botOwnerId).toBe(ownerId);
  });

  it('should save and retrieve mastra config', async () => {
    const bot = await botService.createBot(ownerId, 'configbot', 'local', undefined, MASTRA_CONFIG);
    const config = await botService.getMastraConfig(bot.id);
    expect(config).not.toBeNull();
    expect(config!.provider).toBe('deepseek');
    expect(config!.model).toBe('deepseek-chat');
    expect(config!.apiKey).toBe('test-key');
  });

  it('should mask api key', async () => {
    const bot = await botService.createBot(ownerId, 'maskbot', 'local', undefined, MASTRA_CONFIG);
    const masked = await botService.getMastraConfigMasked(bot.id);
    expect(masked).not.toBeNull();
    expect(masked!.apiKey).toContain('****');
    expect(masked!.apiKey).not.toBe('test-key');
  });
});
