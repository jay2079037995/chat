/**
 * BotService — Agent 生成日志测试
 *
 * 测试 saveAgentGenerationLog / getAgentGenerationLogs / clearAgentGenerationLogs 方法。
 */
import Redis from 'ioredis';
import { BotService } from '../src/modules/bot/BotService';
import type { AgentGenerationLog } from '@chat/shared';

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

/** 构造测试用 AgentGenerationLog */
function makeGenLog(botId: string, overrides?: Partial<AgentGenerationLog>): AgentGenerationLog {
  return {
    generationId: 'gen-1',
    botId,
    conversationId: 'conv-1',
    startTime: Date.now(),
    totalDurationMs: 1500,
    stepCount: 2,
    success: true,
    steps: [
      {
        id: 'step-1',
        botId,
        conversationId: 'conv-1',
        generationId: 'gen-1',
        stepIndex: 1,
        type: 'llm_call',
        timestamp: Date.now(),
        durationMs: 1000,
        llmInfo: { provider: 'deepseek', model: 'deepseek-chat', finishReason: 'stop' },
      },
      {
        id: 'step-2',
        botId,
        conversationId: 'conv-1',
        generationId: 'gen-1',
        stepIndex: 2,
        type: 'tool_call',
        timestamp: Date.now(),
        toolName: 'bash_exec',
        toolInput: { command: 'ls -la' },
        toolOutput: 'file1.txt\nfile2.txt',
        durationMs: 500,
      },
    ],
    ...overrides,
  };
}

describe('BotService — Agent 生成日志', () => {
  let botService: BotService;

  beforeEach(() => {
    jest.clearAllMocks();
    botService = new BotService(mockUserRepo as any, mockMessageRepo as any);
  });


  describe('saveAgentGenerationLog', () => {
    test('调用 zadd 存入 Sorted Set', async () => {
      const log = makeGenLog('bot-1');
      await botService.saveAgentGenerationLog(log);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'bot_gen_logs:bot-1',
        log.startTime,
        JSON.stringify(log),
      );
    });

    test('未超量时不调用 zremrangebyrank', async () => {
      mockRedis.zcard.mockResolvedValueOnce(50);
      await botService.saveAgentGenerationLog(makeGenLog('bot-1'));
      expect(mockRedis.zremrangebyrank).not.toHaveBeenCalled();
    });

    test('超过 100 条时调用 zremrangebyrank 裁剪', async () => {
      mockRedis.zcard.mockResolvedValueOnce(105);
      await botService.saveAgentGenerationLog(makeGenLog('bot-1'));
      expect(mockRedis.zremrangebyrank).toHaveBeenCalledWith(
        'bot_gen_logs:bot-1',
        0,
        4,
      );
    });

    test('设置 7 天 expire', async () => {
      await botService.saveAgentGenerationLog(makeGenLog('bot-1'));
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'bot_gen_logs:bot-1',
        7 * 24 * 60 * 60,
      );
    });
  });

  describe('getAgentGenerationLogs', () => {
    test('调用 zrevrange 倒序查询', async () => {
      const logData = makeGenLog('bot-1');
      mockRedis.zcard.mockResolvedValueOnce(1);
      mockRedis.zrevrange.mockResolvedValueOnce([JSON.stringify(logData)]);

      const result = await botService.getAgentGenerationLogs('bot-1', 0, 20);

      expect(mockRedis.zrevrange).toHaveBeenCalledWith('bot_gen_logs:bot-1', 0, 19);
      expect(result.total).toBe(1);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].generationId).toBe('gen-1');
      expect(result.logs[0].steps).toHaveLength(2);
    });

    test('offset/limit 正确传递', async () => {
      mockRedis.zcard.mockResolvedValueOnce(100);
      mockRedis.zrevrange.mockResolvedValueOnce([]);

      await botService.getAgentGenerationLogs('bot-1', 20, 10);
      expect(mockRedis.zrevrange).toHaveBeenCalledWith('bot_gen_logs:bot-1', 20, 29);
    });
  });

  describe('clearAgentGenerationLogs', () => {
    test('调用 del 清空日志', async () => {
      await botService.clearAgentGenerationLogs('bot-1');
      expect(mockRedis.del).toHaveBeenCalledWith('bot_gen_logs:bot-1');
    });
  });
});
