/**
 * 服务端 Bot 综合测试
 *
 * 测试 BotService 新增方法、ServerBotRunner、ServerBotManager。
 */
import Redis from 'ioredis';
import { BotService } from '../src/modules/bot/BotService';
import { ServerBotManager } from '../src/modules/bot/ServerBotManager';
import type { LLMConfig, BotRunMode } from '@chat/shared';

// ============================
// Mock 依赖
// ============================
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
  apiKey: 'sk-test123456',
  model: 'deepseek-chat',
  systemPrompt: 'You are a test bot.',
  contextLength: 10,
};

describe('BotService — Server Bot Methods', () => {
  let botService: BotService;

  beforeEach(() => {
    jest.clearAllMocks();
    botService = new BotService(mockUserRepo as any, mockMessageRepo as any);
  });

  afterEach(async () => {
    await botService.close();
  });

  describe('createBot with server mode', () => {
    it('should create server mode bot with LLM config', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(null);
      mockUserRepo.createBot.mockResolvedValue({
        id: 'bot-1',
        username: 'testbot',
        isBot: true,
        botOwnerId: 'owner-1',
        createdAt: Date.now(),
      });

      const result = await botService.createBot('owner-1', 'testbot', 'server', TEST_LLM_CONFIG);
      expect(result.runMode).toBe('server');
      // 应保存 LLM 配置
      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.stringContaining('bot_config:'),
        expect.objectContaining({ provider: 'deepseek', model: 'deepseek-chat' }),
      );
      // 应加入 server_bots set
      expect(mockRedis.sadd).toHaveBeenCalledWith('server_bots', expect.any(String));
    });

    it('should throw when server mode has no LLM config', async () => {
      await expect(
        botService.createBot('owner-1', 'testbot', 'server'),
      ).rejects.toThrow('SERVER_MODE_REQUIRES_LLM_CONFIG');
    });

    it('should create client mode bot without LLM config', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(null);
      mockUserRepo.createBot.mockResolvedValue({
        id: 'bot-2',
        username: 'clientbot',
        isBot: true,
        botOwnerId: 'owner-1',
        createdAt: Date.now(),
      });

      const result = await botService.createBot('owner-1', 'clientbot', 'client');
      expect(result.runMode).toBe('client');
      expect(mockRedis.sadd).not.toHaveBeenCalledWith('server_bots', expect.any(String));
    });
  });

  describe('sendMessageByBotId', () => {
    it('should send message without token verification', async () => {
      mockMessageRepo.getConversation.mockResolvedValue({
        id: 'conv-1',
        participants: ['bot-1', 'user-1'],
      });
      mockMessageRepo.saveMessage.mockResolvedValue({ id: 'msg-1' });

      const result = await botService.sendMessageByBotId('bot-1', 'conv-1', 'Hello!');
      expect(result).toEqual({ id: 'msg-1' });
      expect(mockMessageRepo.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: 'bot-1',
          conversationId: 'conv-1',
          content: 'Hello!',
        }),
      );
    });

    it('should throw if bot is not a participant', async () => {
      mockMessageRepo.getConversation.mockResolvedValue({
        id: 'conv-1',
        participants: ['user-1', 'user-2'],
      });

      await expect(
        botService.sendMessageByBotId('bot-1', 'conv-1', 'Hello!'),
      ).rejects.toThrow('NOT_PARTICIPANT');
    });
  });

  describe('saveServerBotConfig / getServerBotConfig', () => {
    it('should save and retrieve config with encrypted API key', async () => {
      // 保存配置
      await botService.saveServerBotConfig('bot-1', TEST_LLM_CONFIG);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'bot_config:bot-1',
        expect.objectContaining({
          provider: 'deepseek',
          model: 'deepseek-chat',
          encryptedApiKey: expect.any(String),
        }),
      );

      // 验证加密的 apiKey 不是明文
      const savedCall = mockRedis.hset.mock.calls.find((c: any[]) => c[0] === 'bot_config:bot-1');
      expect(savedCall[1].encryptedApiKey).not.toBe('sk-test123456');
    });
  });

  describe('setBotRunMode / getBotRunMode', () => {
    it('should set and get run mode', async () => {
      await botService.setBotRunMode('bot-1', 'server');
      expect(mockRedis.hset).toHaveBeenCalledWith('user:bot-1', 'runMode', 'server');

      mockRedis.hget.mockResolvedValueOnce('server');
      const mode = await botService.getBotRunMode('bot-1');
      expect(mode).toBe('server');
    });

    it('should default to client when no mode is set', async () => {
      mockRedis.hget.mockResolvedValueOnce(null);
      const mode = await botService.getBotRunMode('bot-1');
      expect(mode).toBe('client');
    });
  });

  describe('setBotStatus / getBotStatus', () => {
    it('should set and get status', async () => {
      await botService.setBotStatus('bot-1', 'running');
      expect(mockRedis.hset).toHaveBeenCalledWith('user:bot-1', 'status', 'running');

      mockRedis.hget
        .mockResolvedValueOnce('running')
        .mockResolvedValueOnce(null);
      const { status, error } = await botService.getBotStatus('bot-1');
      expect(status).toBe('running');
      expect(error).toBeUndefined();
    });

    it('should set status with error message', async () => {
      await botService.setBotStatus('bot-1', 'error', 'LLM timeout');
      expect(mockRedis.hset).toHaveBeenCalledWith('user:bot-1', 'statusError', 'LLM timeout');
    });
  });

  describe('conversation history', () => {
    it('should save and retrieve conversation history', async () => {
      await botService.saveConvHistory('bot-1', 'conv-1', { role: 'user', content: 'Hi' });
      expect(mockRedis.rpush).toHaveBeenCalledWith(
        'bot_conv_history:bot-1:conv-1',
        JSON.stringify({ role: 'user', content: 'Hi' }),
      );
    });

    it('should clear conversation history', async () => {
      await botService.clearConvHistory('bot-1', 'conv-1');
      expect(mockRedis.del).toHaveBeenCalledWith('bot_conv_history:bot-1:conv-1');
    });
  });

  describe('deleteBot — server mode cleanup', () => {
    it('should clean up server bot data on delete', async () => {
      mockUserRepo.findById.mockResolvedValue({
        id: 'bot-1',
        isBot: true,
        botOwnerId: 'owner-1',
      });
      mockRedis.hget.mockResolvedValueOnce('server');
      mockRedis.keys.mockResolvedValueOnce(['bot_conv_history:bot-1:conv-1', 'bot_conv_history:bot-1:conv-2']);

      await botService.deleteBot('bot-1', 'owner-1');

      expect(mockRedis.del).toHaveBeenCalledWith('bot_config:bot-1');
      expect(mockRedis.srem).toHaveBeenCalledWith('server_bots', 'bot-1');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'bot_conv_history:bot-1:conv-1',
        'bot_conv_history:bot-1:conv-2',
      );
      expect(mockUserRepo.deleteBot).toHaveBeenCalledWith('bot-1');
    });
  });
});

describe('ServerBotManager', () => {
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

  it('should start and stop a bot', async () => {
    await manager.startBot('bot-1', TEST_LLM_CONFIG);
    expect(manager.isRunning('bot-1')).toBe(true);

    await manager.stopBot('bot-1');
    expect(manager.isRunning('bot-1')).toBe(false);
  });

  it('should stop all bots', async () => {
    await manager.startBot('bot-1', TEST_LLM_CONFIG);
    await manager.startBot('bot-2', TEST_LLM_CONFIG);
    expect(manager.isRunning('bot-1')).toBe(true);
    expect(manager.isRunning('bot-2')).toBe(true);

    await manager.stopAll();
    expect(manager.isRunning('bot-1')).toBe(false);
    expect(manager.isRunning('bot-2')).toBe(false);
  });

  it('should return null for unknown bot status', () => {
    expect(manager.getBotStatus('unknown')).toBeNull();
  });
});
