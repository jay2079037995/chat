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
  /** 服务端地址（打包后客户端从本地文件加载，需指定服务端 URL） */
  serverUrl: 'http://localhost:3001',
  /** 获取当前调试状态 */
  getDebugStatus: (): Promise<boolean> => ipcRenderer.invoke('debug:get-status'),
  /** 监听调试状态变化 */
  onDebugStatus: (callback: (enabled: boolean) => void): void => {
    ipcRenderer.on('debug:status', (_event, enabled: boolean) => callback(enabled));
  },
  // --- Bot Skill 管理 ---
  /** 列出 Bot 已安装的 Skill */
  listBotSkills: (botId: string): Promise<unknown[]> =>
    ipcRenderer.invoke('bot-skill:list', botId),
  /** 从本地目录安装 Skill */
  installBotSkill: (botId: string, sourcePath: string): Promise<unknown> =>
    ipcRenderer.invoke('bot-skill:install', botId, sourcePath),
  /** 从在线 URL 安装 Skill */
  installBotSkillFromUrl: (botId: string, entry: unknown): Promise<unknown> =>
    ipcRenderer.invoke('bot-skill:install-url', botId, entry),
  /** 卸载 Skill */
  uninstallBotSkill: (botId: string, skillName: string): Promise<boolean> =>
    ipcRenderer.invoke('bot-skill:uninstall', botId, skillName),
  /** 获取 Skill 完整内容 */
  getBotSkillContent: (botId: string, skillName: string): Promise<unknown> =>
    ipcRenderer.invoke('bot-skill:get-content', botId, skillName),
  /** 选择 Skill 目录（打开文件选择对话框） */
  selectSkillDir: (): Promise<string | null> =>
    ipcRenderer.invoke('bot-skill:select-dir'),
  // --- 在线 Skill 搜索 ---
  /** 搜索在线 Skill（claude-plugins.dev） */
  searchPlugins: (query: string, limit?: number, offset?: number): Promise<unknown> =>
    ipcRenderer.invoke('plugin:search', query, limit, offset),
  // --- 通用工具执行 ---
  /** 执行通用工具（服务端 Bot 远程调用） */
  execGenericTool: (request: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tool:exec', request),
  // --- 本地 Bot 工作目录 ---
  /** 获取 Bot 工作目录路径 */
  getWorkspacePath: (botId: string): Promise<string> =>
    ipcRenderer.invoke('localbot:get-workspace-path', botId),
  /** 打开 Bot 工作目录 */
  openWorkspace: (botId: string): Promise<void> =>
    ipcRenderer.invoke('localbot:open-workspace', botId),
  /** 选择工作目录（打开目录选择对话框） */
  selectWorkspaceDir: (): Promise<string | null> =>
    ipcRenderer.invoke('localbot:select-workspace-dir'),
  /** 设置自定义工作目录（传 null 恢复默认） */
  setCustomWorkspace: (botId: string, dirPath: string | null): Promise<string> =>
    ipcRenderer.invoke('localbot:set-custom-workspace', botId, dirPath),
  /** 监听 Skill 指令更新（Electron → 渲染进程 → Socket.IO → Server） */
  onSkillInstructionsUpdate: (callback: (data: { botId: string; instructions: string }) => void): void => {
    ipcRenderer.on('bot:skill-instructions-update', (_ipcEvent, data: { botId: string; instructions: string }) => callback(data));
  },
});
