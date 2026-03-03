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
  /** Bot 允许使用的 Skill 函数名列表（['*'] 或空表示全部） */
  allowedSkills?: string[];
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

/** LLM 调用日志（Server Bot 每次 API 调用的完整记录） */
export interface LLMCallLog {
  /** 日志唯一标识 */
  id: string;
  /** Bot ID */
  botId: string;
  /** 调用时间戳 */
  timestamp: number;
  /** 会话 ID */
  conversationId: string;
  /** 请求信息 */
  request: {
    provider: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    tools?: Array<{ name: string; description: string }>;
  };
  /** 响应信息（成功时） */
  response?: {
    content?: string;
    toolCalls?: LLMToolCall[];
    finishReason: string;
    reasoningContent?: string;
  };
  /** 错误信息（失败时） */
  error?: string;
  /** 调用耗时（毫秒） */
  durationMs: number;
  /** Tool calling 轮次编号（仅在 tool calling 循环中） */
  toolRound?: number;
}
