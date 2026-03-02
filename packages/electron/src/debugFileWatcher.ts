/**
 * 调试控制文件监听器
 *
 * 通过监听 ~/.chat-debug 文件的存在与否来控制 vConsole 的显示/隐藏。
 *   touch ~/.chat-debug   → 开启 vConsole
 *   rm ~/.chat-debug      → 关闭 vConsole
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { BrowserWindow } from 'electron';

const DEBUG_FILE = path.join(os.homedir(), '.chat-debug');

let watcher: fs.FSWatcher | null = null;

/** 检查调试控制文件是否存在 */
export function isDebugEnabled(): boolean {
  return fs.existsSync(DEBUG_FILE);
}

/** 开始监听控制文件变化，状态变更时通知渲染进程 */
export function watchDebugFile(getWindow: () => BrowserWindow | null): void {
  let lastState = isDebugEnabled();

  // 监听 home 目录中的文件变化
  const homeDir = os.homedir();
  const fileName = '.chat-debug';

  try {
    watcher = fs.watch(homeDir, (eventType, changedFile) => {
      if (changedFile !== fileName) return;

      const currentState = isDebugEnabled();
      if (currentState !== lastState) {
        lastState = currentState;
        const win = getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('debug:status', currentState);
        }
      }
    });

    watcher.on('error', () => {
      // 监听失败静默忽略（不影响主功能）
    });
  } catch {
    // 无法监听目录时静默忽略
  }
}

/** 停止监听 */
export function stopWatching(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
