/**
 * Skill 权限管理器
 *
 * 根据权限级别控制 Skill 操作的执行：
 * - read: 自动放行
 * - write/execute: 首次弹窗确认，可选"本次会话记住"
 * - dangerous: 每次弹窗确认，显示命令预览
 */
import { dialog } from 'electron';
import { getMainWindow } from '../windowManager';

/** 权限级别 */
export type PermissionLevel = 'read' | 'write' | 'execute' | 'dangerous';

export class PermissionManager {
  /** 本次会话已授权的操作（session 级，重启清空） */
  private sessionGrants = new Set<string>();

  /**
   * 检查权限，必要时弹窗询问用户
   *
   * @returns true 允许执行，false 拒绝
   */
  async checkPermission(
    functionName: string,
    permission: PermissionLevel,
    previewText?: string,
  ): Promise<boolean> {
    // read 自动放行
    if (permission === 'read') return true;

    // write/execute: 如果本次会话已授权，放行
    if ((permission === 'write' || permission === 'execute') && this.sessionGrants.has(functionName)) {
      return true;
    }

    // 弹窗确认
    const permLabel = this.getPermissionLabel(permission);
    let message = `Bot 请求执行操作: ${functionName}\n权限级别: ${permLabel}`;
    if (previewText) {
      message += `\n\n执行内容预览:\n${previewText}`;
    }

    const win = getMainWindow();
    const result = await dialog.showMessageBox(win!, {
      type: permission === 'dangerous' ? 'warning' : 'question',
      title: 'Skill 权限确认',
      message,
      buttons: permission === 'dangerous'
        ? ['拒绝', '允许本次']
        : ['拒绝', '允许本次', '本次会话始终允许'],
      defaultId: 0,
      cancelId: 0,
    });

    if (result.response === 0) {
      // 拒绝
      return false;
    }

    // write/execute 选择"本次会话始终允许"
    if (result.response === 2 && permission !== 'dangerous') {
      this.sessionGrants.add(functionName);
    }

    return true;
  }

  /** 清除会话级授权（用于重置） */
  clearSessionGrants(): void {
    this.sessionGrants.clear();
  }

  private getPermissionLabel(permission: PermissionLevel): string {
    switch (permission) {
      case 'read': return '只读';
      case 'write': return '写入';
      case 'execute': return '执行';
      case 'dangerous': return '⚠️ 危险操作';
    }
  }
}
