/**
 * LLMClient 服务端 LLM 调用测试
 */
import * as http from 'http';
import type { LLMConfig, ChatMessage } from '@chat/shared';

// 需要在 import callLLM 之前先创建模拟服务器
let mockServer: http.Server;
let mockPort: number;
let lastRequestBody: any;
let lastRequestHeaders: http.IncomingHttpHeaders;
let mockResponse: any;

beforeAll((done) => {
  mockServer = http.createServer((req, res) => {
    let body = '';
    lastRequestHeaders = req.headers;
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

// 动态 import 以避免在 mock 之前加载
let callLLM: typeof import('../src/modules/bot/LLMClient').callLLM;
let detectMarkdown: typeof import('../src/modules/bot/LLMClient').detectMarkdown;

beforeAll(async () => {
  const mod = await import('../src/modules/bot/LLMClient');
  callLLM = mod.callLLM;
  detectMarkdown = mod.detectMarkdown;
});

describe('LLMClient', () => {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello' },
  ];

  describe('callLLM — OpenAI Compatible', () => {
    it('should call custom provider with correct URL and body', async () => {
      mockResponse = {
        choices: [{ message: { role: 'assistant', content: 'Hi there!' }, finish_reason: 'stop' }],
      };

      const config: LLMConfig = {
        provider: 'custom',
        apiKey: 'test-key',
        model: 'test-model',
        systemPrompt: '',
        contextLength: 10,
        customBaseUrl: `http://localhost:${mockPort}`,
        customModel: 'my-custom-model',
      };

      const result = await callLLM(config, messages);
      expect(result).toBe('Hi there!');
      expect(lastRequestBody.model).toBe('my-custom-model');
      expect(lastRequestBody.messages).toEqual(messages);
      expect(lastRequestHeaders.authorization).toBe('Bearer test-key');
    });

    it('should throw on empty choices', async () => {
      mockResponse = { choices: [] };

      const config: LLMConfig = {
        provider: 'custom',
        apiKey: 'key',
        model: 'model',
        systemPrompt: '',
        contextLength: 10,
        customBaseUrl: `http://localhost:${mockPort}`,
      };

      await expect(callLLM(config, messages)).rejects.toThrow('LLM returned empty choices');
    });

    it('should throw when custom provider has no customBaseUrl', async () => {
      const config: LLMConfig = {
        provider: 'custom',
        apiKey: 'key',
        model: 'model',
        systemPrompt: '',
        contextLength: 10,
      };

      await expect(callLLM(config, messages)).rejects.toThrow('Custom provider requires customBaseUrl');
    });
  });

  describe('detectMarkdown', () => {
    it('should detect headings', () => {
      expect(detectMarkdown('# Title')).toBe(true);
      expect(detectMarkdown('## Subtitle')).toBe(true);
    });

    it('should detect code blocks', () => {
      expect(detectMarkdown('```js\ncode\n```')).toBe(true);
    });

    it('should detect bold text', () => {
      expect(detectMarkdown('this is **bold** text')).toBe(true);
    });

    it('should detect lists', () => {
      expect(detectMarkdown('- item 1\n- item 2')).toBe(true);
      expect(detectMarkdown('* item 1')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(detectMarkdown('Hello world')).toBe(false);
    });
  });
});
