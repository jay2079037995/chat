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
});
