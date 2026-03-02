/** LLM 服务提供商 */
export type Provider = 'deepseek' | 'minimax';

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

/** 所有 Provider 配置 */
export const PROVIDERS: Record<Provider, ProviderInfo> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat'],
  },
  minimax: {
    baseUrl: 'https://api.minimax.io/v1',
    models: ['MiniMax-M2.5'],
  },
};
