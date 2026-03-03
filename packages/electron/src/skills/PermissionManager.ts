/**
 * Skill 权限管理器
 *
 * 根据权限级别控制 Skill 操作的执行：
 * - read: 自动放行
 * - Bot 受信任: 所有权限级别自动放行
 * - write/execute/dangerous: 首次弹窗确认，可选"本次会话记住"
 */
import { dialog } from 'electron';
import { getMainWindow } from '../windowManager';
import { BotTrustStore } from './BotTrustStore';

/** 权限级别 */
export type PermissionLevel = 'read' | 'write' | 'execute' | 'dangerous';

export class PermissionManager {
  /** 本次会话已授权的操作（session 级，重启清空） */
  private sessionGrants = new Set<string>();
  /** Bot 信任存储 */
  private botTrustStore: BotTrustStore;

  constructor(botTrustStore?: BotTrustStore) {
    this.botTrustStore = botTrustStore || new BotTrustStore();
  }

  /** 获取 BotTrustStore 引用（供 IPC 调用） */
  getBotTrustStore(): BotTrustStore {
    return this.botTrustStore;
  }

  /**
   * 检查权限，必要时弹窗询问用户
   *
   * 信任链：
   * 1. read → 自动放行
   * 2. Bot 受信任 → 自动放行（所有权限级别含 dangerous）
   * 3. write/execute/dangerous + session grant → 放行
   * 4. 其他 → 弹窗确认
   *
   * @returns true 允许执行，false 拒绝
   */
  async checkPermission(
    functionName: string,
    permission: PermissionLevel,
    previewText?: string,
    botId?: string,
  ): Promise<boolean> {
    // read 自动放行
    if (permission === 'read') return true;

    // Bot 信任检查：受信 Bot 所有操作自动放行
    if (botId && this.botTrustStore.isTrusted(botId)) {
      return true;
    }

    // write/execute/dangerous: 如果本次会话已授权，放行
    if (this.sessionGrants.has(functionName)) {
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
      buttons: ['拒绝', '允许本次', '本次会话始终允许'],
      defaultId: 0,
      cancelId: 0,
    });

    if (result.response === 0) {
      // 拒绝
      return false;
    }

    // 选择"本次会话始终允许"
    if (result.response === 2) {
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
