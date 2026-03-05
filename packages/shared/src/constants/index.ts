/**
 * 全局常量 —— 前后端共享的业务限制和配置
 */
import type { LLMProvider, MastraProvider, ProviderInfo, ModelProviderInfo } from '../types/bot';

// ─── v2.0.0 Model Router Provider 配置 ────────────────────────

/** 所有 Model Router 支持的 Provider */
export const MODEL_PROVIDERS: Record<string, ModelProviderInfo> = {
  anthropic: {
    displayName: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-5-20250514'],
    requiresApiKey: true,
  },
  openai: {
    displayName: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    requiresApiKey: true,
  },
  google: {
    displayName: 'Google',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    requiresApiKey: true,
  },
  deepseek: {
    displayName: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    baseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
  },
  xai: {
    displayName: 'xAI (Grok)',
    models: ['grok-3', 'grok-3-mini'],
    requiresApiKey: true,
  },
  mistral: {
    displayName: 'Mistral',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
    requiresApiKey: true,
  },
  groq: {
    displayName: 'Groq',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    requiresApiKey: true,
  },
  moonshot: {
    displayName: 'Moonshot AI',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    baseUrl: 'https://api.moonshot.cn/v1',
    requiresApiKey: true,
  },
  qwen: {
    displayName: '通义千问 (Qwen)',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    requiresApiKey: true,
  },
  siliconflow: {
    displayName: 'SiliconFlow',
    models: ['Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-R1'],
    baseUrl: 'https://api.siliconflow.cn/v1',
    requiresApiKey: true,
  },
  ollama: {
    displayName: 'Ollama (本地)',
    models: ['llama3.3', 'qwen2.5', 'mistral'],
    baseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
  },
  lmstudio: {
    displayName: 'LM Studio (本地)',
    models: [],
    baseUrl: 'http://localhost:1234/v1',
    requiresApiKey: false,
  },
  custom: {
    displayName: '自定义 (Custom)',
    models: [],
    requiresApiKey: false,
  },
};

// ─── 旧常量（已废弃，保留向后兼容） ─────────────────────────

/** @deprecated 使用 MODEL_PROVIDERS 替代 */
export const LLM_PROVIDERS: Record<LLMProvider, ProviderInfo> = {
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
  minimax: { baseUrl: 'https://api.minimax.io/v1', models: ['MiniMax-M2.5'] },
  openai: { baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini'] },
  claude: { baseUrl: 'https://api.anthropic.com/v1', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'] },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo'] },
  custom: { baseUrl: '', models: [] },
};

/** @deprecated 使用 MODEL_PROVIDERS 替代 */
export const MASTRA_PROVIDERS: Record<MastraProvider, { displayName: string; models: string[] }> = {
  openai: { displayName: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  anthropic: { displayName: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'] },
  google: { displayName: 'Google', models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'] },
  deepseek: { displayName: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  qwen: { displayName: '通义千问', models: ['qwen-plus', 'qwen-turbo'] },
};

/** 单条消息最大字符数 */
export const MAX_MESSAGE_LENGTH = 5000;
/** 普通文件最大体积（1GB） */
export const MAX_FILE_SIZE = 1024 * 1024 * 1024;
/** 图片最大体积（5MB） */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
/** 音频最大体积（10MB） */
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
/** 允许上传的图片 MIME 类型 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
/** 允许上传的音频 MIME 类型 */
export const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mp3', 'audio/wav', 'audio/ogg'];
/** 每页加载的消息数量 */
export const MESSAGES_PER_PAGE = 50;
/** 群组名称最小长度 */
export const MIN_GROUP_NAME_LENGTH = 2;
/** 群组名称最大长度 */
export const MAX_GROUP_NAME_LENGTH = 50;
/** 群组最大成员数 */
export const MAX_GROUP_MEMBERS = 100;
/** 头像最大体积（2MB） */
export const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
/** 昵称最大长度 */
export const MAX_NICKNAME_LENGTH = 30;
/** 个人简介最大长度 */
export const MAX_BIO_LENGTH = 200;
/** 输入指示器自动超时（毫秒） */
export const TYPING_TIMEOUT = 3000;
/** 每个用户可为每个会话设置的最大标签数 */
export const MAX_CONV_TAGS = 5;
/** 会话标签最大长度 */
export const MAX_TAG_LENGTH = 20;
