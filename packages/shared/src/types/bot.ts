import type { Message } from './message';
import type { LLMToolCall } from './skill';

/** 机器人运行模式 */
export type BotRunMode = 'client' | 'server' | 'local';

/** 机器人运行状态 */
export type BotStatus = 'running' | 'stopped' | 'error';

// ─── v2.0.0 新类型 ──────────────────────────────────────────

/** Bot 模型配置（v2.0.0+，使用 "provider/model" 格式） */
export interface BotModelConfig {
  /** 模型字符串，格式为 "provider/model-name"，例如 "anthropic/claude-sonnet-4-5" */
  model: string;
  /** API Key（本地模型如 ollama/lmstudio 可为空） */
  apiKey: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 上下文长度（tokens） */
  contextLength: number;
  /** 备用模型列表（按优先级降序），例如 ["openai/gpt-4o", "google/gemini-2.5-flash"] */
  fallbacks?: string[];
  /** 自定义 Base URL（ollama/lmstudio/自定义端点） */
  baseUrl?: string;
}

/** Model Provider 信息 */
export interface ModelProviderInfo {
  /** 显示名称 */
  displayName: string;
  /** 预置模型列表 */
  models: string[];
  /** 默认 Base URL（本地模型或国内服务有特定地址） */
  baseUrl?: string;
  /** 是否需要 API Key */
  requiresApiKey: boolean;
}

// ─── 旧类型（已废弃，保留向后兼容） ─────────────────────────

/** @deprecated 使用 BotModelConfig 替代 */
export type MastraProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'qwen';

/** @deprecated 使用 BotModelConfig 替代 */
export interface MastraLLMConfig {
  provider: MastraProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  contextLength: number;
}

/** @deprecated 不再使用 */
export type LLMProvider = 'deepseek' | 'minimax' | 'openai' | 'claude' | 'qwen' | 'custom';

/** @deprecated 不再使用 */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  contextLength: number;
  customBaseUrl?: string;
  customModel?: string;
}

// ─── 通用类型 ────────────────────────────────────────────────

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

/** @deprecated 使用 ModelProviderInfo 替代 */
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
  /** 模型配置（v2.0.0+） */
  modelConfig?: Omit<BotModelConfig, 'apiKey'> & { apiKey: string };
  /** @deprecated 旧 Mastra 配置，向后兼容 */
  mastraConfig?: Omit<MastraLLMConfig, 'apiKey'> & { apiKey: string };
}

/** 创建机器人请求体 */
export interface CreateBotRequest {
  username: string;
  /** 模型配置（v2.0.0+） */
  modelConfig?: BotModelConfig;
  /** @deprecated 旧 Mastra 配置 */
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
  /** 工具输入参数（完整 JSON） */
  toolInput?: Record<string, unknown>;
  /** 工具输出结果（截断后） */
  toolOutput?: string;
  /** 工具输出字符总长度（未截断前） */
  toolOutputLength?: number;
  /** 错误信息 */
  error?: string;
  /** 步骤耗时（毫秒） */
  durationMs: number;
  /** 工作区路径 */
  workspacePath?: string;
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

