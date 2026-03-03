import type { Message } from './message';

/** 机器人运行模式 */
export type BotRunMode = 'client' | 'server';

/** 机器人运行状态（仅 server 模式） */
export type BotStatus = 'running' | 'stopped' | 'error';

/** LLM 服务提供商 */
export type LLMProvider = 'deepseek' | 'minimax' | 'openai' | 'claude' | 'qwen' | 'custom';

/** LLM 配置（服务端机器人使用） */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  contextLength: number;
  customBaseUrl?: string;
  customModel?: string;
}

/** LLM 对话消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Provider 配置信息 */
export interface ProviderInfo {
  baseUrl: string;
  models: string[];
}

/** 机器人实体（前端展示用） */
export interface Bot {
  id: string;
  username: string;
  ownerId: string;
  createdAt: number;
  runMode?: BotRunMode;
  status?: BotStatus;
  llmConfig?: Omit<LLMConfig, 'apiKey'> & { apiKey: string };
}

/** 机器人创建后返回（含 token，仅 client 模式显示） */
export interface BotWithToken extends Bot {
  token: string;
}

/** 创建机器人请求体 */
export interface CreateBotRequest {
  username: string;
  runMode: BotRunMode;
  llmConfig?: LLMConfig;
}

/** 机器人收到的消息更新 */
export interface BotUpdate {
  updateId: number;
  message: Message;
  conversationId: string;
}
