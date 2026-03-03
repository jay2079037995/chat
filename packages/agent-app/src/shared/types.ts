// 从 @chat/shared 导入并 re-export 共享类型
import type { LLMProvider } from '@chat/shared';
export type { LLMProvider, ChatMessage, ProviderInfo } from '@chat/shared';
export { LLM_PROVIDERS as PROVIDERS } from '@chat/shared';

/** 兼容别名 */
export type Provider = LLMProvider;

/** Agent 配置（持久化） */
export interface AgentConfig {
  id: string;
  name: string;
  botToken: string;
  serverUrl: string;
  provider: Provider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  contextLength: number;
  enabled: boolean;
  createdAt: number;
  /** provider='custom' 时使用的自定义 API 地址 */
  customBaseUrl?: string;
  /** provider='custom' 时使用的自定义模型名称 */
  customModel?: string;
}

/** Agent 运行状态 */
export type AgentStatus = 'running' | 'stopped' | 'error';

/** 日志条目 */
export interface LogEntry {
  timestamp: number;
  agentId: string;
  level: 'info' | 'error' | 'warn';
  message: string;
}

/** Agent 运行状态 + 统计 */
export interface AgentState {
  config: AgentConfig;
  status: AgentStatus;
  lastError?: string;
  messagesProcessed: number;
}
