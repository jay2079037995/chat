// Mock Mastra Agent（ESM 依赖无法在 Jest CJS 模式下直接加载）
jest.mock('@mastra/core/agent', () => ({
  Agent: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue({ text: 'mock reply' }),
  })),
}));

jest.mock('../src/main/modelFactory', () => ({
  createAgentModel: jest.fn().mockResolvedValue({}),
}));

import { AgentManager, detectMarkdown, parseSlashCommand } from '../src/main/agentManager';
import type { AgentConfig, LogEntry, AgentState } from '../src/shared/types';

const createTestConfig = (overrides: Partial<AgentConfig> = {}): AgentConfig => ({
  id: 'test-agent-1',
  name: 'Test Agent',
  botToken: 'test-token',
  serverUrl: 'http://localhost:19999', // 不存在的端口
  provider: 'deepseek',
  apiKey: 'test-key',
  model: 'deepseek-chat',
  systemPrompt: 'You are a test assistant.',
  contextLength: 10,
  enabled: true,
  createdAt: Date.now(),
  ...overrides,
});

describe('AgentManager（Agent 管理器）', () => {
  let manager: AgentManager;
  let logEntries: LogEntry[];
  let statusChanges: Array<{ agentId: string; state: AgentState }>;

  beforeEach(() => {
    logEntries = [];
    statusChanges = [];
    manager = new AgentManager(
      (entry) => logEntries.push(entry),
      (agentId, state) => statusChanges.push({ agentId, state }),
    );
  });

  afterEach(() => {
    manager.stopAll();
  });

  it('should start and track agent status', () => {
    const config = createTestConfig();
    manager.startAgent(config);

    // 刚启动时状态应该是 running（即使轮询会很快失败）
    expect(manager.getStatus(config.id)).toBe('running');

    // 应有启动日志
    expect(logEntries.some((l) => l.message.includes('已启动'))).toBe(true);
  });

  it('should stop agent', () => {
    const config = createTestConfig();
    manager.startAgent(config);
    manager.stopAgent(config.id);

    expect(manager.getStatus(config.id)).toBe('stopped');
    expect(logEntries.some((l) => l.message.includes('已停止'))).toBe(true);
  });

  it('should return stopped for unknown agent', () => {
    expect(manager.getStatus('unknown')).toBe('stopped');
  });

  it('should return null state for unknown agent', () => {
    expect(manager.getState('unknown')).toBeNull();
  });

  it('should stop all agents', () => {
    const config1 = createTestConfig({ id: 'agent-1', name: 'Agent 1' });
    const config2 = createTestConfig({ id: 'agent-2', name: 'Agent 2' });

    manager.startAgent(config1);
    manager.startAgent(config2);
    manager.stopAll();

    expect(manager.getStatus('agent-1')).toBe('stopped');
    expect(manager.getStatus('agent-2')).toBe('stopped');
  });

  it('should restart agent if started twice', () => {
    const config = createTestConfig();
    manager.startAgent(config);
    manager.startAgent(config);

    // 应有停止 + 重新启动日志
    const stopLogs = logEntries.filter((l) => l.message.includes('已停止'));
    const startLogs = logEntries.filter((l) => l.message.includes('已启动'));
    expect(stopLogs.length).toBe(1);
    expect(startLogs.length).toBe(2);
  });

  it('should emit status changes', () => {
    const config = createTestConfig();
    manager.startAgent(config);

    // 启动时至少有一次状态变更
    expect(statusChanges.length).toBeGreaterThanOrEqual(1);
    expect(statusChanges[0].agentId).toBe(config.id);
  });

  it('should get agent state with stats', () => {
    const config = createTestConfig();
    manager.startAgent(config);

    const state = manager.getState(config.id);
    expect(state).not.toBeNull();
    expect(state!.config.id).toBe(config.id);
    expect(state!.status).toBe('running');
    expect(state!.messagesProcessed).toBe(0);
  });

  it('should accept onConfigChange callback', () => {
    const configChanges: Array<{ agentId: string; updates: Partial<AgentConfig> }> = [];
    const managerWithCallback = new AgentManager(
      (entry) => logEntries.push(entry),
      (agentId, state) => statusChanges.push({ agentId, state }),
      (agentId, updates) => configChanges.push({ agentId, updates }),
    );

    const config = createTestConfig();
    managerWithCallback.startAgent(config);
    expect(managerWithCallback.getStatus(config.id)).toBe('running');
    managerWithCallback.stopAll();
  });
});

describe('detectMarkdown（Markdown 检测）', () => {
  it('should detect headings', () => {
    expect(detectMarkdown('# 标题')).toBe(true);
    expect(detectMarkdown('## 二级标题')).toBe(true);
    expect(detectMarkdown('### 三级标题')).toBe(true);
  });

  it('should detect code blocks', () => {
    expect(detectMarkdown('这是代码:\n```js\nconsole.log(1)\n```')).toBe(true);
  });

  it('should detect bold text', () => {
    expect(detectMarkdown('这是**加粗**文字')).toBe(true);
  });

  it('should detect unordered lists', () => {
    expect(detectMarkdown('- 列表项1\n- 列表项2')).toBe(true);
    expect(detectMarkdown('* 列表项1\n* 列表项2')).toBe(true);
  });

  it('should detect tables', () => {
    expect(detectMarkdown('| 列1 | 列2 |\n|---|---|')).toBe(true);
  });

  it('should return false for plain text', () => {
    expect(detectMarkdown('这是普通文字')).toBe(false);
    expect(detectMarkdown('Hello world')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(detectMarkdown('')).toBe(false);
  });
});

describe('parseSlashCommand（Slash 命令解析）', () => {
  it('should parse /help command', () => {
    const result = parseSlashCommand('/help');
    expect(result).toEqual({ command: '/help', args: '' });
  });

  it('should parse /model with arguments', () => {
    const result = parseSlashCommand('/model gpt-4o');
    expect(result).toEqual({ command: '/model', args: 'gpt-4o' });
  });

  it('should parse /system with long arguments', () => {
    const result = parseSlashCommand('/system You are a helpful assistant');
    expect(result).toEqual({ command: '/system', args: 'You are a helpful assistant' });
  });

  it('should parse /reset command', () => {
    const result = parseSlashCommand('/reset');
    expect(result).toEqual({ command: '/reset', args: '' });
  });

  it('should return null for non-slash messages', () => {
    expect(parseSlashCommand('hello')).toBeNull();
    expect(parseSlashCommand('这是普通消息')).toBeNull();
  });

  it('should be case insensitive for commands', () => {
    const result = parseSlashCommand('/HELP');
    expect(result).toEqual({ command: '/help', args: '' });
  });

  it('should handle leading whitespace', () => {
    const result = parseSlashCommand('  /help  ');
    expect(result).toEqual({ command: '/help', args: '' });
  });
});
