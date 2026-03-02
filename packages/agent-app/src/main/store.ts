/**
 * Agent 配置持久化存储
 *
 * 使用 electron-store 保存 Agent 配置和窗口状态。
 */
import Store from 'electron-store';
import type { AgentConfig } from '../shared/types';

interface StoreSchema {
  agents: AgentConfig[];
  windowState: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    isMaximized: boolean;
  };
}

const store = new Store<StoreSchema>({
  defaults: {
    agents: [],
    windowState: {
      width: 1000,
      height: 700,
      isMaximized: false,
    },
  },
});

/** 获取所有 Agent 配置 */
export function getAllAgents(): AgentConfig[] {
  return store.get('agents', []);
}

/** 保存新 Agent */
export function saveAgent(agent: AgentConfig): void {
  const agents = getAllAgents();
  agents.push(agent);
  store.set('agents', agents);
}

/** 更新 Agent 配置 */
export function updateAgent(id: string, updates: Partial<AgentConfig>): AgentConfig | null {
  const agents = getAllAgents();
  const index = agents.findIndex((a) => a.id === id);
  if (index === -1) return null;
  agents[index] = { ...agents[index], ...updates };
  store.set('agents', agents);
  return agents[index];
}

/** 删除 Agent */
export function removeAgent(id: string): void {
  const agents = getAllAgents().filter((a) => a.id !== id);
  store.set('agents', agents);
}

/** 获取窗口状态 */
export function getWindowState() {
  return store.get('windowState');
}

/** 保存窗口状态 */
export function saveWindowState(state: StoreSchema['windowState']): void {
  store.set('windowState', state);
}
