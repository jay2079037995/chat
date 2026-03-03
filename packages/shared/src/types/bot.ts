import type { Message } from './message';
import type { LLMToolCall } from './skill';

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
  /** 消息角色：system/user/assistant/tool */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** 消息内容 */
  content: string;
  /** LLM 返回的 tool_calls（仅 assistant 角色） */
  tool_calls?: LLMToolCall[];
  /** tool 角色消息对应的 tool_call ID */
  tool_call_id?: string;
  /** tool 角色消息对应的函数名 */
  name?: string;
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

/** Bot 信任配置（Electron 端持久化） */
export interface BotTrustConfig {
  /** Bot ID */
  botId: string;
  /** Bot 用户名（显示用） */
  botUsername: string;
  /** 是否受信任 */
  trusted: boolean;
}
