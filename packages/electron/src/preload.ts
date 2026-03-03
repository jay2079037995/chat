/**
 * Preload 脚本
 *
 * 在渲染进程加载前执行，通过 contextBridge 暴露安全的 API。
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  /** 当前平台 */
  platform: process.platform,
  /** 是否为 Electron 环境 */
  isElectron: true,
  /** 获取当前调试状态 */
  getDebugStatus: (): Promise<boolean> => ipcRenderer.invoke('debug:get-status'),
  /** 监听调试状态变化 */
  onDebugStatus: (callback: (enabled: boolean) => void): void => {
    ipcRenderer.on('debug:status', (_event, enabled: boolean) => callback(enabled));
  },
  // --- Skill 系统 IPC ---
  /** 执行 Skill 操作 */
  execSkill: (request: { requestId: string; functionName: string; params: Record<string, unknown>; botId: string; conversationId: string }): Promise<{ requestId: string; success: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke('skill:exec', request),
  /** 获取 Skill 审计日志 */
  getSkillLogs: (limit?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('skill:get-logs', limit),
  /** 获取 Skill 白名单 */
  getSkillWhitelist: (): Promise<string[]> =>
    ipcRenderer.invoke('skill:get-whitelist'),
  /** 设置 Skill 白名单 */
  setSkillWhitelist: (list: string[]): Promise<void> =>
    ipcRenderer.invoke('skill:set-whitelist', list),
});
