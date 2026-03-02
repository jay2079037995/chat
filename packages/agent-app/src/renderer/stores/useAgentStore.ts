import { create } from 'zustand';
import type { AgentConfig, AgentState, LogEntry } from '../../shared/types';

interface AgentStore {
  agents: AgentConfig[];
  agentStates: Record<string, AgentState>;
  selectedAgentId: string | null;
  logs: LogEntry[];
  editing: boolean;

  setSelectedAgent: (id: string | null) => void;
  setEditing: (editing: boolean) => void;
  loadAgents: () => Promise<void>;
  createAgent: (config: Omit<AgentConfig, 'id' | 'createdAt'>) => Promise<AgentConfig>;
  updateAgent: (id: string, updates: Partial<AgentConfig>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  startAgent: (id: string) => Promise<void>;
  stopAgent: (id: string) => Promise<void>;
  addLog: (entry: LogEntry) => void;
  updateAgentState: (agentId: string, state: AgentState) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  agentStates: {},
  selectedAgentId: null,
  logs: [],
  editing: false,

  setSelectedAgent: (id) => set({ selectedAgentId: id, editing: false }),
  setEditing: (editing) => set({ editing }),

  loadAgents: async () => {
    const agents = await window.agentAPI.getAgents();
    const states = await window.agentAPI.getAgentStates();
    set({ agents, agentStates: states });
  },

  createAgent: async (config) => {
    const agent = await window.agentAPI.createAgent(config);
    set((state) => ({ agents: [...state.agents, agent] }));
    return agent;
  },

  updateAgent: async (id, updates) => {
    const updated = await window.agentAPI.updateAgent(id, updates);
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? updated : a)),
    }));
  },

  deleteAgent: async (id) => {
    await window.agentAPI.deleteAgent(id);
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
    }));
  },

  startAgent: async (id) => {
    await window.agentAPI.startAgent(id);
  },

  stopAgent: async (id) => {
    await window.agentAPI.stopAgent(id);
  },

  addLog: (entry) => {
    set((state) => ({
      logs: [...state.logs.slice(-500), entry], // 保留最近 500 条
    }));
  },

  updateAgentState: (agentId, agentState) => {
    set((state) => ({
      agentStates: { ...state.agentStates, [agentId]: agentState },
    }));
  },
}));
