/**
 * AI SDK 模型工厂（v2.0.0）
 *
 * 根据 BotModelConfig 创建 AI SDK LanguageModel 实例。
 * 使用 "provider/model" 字符串格式路由到对应 AI SDK provider。
 *
 * 支持 13 个 provider：
 * - 云端：anthropic, openai, google, deepseek, xai, mistral, groq, moonshot, qwen, siliconflow
 * - 本地：ollama, lmstudio
 * - 自定义：custom（任意 OpenAI 兼容端点）
 */
import type { LanguageModel } from 'ai';
import type { BotModelConfig } from '@chat/shared';
import { MODEL_PROVIDERS } from '@chat/shared';

/**
 * 解析 "provider/model" 格式的模型字符串
 */
export function parseModelString(modelStr: string): { provider: string; modelId: string } {
  const slashIdx = modelStr.indexOf('/');
  if (slashIdx === -1) {
    throw new Error(`无效的模型字符串格式，应为 "provider/model": ${modelStr}`);
  }
  return {
    provider: modelStr.slice(0, slashIdx),
    modelId: modelStr.slice(slashIdx + 1),
  };
}

/**
 * 判断是否为推理模型（不支持 tool calling）
 */
export function isReasonerModel(model: string): boolean {
  const reasonerPatterns = [
    'deepseek-reasoner',
    'o1', 'o1-mini', 'o1-preview',
    'o3', 'o3-mini',
  ];
  const { modelId } = parseModelString(model);
  return reasonerPatterns.some(p => modelId === p);
}

/**
 * 根据 BotModelConfig 创建 AI SDK LanguageModel
 */
export async function createModel(config: BotModelConfig): Promise<LanguageModel> {
  const { provider, modelId } = parseModelString(config.model);
  const apiKey = config.apiKey;
  const providerInfo = MODEL_PROVIDERS[provider];
  const baseURL = config.baseUrl || providerInfo?.baseUrl;

  switch (provider) {
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      return createAnthropic({ apiKey })(modelId);
    }

    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ apiKey })(modelId);
    }

    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      return createGoogleGenerativeAI({ apiKey })(modelId);
    }

    case 'xai': {
      const { createXai } = await import('@ai-sdk/xai');
      return createXai({ apiKey })(modelId) as unknown as LanguageModel;
    }

    case 'mistral': {
      const { createMistral } = await import('@ai-sdk/mistral');
      return createMistral({ apiKey })(modelId) as unknown as LanguageModel;
    }

    case 'groq': {
      const { createGroq } = await import('@ai-sdk/groq');
      return createGroq({ apiKey })(modelId) as unknown as LanguageModel;
    }

    // OpenAI 兼容端点：deepseek, moonshot, qwen, siliconflow, ollama, lmstudio, custom
    case 'deepseek':
    case 'moonshot':
    case 'qwen':
    case 'siliconflow':
    case 'ollama':
    case 'lmstudio':
    case 'custom': {
      if (!baseURL) {
        throw new Error(`Provider "${provider}" 需要 baseUrl 配置`);
      }
      const { createOpenAI } = await import('@ai-sdk/openai');
      const opts: Record<string, unknown> = { baseURL };
      if (apiKey) opts.apiKey = apiKey;
      return createOpenAI(opts as any)(modelId);
    }

    default:
      throw new Error(`不支持的 provider: ${provider}`);
  }
}
