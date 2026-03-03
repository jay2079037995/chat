/**
 * LLMClient Function Calling 扩展测试
 *
 * 测试 callLLMWithTools 对 OpenAI 和 Claude 格式的处理。
 */
import type { LLMConfig, ChatMessage, LLMTool } from '@chat/shared';

// 全局响应数据（jest.mock 工厂函数可见）
let _mockResponse: unknown = {};

jest.mock('https', () => ({
  request: jest.fn((_options: unknown, callback: (res: unknown) => void) => {
    const mockRes = {
      statusCode: 200,
      on: jest.fn((event: string, handler: (data: string) => void) => {
        if (event === 'data') handler(JSON.stringify(_mockResponse));
        if (event === 'end') handler('');
      }),
    };
    callback(mockRes);
    return {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
  }),
}));

jest.mock('http', () => ({
  request: jest.fn((_options: unknown, callback: (res: unknown) => void) => {
    const mockRes = {
      statusCode: 200,
      on: jest.fn((event: string, handler: (data: string) => void) => {
        if (event === 'data') handler(JSON.stringify(_mockResponse));
        if (event === 'end') handler('');
      }),
    };
    callback(mockRes);
    return {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
  }),
}));

import { callLLMWithTools } from '../src/modules/bot/LLMClient';

const mockConfig: LLMConfig = {
  provider: 'openai',
  apiKey: 'test-key',
  model: 'gpt-4',
  systemPrompt: 'You are a helper.',
  contextLength: 10,
};

const mockTools: LLMTool[] = [
  {
    type: 'function',
    function: {
      name: 'test_fn',
      description: 'A test function',
      parameters: {
        type: 'object',
        properties: { q: { type: 'string', description: 'query' } },
        required: ['q'],
      },
    },
  },
];

const mockMessages: ChatMessage[] = [
  { role: 'system', content: 'You are a helper.' },
  { role: 'user', content: 'Hello' },
];

describe('callLLMWithTools', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('OpenAI 格式 — 无 tool_calls 时返回文本', async () => {
    _mockResponse = {
      choices: [{
        message: { role: 'assistant', content: 'Hello!' },
        finish_reason: 'stop',
      }],
    };

    const result = await callLLMWithTools(mockConfig, mockMessages, mockTools);
    expect(result.hasToolCalls).toBe(false);
    expect(result.content).toBe('Hello!');
    expect(result.finishReason).toBe('stop');
  });

  test('OpenAI 格式 — 有 tool_calls 时返回 toolCalls', async () => {
    _mockResponse = {
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: { name: 'test_fn', arguments: '{"q":"test"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
    };

    const result = await callLLMWithTools(mockConfig, mockMessages, mockTools);
    expect(result.hasToolCalls).toBe(true);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].id).toBe('call_123');
    expect(result.toolCalls![0].function.name).toBe('test_fn');
  });

  test('不传 tools 时行为与纯文本一致', async () => {
    _mockResponse = {
      choices: [{
        message: { role: 'assistant', content: 'No tools here.' },
        finish_reason: 'stop',
      }],
    };

    const result = await callLLMWithTools(mockConfig, mockMessages);
    expect(result.hasToolCalls).toBe(false);
    expect(result.content).toBe('No tools here.');
  });
});
