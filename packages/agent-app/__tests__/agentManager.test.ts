import { AgentManager } from '../src/main/agentManager';
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
});
