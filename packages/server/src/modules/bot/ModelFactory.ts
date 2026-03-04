/**
 * AI SDK 模型工厂
 *
 * 根据 LLMConfig 或 MastraLLMConfig 创建 AI SDK LanguageModel 实例。
 * 支持所有 provider（openai/claude/anthropic/google/deepseek/qwen/minimax/custom）。
 * 复用 LocalBotManager.getModel() 的模式。
 */
import type { LanguageModel } from 'ai';
import type { LLMConfig, MastraLLMConfig } from '@chat/shared';
import { LLM_PROVIDERS } from '@chat/shared';

/**
 * 根据 LLMConfig 或 MastraLLMConfig 创建 AI SDK LanguageModel
 */
export async function createModel(config: LLMConfig | MastraLLMConfig): Promise<LanguageModel> {
  const { provider, apiKey, model } = config;

  switch (provider) {
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey })(model);
    }
    case 'claude':
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      return createAnthropic({ apiKey })(model);
    }
    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      return createGoogleGenerativeAI({ apiKey })(model);
    }
    case 'deepseek': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey, baseURL: LLM_PROVIDERS.deepseek.baseUrl })(model);
    }
    case 'qwen': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey, baseURL: LLM_PROVIDERS.qwen.baseUrl })(model);
    }
    case 'minimax': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey, baseURL: LLM_PROVIDERS.minimax.baseUrl })(model);
    }
    case 'custom': {
      const cfg = config as LLMConfig;
      if (!cfg.customBaseUrl) {
        throw new Error('Custom provider requires customBaseUrl');
      }
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey, baseURL: cfg.customBaseUrl })(cfg.customModel || model);
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
