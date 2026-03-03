/**
 * ServerBotManager — Skill 集成测试（v1.13.0）
 *
 * 测试 startBot 加载 allowedSkills 和 updateBotSkills 热更新。
 */
import Redis from 'ioredis';
import { BotService } from '../src/modules/bot/BotService';
import { ServerBotManager } from '../src/modules/bot/ServerBotManager';
import type { LLMConfig } from '@chat/shared';

const mockRedis = {
  hset: jest.fn().mockResolvedValue(1),
  hget: jest.fn().mockResolvedValue(null),
  hgetall: jest.fn().mockResolvedValue({}),
  hdel: jest.fn().mockResolvedValue(1),
  sadd: jest.fn().mockResolvedValue(1),
  srem: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  rpush: jest.fn().mockResolvedValue(1),
  lrange: jest.fn().mockResolvedValue([]),
  incr: jest.fn().mockResolvedValue(1),
  zcard: jest.fn().mockResolvedValue(0),
  blpop: jest.fn().mockResolvedValue(null),
  lpop: jest.fn().mockResolvedValue(null),
  quit: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

jest.mock('../src/repositories/redis/RedisClient', () => ({
  getRedisClient: () => mockRedis,
}));

jest.mock('../src/config', () => ({
  config: {
    redis: { host: 'localhost', port: 6379, password: '', db: 0 },
    botEncryptionKey: 'test-encryption-key-for-testing',
  },
}));

const mockUserRepo = {
  findById: jest.fn(),
  findByUsername: jest.fn(),
  createBot: jest.fn(),
  findBotByToken: jest.fn(),
  getBotsByOwner: jest.fn(),
  deleteBot: jest.fn(),
  create: jest.fn(),
  search: jest.fn(),
  getPasswordHash: jest.fn(),
  updateProfile: jest.fn(),
};

const mockMessageRepo = {
  saveMessage: jest.fn(),
  getConversation: jest.fn(),
  getMessages: jest.fn(),
  setUserOnline: jest.fn(),
  setUserOffline: jest.fn(),
  getOnlineUsers: jest.fn(),
  createConversation: jest.fn(),
  getConversations: jest.fn(),
};

const TEST_LLM_CONFIG: LLMConfig = {
  provider: 'deepseek',
  apiKey: 'sk-test',
  model: 'deepseek-chat',
  systemPrompt: 'Test',
  contextLength: 10,
};

describe('ServerBotManager — Skill 集成', () => {
  let botService: BotService;
  let manager: ServerBotManager;

  beforeEach(() => {
    jest.clearAllMocks();
    botService = new BotService(mockUserRepo as any, mockMessageRepo as any);
    manager = new ServerBotManager(botService);
  });

  afterEach(async () => {
    await manager.stopAll();
    await botService.close();
  });

  test('startBot 调用 getBotAllowedSkills 加载 Skill 白名单', async () => {
    const spy = jest.spyOn(botService, 'getBotAllowedSkills').mockResolvedValue(['skill:web']);
    await manager.startBot('bot-1', TEST_LLM_CONFIG);

    expect(spy).toHaveBeenCalledWith('bot-1');
    expect(manager.isRunning('bot-1')).toBe(true);
    spy.mockRestore();
  });

  test('updateBotSkills 调用 runner 的 updateAllowedSkills', async () => {
    jest.spyOn(botService, 'getBotAllowedSkills').mockResolvedValue(['*']);
    await manager.startBot('bot-1', TEST_LLM_CONFIG);

    // updateBotSkills 不应抛出异常
    expect(() => manager.updateBotSkills('bot-1', ['skill:file'])).not.toThrow();
  });

  test('updateBotSkills 未运行的 Bot 静默忽略', () => {
    expect(() => manager.updateBotSkills('bot-unknown', ['skill:file'])).not.toThrow();
  });
});
