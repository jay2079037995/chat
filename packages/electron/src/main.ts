/**
 * Electron 主进程入口
 *
 * 负责应用生命周期管理、创建窗口、设置菜单和托盘。
 * 开发模式下加载 webpack dev server (localhost:3000)，
 * 生产模式下加载后端服务 (localhost:3001，需先启动服务端)。
 */
import { app, BrowserWindow, ipcMain, session } from 'electron';
import { createMainWindow, getMainWindow } from './windowManager';
import { buildMenu } from './menuBuilder';
import { createTray, destroyTray } from './trayManager';
import { isDebugEnabled } from './debugFileWatcher';
import { SkillRuntime } from './skills/SkillRuntime';

// 防止 Windows 下多实例启动
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  // 第二个实例启动时，聚焦已有窗口
  app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  // 注册调试状态 IPC
  ipcMain.handle('debug:get-status', () => isDebugEnabled());

  // --- Skill 系统 IPC ---
  const skillRuntime = new SkillRuntime();
  ipcMain.handle('skill:exec', (_event, request) => skillRuntime.execute(request));
  ipcMain.handle('skill:get-logs', (_event, limit?: number) => skillRuntime.getLogs(limit));
  ipcMain.handle('skill:get-whitelist', () => skillRuntime.getWhitelist());
  ipcMain.handle('skill:set-whitelist', (_event, list: string[]) => skillRuntime.setWhitelist(list));

  app.whenReady().then(() => {
    // 允许麦克风、摄像头等媒体权限请求（否则 Electron 默认静默拒绝）
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowedPermissions = ['media', 'mediaKeySystem', 'clipboard-read', 'clipboard-sanitized-write'];
      callback(allowedPermissions.includes(permission));
    });

    // 构建菜单
    buildMenu();

    // 创建主窗口
    const win = createMainWindow();

    // 创建系统托盘
    createTray();

    // 窗口加载完成后发送调试状态
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('debug:status', isDebugEnabled());
    });

    // macOS：点击 Dock 图标时重新显示窗口
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        }
      }
    });
  });

  // 标记强制退出（区分「关闭窗口→隐藏」和「真正退出」）
  app.on('before-quit', () => {
    (app as any)._forceQuit = true;
  });

  // macOS 以外：所有窗口关闭时退出
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      destroyTray();
      app.quit();
    }
  });
}
