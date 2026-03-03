/**
 * LLMClient 推理模型测试（v1.13.0）
 *
 * 测试 deepseek-reasoner 模型的特殊处理：
 *   - 不传 temperature 参数
 *   - 不传 tools 参数
 *   - 组合 reasoning_content + content 输出
 *   - LLMCallResult 包含 reasoningContent 字段
 */
import * as http from 'http';
import type { LLMConfig, ChatMessage, LLMTool } from '@chat/shared';
import { LLM_PROVIDERS } from '@chat/shared';

let mockServer: http.Server;
let mockPort: number;
let lastRequestBody: any;
let mockResponse: any;

beforeAll((done) => {
  mockServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      lastRequestBody = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockResponse));
    });
  });
  mockServer.listen(0, () => {
    const addr = mockServer.address() as { port: number };
    mockPort = addr.port;
    done();
  });
});

afterAll((done) => {
  mockServer.close(done);
});

let callLLM: typeof import('../src/modules/bot/LLMClient').callLLM;
let callLLMWithTools: typeof import('../src/modules/bot/LLMClient').callLLMWithTools;

beforeAll(async () => {
  const mod = await import('../src/modules/bot/LLMClient');
  callLLM = mod.callLLM;
  callLLMWithTools = mod.callLLMWithTools;
});

const messages: ChatMessage[] = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hello' },
];

const tools: LLMTool[] = [
  {
    type: 'function',
    function: {
      name: 'test_fn',
      description: 'A test function',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

/** 构造指向 mock server 的 custom provider 配置 */
function makeConfig(model: string): LLMConfig {
  return {
    provider: 'custom',
    apiKey: 'test-key',
    model,
    systemPrompt: '',
    contextLength: 10,
    customBaseUrl: `http://localhost:${mockPort}`,
    customModel: model,
  };
}

describe('LLMClient — DeepSeek Reasoner 模型支持', () => {
  afterEach(() => {
    lastRequestBody = undefined;
  });

  // ========== 共享常量 ==========
  describe('LLM_PROVIDERS 常量', () => {
    test('deepseek models 包含 deepseek-reasoner', () => {
      expect(LLM_PROVIDERS.deepseek.models).toContain('deepseek-reasoner');
    });

    test('deepseek models 包含 deepseek-chat', () => {
      expect(LLM_PROVIDERS.deepseek.models).toContain('deepseek-chat');
    });
  });

  // ========== callLLM ==========
  describe('callLLM — 推理模型', () => {
    test('推理模型请求体不含 temperature', async () => {
      mockResponse = {
        choices: [{ message: { role: 'assistant', content: '回答', reasoning_content: '思考' }, finish_reason: 'stop' }],
      };

      await callLLM(makeConfig('deepseek-reasoner'), messages);
      expect(lastRequestBody.temperature).toBeUndefined();
    });

    test('非推理模型请求体包含 temperature', async () => {
      mockResponse = {
        choices: [{ message: { role: 'assistant', content: '回答' }, finish_reason: 'stop' }],
      };

      await callLLM(makeConfig('deepseek-chat'), messages);
      expect(lastRequestBody.temperature).toBe(0.7);
    });

    test('推理模型组合 reasoning_content + content 输出', async () => {
      mockResponse = {
        choices: [{
          message: { role: 'assistant', content: '最终回答', reasoning_content: '这是思考过程' },
          finish_reason: 'stop',
        }],
      };

      const result = await callLLM(makeConfig('deepseek-reasoner'), messages);
      expect(result).toContain('💭 思考过程');
      expect(result).toContain('这是思考过程');
      expect(result).toContain('📝 最终回答');
      expect(result).toContain('最终回答');
      expect(result).toContain('---');
    });

    test('推理模型仅有 reasoning_content 时只输出思考部分', async () => {
      mockResponse = {
        choices: [{
          message: { role: 'assistant', content: null, reasoning_content: '仅思考' },
          finish_reason: 'stop',
        }],
      };

      const result = await callLLM(makeConfig('deepseek-reasoner'), messages);
      expect(result).toContain('仅思考');
      expect(result).not.toContain('📝 最终回答');
    });
  });

  // ========== callLLMWithTools ==========
  describe('callLLMWithTools — 推理模型', () => {
    test('推理模型请求体不含 tools 和 temperature', async () => {
      mockResponse = {
        choices: [{
          message: { role: 'assistant', content: '回答', reasoning_content: '思考过程' },
          finish_reason: 'stop',
        }],
      };

      await callLLMWithTools(makeConfig('deepseek-reasoner'), messages, tools);
      expect(lastRequestBody.tools).toBeUndefined();
      expect(lastRequestBody.temperature).toBeUndefined();
    });

    test('推理模型返回 reasoningContent 字段', async () => {
      mockResponse = {
        choices: [{
          message: { role: 'assistant', content: '最终回答', reasoning_content: '思考链' },
          finish_reason: 'stop',
        }],
      };

      const result = await callLLMWithTools(makeConfig('deepseek-reasoner'), messages, tools);
      expect(result.reasoningContent).toBe('思考链');
      expect(result.hasToolCalls).toBe(false);
    });

    test('非推理模型请求体包含 tools 和 temperature', async () => {
      mockResponse = {
        choices: [{
          message: { role: 'assistant', content: '回答' },
          finish_reason: 'stop',
        }],
      };

      await callLLMWithTools(makeConfig('deepseek-chat'), messages, tools);
      expect(lastRequestBody.tools).toBeDefined();
      expect(lastRequestBody.tools).toHaveLength(1);
      expect(lastRequestBody.temperature).toBe(0.7);
    });

    test('非推理模型不返回 reasoningContent', async () => {
      mockResponse = {
        choices: [{
          message: { role: 'assistant', content: '回答' },
          finish_reason: 'stop',
        }],
      };

      const result = await callLLMWithTools(makeConfig('deepseek-chat'), messages, tools);
      expect(result.reasoningContent).toBeUndefined();
    });
  });
});
