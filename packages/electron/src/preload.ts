/**
 * Preload 脚本
 *
 * 在渲染进程加载前执行，通过 contextBridge 暴露安全的 API。
 * 当前版本暂不暴露额外 API，仅作为安全隔离层预留。
 */
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  /** 当前平台 */
  platform: process.platform,
  /** 是否为 Electron 环境 */
  isElectron: true,
});
