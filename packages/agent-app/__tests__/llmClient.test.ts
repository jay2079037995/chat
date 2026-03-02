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

  it('should have all required provider fields', () => {
    for (const [name, provider] of Object.entries(PROVIDERS)) {
      expect(provider.baseUrl).toBeDefined();
      expect(provider.baseUrl).toMatch(/^https:\/\//);
      expect(provider.models.length).toBeGreaterThan(0);
    }
  });
});
