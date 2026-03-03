/**
 * Skill 执行运行时
 *
 * Electron 主进程中的 Skill 执行引擎，负责：
 * 1. 白名单检查 — 不在白名单中的函数直接拒绝
 * 2. 权限检查 — 根据权限级别弹窗确认
 * 3. 执行 handler — 调用对应的 Skill 执行器
 * 4. 审计记录 — 记录每次执行的结果
 */
import Store from 'electron-store';
import { handlers, permissionMap } from './handlers';
import { PermissionManager } from './PermissionManager';
import { AuditLogger, type AuditEntry } from './AuditLogger';

/** Skill 执行请求（从渲染进程传入） */
interface ExecRequest {
  requestId: string;
  functionName: string;
  params: Record<string, unknown>;
  botId: string;
  conversationId: string;
}

/** Skill 执行结果 */
interface ExecResult {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export class SkillRuntime {
  private permissionManager = new PermissionManager();
  private auditLogger = new AuditLogger();
  private whitelistStore = new Store<{ skillWhitelist: string[] }>({
    name: 'skill-whitelist',
    defaults: { skillWhitelist: ['*'] }, // 默认允许所有
  });

  /** 执行 Skill 操作 */
  async execute(request: ExecRequest): Promise<ExecResult> {
    const { requestId, functionName, params, botId, conversationId } = request;

    // 1. 检查 handler 是否存在
    const handler = handlers[functionName];
    if (!handler) {
      this.auditLogger.log({
        functionName, params, botId, conversationId,
        success: false, error: '未知的函数名',
      });
      return { requestId, success: false, error: `未知的 Skill 函数: ${functionName}` };
    }

    // 2. 白名单检查
    const whitelist = this.whitelistStore.get('skillWhitelist');
    if (!whitelist.includes('*') && !whitelist.includes(functionName)) {
      this.auditLogger.log({
        functionName, params, botId, conversationId,
        success: false, error: '不在白名单中',
      });
      return { requestId, success: false, error: `函数 ${functionName} 不在白名单中` };
    }

    // 3. 权限检查
    const permission = permissionMap[functionName] || 'read';
    const previewText = permission === 'dangerous'
      ? JSON.stringify(params, null, 2)
      : undefined;

    const allowed = await this.permissionManager.checkPermission(
      functionName, permission, previewText,
    );

    if (!allowed) {
      this.auditLogger.log({
        functionName, params, botId, conversationId,
        success: false, error: '用户拒绝授权',
      });
      return { requestId, success: false, error: '用户拒绝了此操作的执行权限' };
    }

    // 4. 执行 handler
    try {
      const data = await handler(params);
      this.auditLogger.log({
        functionName, params, botId, conversationId, success: true,
      });
      return { requestId, success: true, data };
    } catch (err: any) {
      const error = err.message || '执行失败';
      this.auditLogger.log({
        functionName, params, botId, conversationId,
        success: false, error,
      });
      return { requestId, success: false, error };
    }
  }

  /** 获取审计日志 */
  getLogs(limit?: number): AuditEntry[] {
    return this.auditLogger.getLogs(limit);
  }

  /** 获取白名单 */
  getWhitelist(): string[] {
    return this.whitelistStore.get('skillWhitelist');
  }

  /** 设置白名单 */
  setWhitelist(list: string[]): void {
    this.whitelistStore.set('skillWhitelist', list);
  }
}
