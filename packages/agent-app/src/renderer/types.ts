import type { AgentConfig, AgentState, LogEntry } from '../shared/types';

/** Window 上暴露的 agentAPI 类型 */
export interface AgentAPI {
  getAgents(): Promise<AgentConfig[]>;
  createAgent(config: Omit<AgentConfig, 'id' | 'createdAt'>): Promise<AgentConfig>;
  updateAgent(id: string, updates: Partial<AgentConfig>): Promise<AgentConfig>;
  deleteAgent(id: string): Promise<void>;
  startAgent(id: string): Promise<void>;
  stopAgent(id: string): Promise<void>;
  getAgentStates(): Promise<Record<string, AgentState>>;
  getProviders(): Promise<any>;
  onAgentLog(callback: (entry: LogEntry) => void): () => void;
  onAgentStatusChange(callback: (agentId: string, state: AgentState) => void): () => void;
}

declare global {
  interface Window {
    agentAPI: AgentAPI;
  }
}
