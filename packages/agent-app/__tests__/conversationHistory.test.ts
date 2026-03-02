import { addMessage, getRecentMessages, clearHistory } from '../src/main/conversationHistory';

describe('ConversationHistory（对话历史管理）', () => {
  afterEach(() => {
    clearHistory('agent-1');
    clearHistory('agent-2');
  });

  it('should add and retrieve messages', () => {
    addMessage('agent-1', 'conv-1', 'user', 'Hello');
    addMessage('agent-1', 'conv-1', 'assistant', 'Hi there!');

    const messages = getRecentMessages('agent-1', 'conv-1', 10);
    expect(messages.length).toBe(2);
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
  });

  it('should limit recent messages by turns', () => {
    // 添加 5 轮对话（10 条消息）
    for (let i = 1; i <= 5; i++) {
      addMessage('agent-1', 'conv-1', 'user', `Question ${i}`);
      addMessage('agent-1', 'conv-1', 'assistant', `Answer ${i}`);
    }

    // 请求最近 2 轮（4 条消息）
    const messages = getRecentMessages('agent-1', 'conv-1', 2);
    expect(messages.length).toBe(4);
    expect(messages[0].content).toBe('Question 4');
    expect(messages[3].content).toBe('Answer 5');
  });

  it('should isolate conversations', () => {
    addMessage('agent-1', 'conv-1', 'user', 'Conv1 msg');
    addMessage('agent-1', 'conv-2', 'user', 'Conv2 msg');

    const conv1 = getRecentMessages('agent-1', 'conv-1', 10);
    const conv2 = getRecentMessages('agent-1', 'conv-2', 10);

    expect(conv1.length).toBe(1);
    expect(conv1[0].content).toBe('Conv1 msg');
    expect(conv2.length).toBe(1);
    expect(conv2[0].content).toBe('Conv2 msg');
  });

  it('should isolate agents', () => {
    addMessage('agent-1', 'conv-1', 'user', 'Agent1 msg');
    addMessage('agent-2', 'conv-1', 'user', 'Agent2 msg');

    const agent1 = getRecentMessages('agent-1', 'conv-1', 10);
    const agent2 = getRecentMessages('agent-2', 'conv-1', 10);

    expect(agent1.length).toBe(1);
    expect(agent1[0].content).toBe('Agent1 msg');
    expect(agent2.length).toBe(1);
    expect(agent2[0].content).toBe('Agent2 msg');
  });

  it('should clear history for an agent', () => {
    addMessage('agent-1', 'conv-1', 'user', 'Hello');
    clearHistory('agent-1');

    const messages = getRecentMessages('agent-1', 'conv-1', 10);
    expect(messages.length).toBe(0);
  });

  it('should return empty for unknown agent/conversation', () => {
    const messages = getRecentMessages('unknown', 'unknown', 10);
    expect(messages).toEqual([]);
  });
});
