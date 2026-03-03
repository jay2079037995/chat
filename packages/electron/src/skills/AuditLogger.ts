/**
 * Skill 审计日志
 *
 * 使用 electron-store 持久化 Skill 执行记录，
 * 保留最近 500 条，供用户查看 Bot 的操作历史。
 */
import Store from 'electron-store';

/** 审计日志条目 */
export interface AuditEntry {
  /** 时间戳 */
  timestamp: number;
  /** 执行的函数名 */
  functionName: string;
  /** 函数参数 */
  params: Record<string, unknown>;
  /** 发起请求的 Bot ID */
  botId: string;
  /** 会话 ID */
  conversationId: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
}

const MAX_ENTRIES = 500;

export class AuditLogger {
  private store = new Store<{ skillAuditLogs: AuditEntry[] }>({
    name: 'skill-audit',
    defaults: { skillAuditLogs: [] },
  });

  /** 记录一条审计日志 */
  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    const logs = this.store.get('skillAuditLogs');
    logs.push({ ...entry, timestamp: Date.now() });

    // 超出上限时裁剪
    if (logs.length > MAX_ENTRIES) {
      logs.splice(0, logs.length - MAX_ENTRIES);
    }

    this.store.set('skillAuditLogs', logs);
  }

  /** 获取最近的审计日志 */
  getLogs(limit = 50): AuditEntry[] {
    const logs = this.store.get('skillAuditLogs');
    return logs.slice(-limit);
  }

  /** 清空审计日志 */
  clear(): void {
    this.store.set('skillAuditLogs', []);
  }
}
