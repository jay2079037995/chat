/**
 * BotService — LLM 调用日志测试（v1.14.0）
 *
 * 测试 saveLLMCallLog / getLLMCallLogs / clearLLMCallLogs 方法。
 */
import Redis from 'ioredis';
import { BotService } from '../src/modules/bot/BotService';
import type { LLMCallLog } from '@chat/shared';

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
  zadd: jest.fn().mockResolvedValue(1),
  zcard: jest.fn().mockResolvedValue(0),
  zrevrange: jest.fn().mockResolvedValue([]),
  zremrangebyrank: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
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

/** 构造测试用 LLMCallLog */
function makeLog(botId: string, overrides?: Partial<LLMCallLog>): LLMCallLog {
  return {
    id: 'log-1',
    botId,
    timestamp: Date.now(),
    conversationId: 'conv-1',
    request: {
      provider: 'deepseek',
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hello' }],
    },
    response: { content: 'Hi', finishReason: 'stop' },
    durationMs: 500,
    ...overrides,
  };
}

describe('BotService — LLM 调用日志', () => {
  let botService: BotService;

  beforeEach(() => {
    jest.clearAllMocks();
    botService = new BotService(mockUserRepo as any, mockMessageRepo as any);
  });

  afterEach(async () => {
    await botService.close();
  });

  describe('saveLLMCallLog', () => {
    test('调用 zadd 存入 Sorted Set', async () => {
      const log = makeLog('bot-1');
      await botService.saveLLMCallLog(log);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'bot_llm_logs:bot-1',
        log.timestamp,
        JSON.stringify(log),
      );
    });

    test('未超量时不调用 zremrangebyrank', async () => {
      mockRedis.zcard.mockResolvedValueOnce(50);
      await botService.saveLLMCallLog(makeLog('bot-1'));
      expect(mockRedis.zremrangebyrank).not.toHaveBeenCalled();
    });

    test('超过 100 条时调用 zremrangebyrank 裁剪', async () => {
      mockRedis.zcard.mockResolvedValueOnce(105);
      await botService.saveLLMCallLog(makeLog('bot-1'));
      expect(mockRedis.zremrangebyrank).toHaveBeenCalledWith(
        'bot_llm_logs:bot-1',
        0,
        4, // 105 - 100 - 1
      );
    });

    test('设置 7 天 expire', async () => {
      await botService.saveLLMCallLog(makeLog('bot-1'));
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'bot_llm_logs:bot-1',
        7 * 24 * 60 * 60,
      );
    });
  });

  describe('getLLMCallLogs', () => {
    test('调用 zrevrange 倒序查询', async () => {
      const logData = makeLog('bot-1');
      mockRedis.zcard.mockResolvedValueOnce(1);
      mockRedis.zrevrange.mockResolvedValueOnce([JSON.stringify(logData)]);

      const result = await botService.getLLMCallLogs('bot-1', 0, 20);

      expect(mockRedis.zrevrange).toHaveBeenCalledWith('bot_llm_logs:bot-1', 0, 19);
      expect(result.total).toBe(1);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].botId).toBe('bot-1');
    });

    test('offset/limit 正确传递', async () => {
      mockRedis.zcard.mockResolvedValueOnce(100);
      mockRedis.zrevrange.mockResolvedValueOnce([]);

      await botService.getLLMCallLogs('bot-1', 20, 10);
      expect(mockRedis.zrevrange).toHaveBeenCalledWith('bot_llm_logs:bot-1', 20, 29);
    });
  });

  describe('clearLLMCallLogs', () => {
    test('调用 del 清空日志', async () => {
      await botService.clearLLMCallLogs('bot-1');
      expect(mockRedis.del).toHaveBeenCalledWith('bot_llm_logs:bot-1');
    });
  });

  describe('deleteBot — 清理日志 key', () => {
    test('删除 Bot 时清理 bot_llm_logs key', async () => {
      mockUserRepo.findById.mockResolvedValue({
        id: 'bot-1',
        isBot: true,
        botOwnerId: 'owner-1',
      });
      mockRedis.hget.mockResolvedValueOnce('server');
      mockRedis.keys.mockResolvedValueOnce([]);

      await botService.deleteBot('bot-1', 'owner-1');
      expect(mockRedis.del).toHaveBeenCalledWith('bot_llm_logs:bot-1');
    });
  });
});
