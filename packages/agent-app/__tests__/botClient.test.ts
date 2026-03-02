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
});
