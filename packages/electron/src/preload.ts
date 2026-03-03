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
  // --- 自定义 Skill 管理 ---
  /** 列出已安装的自定义 Skill */
  listCustomSkills: (): Promise<unknown[]> =>
    ipcRenderer.invoke('skill:list-custom'),
  /** 安装自定义 Skill 包（传入源目录路径） */
  installSkill: (sourcePath: string): Promise<unknown> =>
    ipcRenderer.invoke('skill:install', sourcePath),
  /** 卸载自定义 Skill */
  uninstallSkill: (skillName: string): Promise<boolean> =>
    ipcRenderer.invoke('skill:uninstall', skillName),
  /** 选择 Skill 包目录（打开文件选择对话框） */
  selectSkillDir: (): Promise<string | null> =>
    ipcRenderer.invoke('skill:select-dir'),
  // --- Bot 信任管理 ---
  /** 获取所有 Bot 信任配置 */
  getBotTrustList: (): Promise<unknown[]> =>
    ipcRenderer.invoke('bot-trust:list'),
  /** 设置 Bot 信任状态 */
  setBotTrust: (botId: string, botUsername: string, trusted: boolean): Promise<void> =>
    ipcRenderer.invoke('bot-trust:set', botId, botUsername, trusted),
  /** 移除 Bot 信任配置 */
  removeBotTrust: (botId: string): Promise<void> =>
    ipcRenderer.invoke('bot-trust:remove', botId),
});
