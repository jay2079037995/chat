/**
 * 离线消息队列
 *
 * 网络断开时暂存待发送消息到 localStorage，
 * 网络恢复后按顺序自动重发。
 */
import type { MessageType } from '@chat/shared';

/** 离线队列中的待发送消息 */
export interface PendingMessage {
  id: string;
  conversationId: string;
  type: MessageType;
  content: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  codeLanguage?: string;
  replyTo?: string;
  queuedAt: number;
}

const QUEUE_KEY = 'offline_queue';

function getQueue(): PendingMessage[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingMessage[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* 静默忽略 */ }
}

function generateId(): string {
  return `oq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const offlineQueue = {
  /** 将消息加入离线队列 */
  enqueue(msg: Omit<PendingMessage, 'id' | 'queuedAt'>): void {
    const queue = getQueue();
    queue.push({ ...msg, id: generateId(), queuedAt: Date.now() });
    saveQueue(queue);
  },

  /** 获取所有待发送消息 */
  getAll(): PendingMessage[] {
    return getQueue();
  },

  /** 移除指定消息 */
  remove(id: string): void {
    saveQueue(getQueue().filter((m) => m.id !== id));
  },

  /** 清空队列 */
  clear(): void {
    localStorage.removeItem(QUEUE_KEY);
  },

  /** 队列是否为空 */
  isEmpty(): boolean {
    return getQueue().length === 0;
  },

  /** 队列长度 */
  size(): number {
    return getQueue().length;
  },

  /**
   * 刷新队列 —— 按顺序重发所有待发送消息
   *
   * @param sendFn 发送函数，返回 true 表示成功
   * @returns 成功发送的消息数
   */
  async flush(sendFn: (msg: PendingMessage) => Promise<boolean>): Promise<number> {
    const queue = getQueue();
    if (queue.length === 0) return 0;

    let sentCount = 0;
    for (const msg of queue) {
      try {
        const success = await sendFn(msg);
        if (success) {
          offlineQueue.remove(msg.id);
          sentCount++;
        } else {
          break;
        }
      } catch {
        break;
      }
    }
    return sentCount;
  },
};
