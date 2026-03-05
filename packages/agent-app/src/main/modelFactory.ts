/**
 * Agent-App 模型工厂
 *
 * 根据 AgentConfig 创建 AI SDK LanguageModel，
 * 供 Mastra Agent 使用。
 */
import type { LanguageModel } from 'ai';
import type { AgentConfig } from '../shared/types';
import { PROVIDERS } from '../shared/types';

export async function createAgentModel(config: AgentConfig): Promise<LanguageModel> {
  const { provider, apiKey, model } = config;

  switch (provider) {
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey })(model);
    }
    case 'claude': {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      return createAnthropic({ apiKey })(model);
    }
    case 'deepseek': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey, baseURL: PROVIDERS.deepseek.baseUrl })(model);
    }
    case 'minimax': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey, baseURL: PROVIDERS.minimax.baseUrl })(model);
    }
    case 'qwen': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey, baseURL: PROVIDERS.qwen.baseUrl })(model);
    }
    case 'custom': {
      if (!config.customBaseUrl) throw new Error('Custom provider requires customBaseUrl');
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey, baseURL: config.customBaseUrl })(config.customModel || model);
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
