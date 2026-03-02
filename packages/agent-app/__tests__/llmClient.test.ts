import { PROVIDERS } from '../src/shared/types';

describe('LLM Client（LLM 客户端配置）', () => {
  it('should have correct DeepSeek provider config', () => {
    const deepseek = PROVIDERS.deepseek;
    expect(deepseek.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(deepseek.models).toContain('deepseek-chat');
  });

  it('should have correct MiniMax provider config', () => {
    const minimax = PROVIDERS.minimax;
    expect(minimax.baseUrl).toBe('https://api.minimax.io/v1');
    expect(minimax.models).toContain('MiniMax-M2.5');
  });

  it('should have correct OpenAI provider config', () => {
    const openai = PROVIDERS.openai;
    expect(openai.baseUrl).toBe('https://api.openai.com/v1');
    expect(openai.models).toContain('gpt-4o');
    expect(openai.models).toContain('gpt-4o-mini');
  });

  it('should have correct Claude provider config', () => {
    const claude = PROVIDERS.claude;
    expect(claude.baseUrl).toBe('https://api.anthropic.com/v1');
    expect(claude.models).toContain('claude-sonnet-4-20250514');
    expect(claude.models).toContain('claude-haiku-4-5-20251001');
  });

  it('should have correct Qwen provider config', () => {
    const qwen = PROVIDERS.qwen;
    expect(qwen.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
    expect(qwen.models).toContain('qwen-plus');
    expect(qwen.models).toContain('qwen-turbo');
  });

  it('should have custom provider with empty defaults', () => {
    const custom = PROVIDERS.custom;
    expect(custom.baseUrl).toBe('');
    expect(custom.models).toEqual([]);
  });

  it('should have all required provider fields for non-custom providers', () => {
    for (const [name, provider] of Object.entries(PROVIDERS)) {
      if (name === 'custom') continue;
      expect(provider.baseUrl).toBeDefined();
      expect(provider.baseUrl).toMatch(/^https:\/\//);
      expect(provider.models.length).toBeGreaterThan(0);
    }
  });
});
