/**
 * 本地缓存服务
 *
 * 使用 localStorage 缓存用户信息、会话列表和最近消息，
 * 支持离线访问和快速启动。
 */
import type { Message, User } from '@chat/shared';
import type { ConversationWithUnread } from '../modules/chat/services/chatService';

/** 缓存键名常量 */
const CACHE_KEYS = {
  /** 当前用户信息 */
  USER_INFO: 'cache:user_info',
  /** 会话列表 */
  CONVERSATIONS: 'cache:conversations',
  /** 参与者用户名映射 */
  PARTICIPANT_NAMES: 'cache:participant_names',
  /** 群组名称映射 */
  GROUP_NAMES: 'cache:group_names',
  /** 消息缓存前缀（后跟 conversationId） */
  MESSAGES_PREFIX: 'cache:messages:',
} as const;

/** 缓存的会话数据结构 */
interface CachedConversations {
  conversations: ConversationWithUnread[];
  participantNames: Record<string, string>;
  groupNames: Record<string, string>;
}

export const cacheService = {
  // ---- 用户信息 ----

  /** 缓存用户信息 */
  saveUserInfo(user: User): void {
    try {
      localStorage.setItem(CACHE_KEYS.USER_INFO, JSON.stringify(user));
    } catch { /* 存储已满等异常静默忽略 */ }
  },

  /** 读取缓存的用户信息 */
  getUserInfo(): User | null {
    try {
      const raw = localStorage.getItem(CACHE_KEYS.USER_INFO);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  // ---- 会话列表 ----

  /** 缓存会话列表（含参与者名称和群组名称） */
  saveConversations(data: CachedConversations): void {
    try {
      localStorage.setItem(CACHE_KEYS.CONVERSATIONS, JSON.stringify(data.conversations));
      localStorage.setItem(CACHE_KEYS.PARTICIPANT_NAMES, JSON.stringify(data.participantNames));
      localStorage.setItem(CACHE_KEYS.GROUP_NAMES, JSON.stringify(data.groupNames));
    } catch { /* 静默忽略 */ }
  },

  /** 读取缓存的会话列表 */
  getConversations(): CachedConversations | null {
    try {
      const convRaw = localStorage.getItem(CACHE_KEYS.CONVERSATIONS);
      const namesRaw = localStorage.getItem(CACHE_KEYS.PARTICIPANT_NAMES);
      const groupsRaw = localStorage.getItem(CACHE_KEYS.GROUP_NAMES);
      if (!convRaw) return null;
      return {
        conversations: JSON.parse(convRaw),
        participantNames: namesRaw ? JSON.parse(namesRaw) : {},
        groupNames: groupsRaw ? JSON.parse(groupsRaw) : {},
      };
    } catch { return null; }
  },

  // ---- 消息缓存 ----

  /** 缓存某会话的最近消息（最多保留一页 50 条） */
  saveMessages(conversationId: string, messages: Message[]): void {
    try {
      const toCache = messages.slice(-50);
      localStorage.setItem(
        CACHE_KEYS.MESSAGES_PREFIX + conversationId,
        JSON.stringify(toCache),
      );
    } catch { /* 静默忽略 */ }
  },

  /** 读取缓存的消息 */
  getMessages(conversationId: string): Message[] | null {
    try {
      const raw = localStorage.getItem(CACHE_KEYS.MESSAGES_PREFIX + conversationId);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  // ---- 缓存时间戳 ----

  /** 记录缓存更新时间 */
  saveCacheTimestamp(): void {
    try {
      localStorage.setItem('cache:last_updated', String(Date.now()));
    } catch { /* 静默忽略 */ }
  },

  /** 获取缓存更新时间 */
  getCacheTimestamp(): number | null {
    try {
      const raw = localStorage.getItem('cache:last_updated');
      return raw ? Number(raw) : null;
    } catch { return null; }
  },

  /** 缓存是否在指定时间内（默认 24 小时） */
  isCacheFresh(maxAgeMs = 24 * 60 * 60 * 1000): boolean {
    const ts = this.getCacheTimestamp();
    if (!ts) return false;
    return Date.now() - ts < maxAgeMs;
  },

  // ---- 清理 ----

  /** 清除所有缓存（登出时调用） */
  clearAll(): void {
    const prefixKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cache:')) {
        prefixKeys.push(k);
      }
    }
    prefixKeys.forEach((k) => localStorage.removeItem(k));
    // 清除离线消息队列
    localStorage.removeItem('offline_queue');
  },
};
