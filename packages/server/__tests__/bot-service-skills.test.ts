/**
 * BotService — Bot Skill 定制测试（v1.13.0）
 *
 * 测试 getBotAllowedSkills / setBotAllowedSkills 方法。
 */
import Redis from 'ioredis';
import { BotService } from '../src/modules/bot/BotService';

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

describe('BotService — Bot Skill 定制', () => {
  let botService: BotService;

  beforeEach(() => {
    jest.clearAllMocks();
    botService = new BotService(mockUserRepo as any, mockMessageRepo as any);
  });

  afterEach(async () => {
    await botService.close();
  });

  describe('getBotAllowedSkills', () => {
    test('无 Redis 数据时默认返回 ["*"]', async () => {
      mockRedis.smembers.mockResolvedValueOnce([]);
      const result = await botService.getBotAllowedSkills('bot-1');
      expect(result).toEqual(['*']);
      expect(mockRedis.smembers).toHaveBeenCalledWith('bot_skills:bot-1');
    });

    test('有 Redis 数据时返回实际值', async () => {
      mockRedis.smembers.mockResolvedValueOnce(['skill:web', 'skill:file']);
      const result = await botService.getBotAllowedSkills('bot-1');
      expect(result).toEqual(['skill:web', 'skill:file']);
    });
  });

  describe('setBotAllowedSkills', () => {
    test('先 del 再 sadd 存入 Redis', async () => {
      await botService.setBotAllowedSkills('bot-1', ['skill:web', 'skill:file']);
      expect(mockRedis.del).toHaveBeenCalledWith('bot_skills:bot-1');
      expect(mockRedis.sadd).toHaveBeenCalledWith('bot_skills:bot-1', 'skill:web', 'skill:file');
    });

    test('空数组时只 del 不 sadd', async () => {
      await botService.setBotAllowedSkills('bot-1', []);
      expect(mockRedis.del).toHaveBeenCalledWith('bot_skills:bot-1');
      expect(mockRedis.sadd).not.toHaveBeenCalled();
    });
  });

  describe('deleteBot — 清理 bot_skills key', () => {
    test('删除 Bot 时清理 bot_skills key', async () => {
      mockUserRepo.findById.mockResolvedValue({
        id: 'bot-1',
        isBot: true,
        botOwnerId: 'owner-1',
      });
      mockRedis.hget.mockResolvedValueOnce('server');
      mockRedis.keys.mockResolvedValueOnce([]);

      await botService.deleteBot('bot-1', 'owner-1');
      expect(mockRedis.del).toHaveBeenCalledWith('bot_skills:bot-1');
    });
  });
});
