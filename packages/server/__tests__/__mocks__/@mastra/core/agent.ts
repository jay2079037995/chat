/**
 * @mastra/core/agent Jest mock
 *
 * 避免 Jest CJS 模式下加载 ESM-only 依赖（execa）导致解析失败。
 * 同时提供 generate/stream 和 generateLegacy/streamLegacy 方法。
 */
export class Agent {
  constructor(_config: any) {}

  async generate(_messages: any, _options?: any) {
    return { text: 'mock response', finishReason: 'stop' };
  }

  async generateLegacy(_messages: any, _options?: any) {
    return { text: 'mock response', finishReason: 'stop' };
  }

  async stream(_messages: any, _options?: any) {
    async function* textGen() {
      yield 'mock ';
      yield 'stream';
    }
    return { textStream: textGen() };
  }

  async streamLegacy(_messages: any, _options?: any) {
    return {
      textStream: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (!done) { done = true; return { done: false, value: 'mock stream' }; }
              return { done: true, value: undefined };
            },
            releaseLock: () => {},
          };
        },
      },
    };
  }
}
