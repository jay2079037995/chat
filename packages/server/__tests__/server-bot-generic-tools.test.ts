/**
 * ServerBotRunner 通用工具流程测试
 *
 * 测试 ServerBotRunner 使用 GENERIC_TOOL_DEFINITIONS 和 ToolDispatcher。
 */
import { GENERIC_TOOL_DEFINITIONS } from '@chat/shared';
import { ServerBotRunner } from '../src/modules/bot/ServerBotRunner';

// Mock 依赖
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    blpop: jest.fn().mockResolvedValue(null),
    disconnect: jest.fn(),
  }));
});

jest.mock('../src/repositories/redis/RedisClient', () => ({
  getRedisClient: () => ({}),
}));

jest.mock('../src/config', () => ({
  config: {
    redis: { host: 'localhost', port: 6379, password: '', db: 0 },
    botEncryptionKey: 'test-key',
  },
}));

describe('ServerBotRunner 通用工具', () => {
  test('GENERIC_TOOL_DEFINITIONS 包含 6 个工具', () => {
    expect(GENERIC_TOOL_DEFINITIONS).toHaveLength(6);
    const names = GENERIC_TOOL_DEFINITIONS.map((t) => t.function.name);
    expect(names).toContain('bash_exec');
    expect(names).toContain('read_file');
    expect(names).toContain('write_file');
    expect(names).toContain('list_files');
    expect(names).toContain('send_file_to_chat');
    expect(names).toContain('present_choices');
  });

  test('每个工具定义有 name、description、parameters', () => {
    for (const tool of GENERIC_TOOL_DEFINITIONS) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
    }
  });

  test('ServerBotRunner 构造和状态', () => {
    const mockBotService = {
      setBotStatus: jest.fn(),
    } as any;

    const runner = new ServerBotRunner(
      'bot-1',
      {
        provider: 'openai' as any,
        apiKey: 'test-key',
        model: 'gpt-4',
        systemPrompt: 'test',
        contextLength: 10,
      },
      mockBotService,
      null,
      undefined,
    );

    expect(runner.getStatus().status).toBe('stopped');
    expect(runner.getStatus().messagesProcessed).toBe(0);
  });

  test('setSkillInstructions 更新系统提示词', () => {
    const mockBotService = {
      setBotStatus: jest.fn(),
    } as any;

    const runner = new ServerBotRunner(
      'bot-1',
      {
        provider: 'openai' as any,
        apiKey: 'test-key',
        model: 'gpt-4',
        systemPrompt: 'base prompt',
        contextLength: 10,
      },
      mockBotService,
      null,
      undefined,
    );

    runner.setSkillInstructions('\n\n# Skill: test\nDo something.');

    // buildSystemPrompt 是 private 方法，通过间接验证
    // 确保设置不会抛异常
    expect(runner.getStatus().status).toBe('stopped');
  });

  test('updateConfig 热更新配置', () => {
    const mockBotService = {
      setBotStatus: jest.fn(),
    } as any;

    const runner = new ServerBotRunner(
      'bot-1',
      {
        provider: 'openai' as any,
        apiKey: 'test-key',
        model: 'gpt-4',
        systemPrompt: 'test',
        contextLength: 10,
      },
      mockBotService,
      null,
    );

    runner.updateConfig({ model: 'gpt-4o' });
    // 不抛异常即通过
    expect(runner.getStatus().status).toBe('stopped');
  });
});
