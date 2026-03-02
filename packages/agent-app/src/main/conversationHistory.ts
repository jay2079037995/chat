/**
 * 对话历史管理
 *
 * 每个 Agent 维护多个 conversationId 的对话历史（内存存储）。
 */
import type { ChatMessage } from '../shared/types';

/** agentId -> conversationId -> messages */
const historyMap = new Map<string, Map<string, ChatMessage[]>>();

/** 获取指定 agent + conversation 的对话历史 */
function getHistory(agentId: string, conversationId: string): ChatMessage[] {
  const agentHistory = historyMap.get(agentId);
  if (!agentHistory) return [];
  return agentHistory.get(conversationId) ?? [];
}

/** 添加一条消息到历史 */
export function addMessage(
  agentId: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
): void {
  if (!historyMap.has(agentId)) {
    historyMap.set(agentId, new Map());
  }
  const agentHistory = historyMap.get(agentId)!;
  if (!agentHistory.has(conversationId)) {
    agentHistory.set(conversationId, []);
  }
  agentHistory.get(conversationId)!.push({ role, content });
}

/** 获取最近 N 轮对话（1 轮 = 1 user + 1 assistant） */
export function getRecentMessages(
  agentId: string,
  conversationId: string,
  maxTurns: number,
): ChatMessage[] {
  const history = getHistory(agentId, conversationId);
  // 取最后 maxTurns * 2 条消息（每轮含 user + assistant）
  const sliceCount = maxTurns * 2;
  return history.slice(-sliceCount);
}

/** 清除指定 agent 的所有历史 */
export function clearHistory(agentId: string): void {
  historyMap.delete(agentId);
}
