import { BotClient } from '../src/main/botClient';

describe('BotClient（Bot API 客户端）', () => {
  it('should construct with serverUrl and token', () => {
    const client = new BotClient('http://localhost:3001', 'test-token');
    expect(client).toBeDefined();
  });

  it('should handle getUpdates network error gracefully', async () => {
    // 使用一个不存在的端口，确保连接失败
    const client = new BotClient('http://localhost:19999', 'test-token');
    await expect(client.getUpdates(1)).rejects.toThrow();
  });

  it('should handle sendMessage network error gracefully', async () => {
    const client = new BotClient('http://localhost:19999', 'test-token');
    await expect(client.sendMessage('conv-1', 'hello')).rejects.toThrow();
  });

  it('should have getHistory method', () => {
    const client = new BotClient('http://localhost:3001', 'test-token');
    expect(typeof client.getHistory).toBe('function');
  });

  it('should handle getHistory network error gracefully', async () => {
    const client = new BotClient('http://localhost:19999', 'test-token');
    await expect(client.getHistory('conv-1')).rejects.toThrow();
  });

  // v1.25.0: 步骤进度 + 生成日志方法
  it('should have reportStepProgress method', () => {
    const client = new BotClient('http://localhost:3001', 'test-token');
    expect(typeof client.reportStepProgress).toBe('function');
  });

  it('should handle reportStepProgress network error gracefully', async () => {
    const client = new BotClient('http://localhost:19999', 'test-token');
    await expect(client.reportStepProgress('conv-1', 'generating', 'start')).rejects.toThrow();
  });

  it('should have saveGenerationLog method', () => {
    const client = new BotClient('http://localhost:3001', 'test-token');
    expect(typeof client.saveGenerationLog).toBe('function');
  });

  it('should handle saveGenerationLog network error gracefully', async () => {
    const client = new BotClient('http://localhost:19999', 'test-token');
    await expect(client.saveGenerationLog({
      generationId: 'gen-1',
      botId: 'bot-1',
      conversationId: 'conv-1',
      startTime: Date.now(),
      totalDurationMs: 1000,
      stepCount: 1,
      success: true,
      steps: [],
    })).rejects.toThrow();
  });

  // v1.26.0: LLM 调用日志方法
  it('should have saveLLMCallLog method', () => {
    const client = new BotClient('http://localhost:3001', 'test-token');
    expect(typeof client.saveLLMCallLog).toBe('function');
  });

  it('should handle saveLLMCallLog network error gracefully', async () => {
    const client = new BotClient('http://localhost:19999', 'test-token');
    await expect(client.saveLLMCallLog({
      id: 'llm-1',
      botId: 'bot-1',
      timestamp: Date.now(),
      conversationId: 'conv-1',
      request: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hello' }],
      },
      durationMs: 500,
    })).rejects.toThrow();
  });
});
