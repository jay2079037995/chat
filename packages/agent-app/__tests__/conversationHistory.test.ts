import {
  addMessage,
  getRecentMessages,
  clearHistory,
  hasHistory,
  prefillHistory,
  clearConversationHistory,
} from '../src/main/conversationHistory';

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

describe('ConversationHistory — prefillHistory', () => {
  afterEach(() => {
    clearHistory('agent-1');
  });

  it('should prefill history from server messages', () => {
    const serverMessages = [
      { senderId: 'user-1', content: '你好', createdAt: 1000 },
      { senderId: 'bot-1', content: '你好！', createdAt: 2000 },
      { senderId: 'user-1', content: '天气', createdAt: 3000 },
    ];

    prefillHistory('agent-1', 'conv-1', serverMessages, 'bot-1');

    const messages = getRecentMessages('agent-1', 'conv-1', 10);
    expect(messages.length).toBe(3);
    expect(messages[0]).toEqual({ role: 'user', content: '你好' });
    expect(messages[1]).toEqual({ role: 'assistant', content: '你好！' });
    expect(messages[2]).toEqual({ role: 'user', content: '天气' });
  });

  it('should map botUserId to assistant role and others to user role', () => {
    const serverMessages = [
      { senderId: 'human', content: 'Q', createdAt: 1000 },
      { senderId: 'thebot', content: 'A', createdAt: 2000 },
    ];

    prefillHistory('agent-1', 'conv-1', serverMessages, 'thebot');

    const messages = getRecentMessages('agent-1', 'conv-1', 10);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
  });

  it('should sort messages by createdAt', () => {
    const serverMessages = [
      { senderId: 'user-1', content: '第二条', createdAt: 2000 },
      { senderId: 'bot-1', content: '第一条', createdAt: 1000 },
    ];

    prefillHistory('agent-1', 'conv-1', serverMessages, 'bot-1');

    const messages = getRecentMessages('agent-1', 'conv-1', 10);
    expect(messages[0].content).toBe('第一条');
    expect(messages[1].content).toBe('第二条');
  });

  it('should skip prefill when history already exists', () => {
    addMessage('agent-1', 'conv-1', 'user', '已有消息');

    const serverMessages = [
      { senderId: 'user-1', content: '服务端消息', createdAt: 1000 },
    ];

    prefillHistory('agent-1', 'conv-1', serverMessages, 'bot-1');

    const messages = getRecentMessages('agent-1', 'conv-1', 10);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('已有消息');
  });
});

describe('ConversationHistory — hasHistory & clearConversationHistory', () => {
  afterEach(() => {
    clearHistory('agent-1');
  });

  it('should return false for empty history', () => {
    expect(hasHistory('agent-1', 'conv-1')).toBe(false);
  });

  it('should return true after adding message', () => {
    addMessage('agent-1', 'conv-1', 'user', 'Hello');
    expect(hasHistory('agent-1', 'conv-1')).toBe(true);
  });

  it('should clear only specific conversation history', () => {
    addMessage('agent-1', 'conv-1', 'user', 'Hello');
    addMessage('agent-1', 'conv-2', 'user', 'World');

    clearConversationHistory('agent-1', 'conv-1');

    expect(hasHistory('agent-1', 'conv-1')).toBe(false);
    expect(hasHistory('agent-1', 'conv-2')).toBe(true);
  });
});
