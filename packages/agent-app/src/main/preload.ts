/**
 * Preload 脚本
 *
 * 通过 contextBridge 暴露安全的 agentAPI 给渲染进程。
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { AgentConfig, AgentState, LogEntry } from '../shared/types';

contextBridge.exposeInMainWorld('agentAPI', {
  /** 获取所有 Agent 配置 */
  getAgents: (): Promise<AgentConfig[]> => ipcRenderer.invoke('agent:list'),

  /** 创建 Agent */
  createAgent: (config: Omit<AgentConfig, 'id' | 'createdAt'>): Promise<AgentConfig> =>
    ipcRenderer.invoke('agent:create', config),

  /** 更新 Agent */
  updateAgent: (id: string, updates: Partial<AgentConfig>): Promise<AgentConfig> =>
    ipcRenderer.invoke('agent:update', id, updates),

  /** 删除 Agent */
  deleteAgent: (id: string): Promise<void> => ipcRenderer.invoke('agent:delete', id),

  /** 启动 Agent */
  startAgent: (id: string): Promise<void> => ipcRenderer.invoke('agent:start', id),

  /** 停止 Agent */
  stopAgent: (id: string): Promise<void> => ipcRenderer.invoke('agent:stop', id),

  /** 获取所有 Agent 状态 */
  getAgentStates: (): Promise<Record<string, AgentState>> =>
    ipcRenderer.invoke('agent:states'),

  /** 获取 Provider 信息 */
  getProviders: (): Promise<any> => ipcRenderer.invoke('agent:providers'),

  /** 监听日志推送 */
  onAgentLog: (callback: (entry: LogEntry) => void): (() => void) => {
    const handler = (_event: any, entry: LogEntry) => callback(entry);
    ipcRenderer.on('agent:log', handler);
    return () => ipcRenderer.removeListener('agent:log', handler);
  },

  /** 监听状态变更推送 */
  onAgentStatusChange: (
    callback: (agentId: string, state: AgentState) => void,
  ): (() => void) => {
    const handler = (_event: any, agentId: string, state: AgentState) =>
      callback(agentId, state);
    ipcRenderer.on('agent:status-change', handler);
    return () => ipcRenderer.removeListener('agent:status-change', handler);
  },
});
