/**
 * 全局常量 —— 前后端共享的业务限制和配置
 */
import type { LLMProvider, MastraProvider, ProviderInfo } from '../types/bot';

/** 所有 LLM Provider 配置 */
export const LLM_PROVIDERS: Record<LLMProvider, ProviderInfo> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  minimax: {
    baseUrl: 'https://api.minimax.io/v1',
    models: ['MiniMax-M2.5'],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini'],
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-turbo'],
  },
  custom: {
    baseUrl: '',
    models: [],
  },
};

/** Mastra AI SDK Provider 配置（本地 Bot 使用） */
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
