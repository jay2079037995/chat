/**
 * Bot llmLog API 端点测试（v1.26.0）
 *
 * 测试 POST /api/bot/llmLog 端点：token 验证、botId 覆盖、保存调用。
 */
import { BotService } from '../src/modules/bot/BotService';
import type { LLMCallLog } from '@chat/shared';

// ─── Mock Redis ─────────────
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

jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));
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

// ─── Test: llmLog 逻辑 ─────────────

describe('POST /api/bot/llmLog — 逻辑验证', () => {
  let botService: BotService;

  beforeEach(() => {
    jest.clearAllMocks();
    botService = new BotService(mockUserRepo as any, mockMessageRepo as any);
  });

  afterEach(async () => {
    await botService.close();
  });

  test('saveLLMCallLog 保存到 Redis', async () => {
    const log: LLMCallLog = {
      id: 'llm-log-1',
      botId: 'bot-1',
      timestamp: Date.now(),
      conversationId: 'conv-1',
      request: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hello' }],
      },
      response: {
        content: 'Hi there!',
        finishReason: 'stop',
      },
      durationMs: 500,
    };

    await botService.saveLLMCallLog(log);
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      'bot_llm_logs:bot-1',
      log.timestamp,
      expect.any(String),
    );

    // 验证保存的 JSON 内容
    const savedJson = JSON.parse(mockRedis.zadd.mock.calls[0][2]);
    expect(savedJson.id).toBe('llm-log-1');
    expect(savedJson.request.messages).toHaveLength(1);
    expect(savedJson.response.content).toBe('Hi there!');
  });

  test('保存 LLMCallLog 时强制覆盖 botId', () => {
    // 模拟服务端安全覆盖 botId
    const log: LLMCallLog = {
      id: 'llm-log-2',
      botId: 'fake-bot-id',
      timestamp: Date.now(),
      conversationId: 'conv-1',
      request: {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'test' }],
      },
      durationMs: 300,
    };

    const resolvedBotId = 'real-bot-456';
    const sanitizedLog: LLMCallLog = { ...log, botId: resolvedBotId };

    expect(sanitizedLog.botId).toBe('real-bot-456');
    expect(sanitizedLog.request.provider).toBe('openai');
  });

  test('错误 LLM 日志（无 response 有 error）也能保存', async () => {
    const errorLog: LLMCallLog = {
      id: 'llm-log-3',
      botId: 'bot-1',
      timestamp: Date.now(),
      conversationId: 'conv-1',
      request: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hello' }],
      },
      error: 'API rate limit exceeded',
      durationMs: 100,
    };

    await botService.saveLLMCallLog(errorLog);
    expect(mockRedis.zadd).toHaveBeenCalled();

    const savedJson = JSON.parse(mockRedis.zadd.mock.calls[0][2]);
    expect(savedJson.error).toBe('API rate limit exceeded');
    expect(savedJson.response).toBeUndefined();
  });

  test('包含 tools 的 LLM 日志', async () => {
    const log: LLMCallLog = {
      id: 'llm-log-4',
      botId: 'bot-1',
      timestamp: Date.now(),
      conversationId: 'conv-1',
      request: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'list files' }],
        tools: [
          { name: 'bash_exec', description: '' },
          { name: 'read_file', description: '' },
        ],
      },
      response: {
        content: 'Here are the files...',
        finishReason: 'stop',
      },
      durationMs: 800,
    };

    await botService.saveLLMCallLog(log);

    const savedJson = JSON.parse(mockRedis.zadd.mock.calls[0][2]);
    expect(savedJson.request.tools).toHaveLength(2);
    expect(savedJson.request.tools[0].name).toBe('bash_exec');
  });
});
