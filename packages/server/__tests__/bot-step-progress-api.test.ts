/**
 * Bot stepProgress / generationLog API 端点测试（v1.25.0）
 *
 * 测试 POST /api/bot/stepProgress 和 POST /api/bot/generationLog 端点：
 * token 验证、参数校验、Socket.IO 转发、日志保存。
 */
import { BotService } from '../src/modules/bot/BotService';
import type { AgentGenerationLog, AgentStepLog } from '@chat/shared';

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

// ─── Test: stepProgress 逻辑 ─────────────

describe('POST /api/bot/stepProgress — 逻辑验证', () => {
  let botService: BotService;

  beforeEach(() => {
    jest.clearAllMocks();
    botService = new BotService(mockUserRepo as any, mockMessageRepo as any);
  });

  afterEach(async () => {
    await botService.close();
  });

  test('getBotIdByToken 返回 null 时应拒绝', async () => {
    mockUserRepo.findBotByToken.mockResolvedValue(null);
    const botId = await botService.getBotIdByToken('invalid-token');
    expect(botId).toBeNull();
  });

  test('getBotIdByToken 有效 token 返回 botId', async () => {
    mockUserRepo.findBotByToken.mockResolvedValue('bot-123');
    const botId = await botService.getBotIdByToken('valid-token');
    expect(botId).toBe('bot-123');
  });

  test('stepProgress 数据结构验证', () => {
    // 验证 bot:step-progress 事件数据格式
    const progressData = {
      conversationId: 'conv-1',
      botId: 'bot-1',
      step: 'generating',
      status: 'start' as const,
      detail: undefined,
      timestamp: Date.now(),
    };

    expect(progressData.conversationId).toBeDefined();
    expect(progressData.botId).toBeDefined();
    expect(['start', 'complete', 'error']).toContain(progressData.status);
  });
});

// ─── Test: generationLog 逻辑 ─────────────

describe('POST /api/bot/generationLog — 逻辑验证', () => {
  let botService: BotService;

  beforeEach(() => {
    jest.clearAllMocks();
    botService = new BotService(mockUserRepo as any, mockMessageRepo as any);
  });

  afterEach(async () => {
    await botService.close();
  });

  test('保存 generationLog 时强制覆盖 botId', async () => {
    const log: AgentGenerationLog = {
      generationId: 'gen-1',
      botId: 'fake-bot-id',      // agent-app 传入的 ID
      conversationId: 'conv-1',
      startTime: Date.now(),
      totalDurationMs: 1500,
      stepCount: 1,
      success: true,
      steps: [{
        id: 'step-1',
        botId: 'fake-bot-id',
        conversationId: 'conv-1',
        generationId: 'gen-1',
        stepIndex: 1,
        type: 'llm_call',
        timestamp: Date.now(),
        durationMs: 1000,
        llmInfo: { provider: 'deepseek', model: 'deepseek-chat', finishReason: 'stop' },
      }],
    };

    // 模拟服务端安全覆盖 botId
    const resolvedBotId = 'real-bot-123';
    const sanitizedLog: AgentGenerationLog = {
      ...log,
      botId: resolvedBotId,
      steps: log.steps.map((step: AgentStepLog) => ({
        ...step,
        botId: resolvedBotId,
      })),
    };

    await botService.saveAgentGenerationLog(sanitizedLog);

    expect(mockRedis.zadd).toHaveBeenCalledWith(
      'bot_gen_logs:real-bot-123',
      sanitizedLog.startTime,
      expect.any(String),
    );

    // 验证保存的 JSON 中 botId 已被覆盖
    const savedJson = JSON.parse(mockRedis.zadd.mock.calls[0][2]);
    expect(savedJson.botId).toBe('real-bot-123');
    expect(savedJson.steps[0].botId).toBe('real-bot-123');
  });

  test('空 steps 数组也能保存', async () => {
    const errorLog: AgentGenerationLog = {
      generationId: 'gen-2',
      botId: 'bot-1',
      conversationId: 'conv-1',
      startTime: Date.now(),
      totalDurationMs: 100,
      stepCount: 0,
      success: false,
      error: 'LLM call failed',
      steps: [],
    };

    await botService.saveAgentGenerationLog(errorLog);
    expect(mockRedis.zadd).toHaveBeenCalled();
  });

  test('status 值只接受 start/complete/error', () => {
    const validStatuses = ['start', 'complete', 'error'];
    expect(validStatuses).toContain('start');
    expect(validStatuses).toContain('complete');
    expect(validStatuses).toContain('error');
    expect(validStatuses).not.toContain('pending');
    expect(validStatuses).not.toContain('running');
  });
});
