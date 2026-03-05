import type { Message } from './message';
import type { LLMToolCall } from './skill';

/** 机器人运行模式 */
export type BotRunMode = 'client' | 'server' | 'local';

/** 机器人运行状态（仅 server/local 模式） */
export type BotStatus = 'running' | 'stopped' | 'error';

/** Mastra AI SDK 提供商（本地 Bot 使用） */
export type MastraProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'qwen';

/** Mastra LLM 配置（本地机器人使用） */
export interface MastraLLMConfig {
  provider: MastraProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  contextLength: number;
}

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
  /** Mastra LLM 配置（仅 local 模式） */
  mastraConfig?: Omit<MastraLLMConfig, 'apiKey'> & { apiKey: string };
}

/** 创建机器人请求体 */
export interface CreateBotRequest {
  username: string;
  runMode: BotRunMode;
  llmConfig?: LLMConfig;
  mastraConfig?: MastraLLMConfig;
}

/** 机器人收到的消息更新 */
export interface BotUpdate {
  updateId: number;
  message: Message;
  conversationId: string;
}

/** Agent 执行步骤类型 */
export type AgentStepType = 'llm_call' | 'tool_call' | 'tool_result' | 'error';

/** Agent 单步执行日志 */
export interface AgentStepLog {
  /** 日志唯一标识 */
  id: string;
  /** Bot ID */
  botId: string;
  /** 会话 ID */
  conversationId: string;
  /** 所属生成批次 ID（同一次 generate/stream 的所有步骤共享） */
  generationId: string;
  /** 步骤序号（从 1 开始） */
  stepIndex: number;
  /** 步骤类型 */
  type: AgentStepType;
  /** 时间戳 */
  timestamp: number;
  /** 工具名称（仅 tool_call / tool_result 类型） */
  toolName?: string;
  /** 工具输入参数（仅 tool_call 类型，截断后） */
  toolInput?: Record<string, unknown>;
  /** 工具输出结果（仅 tool_result 类型，截断后） */
  toolOutput?: string;
  /** 错误信息 */
  error?: string;
  /** 步骤耗时（毫秒） */
  durationMs: number;
  /** LLM 相关信息（仅 llm_call 类型） */
  llmInfo?: {
    provider: string;
    model: string;
    finishReason?: string;
  };
}

/** Agent 生成批次日志（一次 generate/stream 产生一条） */
export interface AgentGenerationLog {
  /** 批次唯一 ID */
  generationId: string;
  /** Bot ID */
  botId: string;
  /** 会话 ID */
  conversationId: string;
  /** 开始时间戳 */
  startTime: number;
  /** 总耗时（毫秒） */
  totalDurationMs: number;
  /** 总步骤数 */
  stepCount: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（最终错误） */
  error?: string;
  /** 各步骤日志 */
  steps: AgentStepLog[];
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
