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
  // --- Local Bot (Mastra) IPC ---
  /** 初始化本地 Bot */
  initLocalBot: (botId: string, config: unknown): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('localbot:init', botId, config),
  /** 处理本地 Bot 消息 */
  handleLocalBotMessage: (botId: string, conversationId: string, content: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('localbot:handle-message', botId, conversationId, content),
  /** 移除本地 Bot */
  removeLocalBot: (botId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('localbot:remove', botId),
  /** 获取活跃 Bot 列表 */
  getActiveLocalBots: (): Promise<string[]> =>
    ipcRenderer.invoke('localbot:active-bots'),
  /** 监听本地 Bot 流式事件（从主进程转发） */
  onLocalBotEmit: (callback: (event: string, data: unknown) => void): void => {
    ipcRenderer.on('localbot:emit', (_ipcEvent, event: string, data: unknown) => callback(event, data));
  },
});
