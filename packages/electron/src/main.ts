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
import { BotSkillManager } from './claudeskill/BotSkillManager';
import { PluginSearchClient } from './claudeskill/PluginSearchClient';
import { GenericToolExecutor } from './claudeskill/GenericToolExecutor';
import { LocalBotManager } from './localbot/LocalBotManager';
import type { PluginEntry, GenericToolExecRequest } from '../../shared/dist';

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

  // --- Claude Skill 系统 ---
  const botSkillManager = new BotSkillManager();
  const pluginSearchClient = new PluginSearchClient();
  const genericToolExecutor = new GenericToolExecutor();

  // --- Bot Skill 管理 IPC ---
  ipcMain.handle('bot-skill:list', (_event, botId: string) =>
    botSkillManager.listSkills(botId),
  );

  ipcMain.handle('bot-skill:install', async (_event, botId: string, sourcePath: string) => {
    const result = await botSkillManager.installFromLocal(botId, sourcePath);
    // 安装后重建该 Bot 的 Agent（刷新 Skill 指令和工具）
    await rebuildLocalBot(botId);
    return result;
  });

  ipcMain.handle('bot-skill:install-url', async (_event, botId: string, entry: PluginEntry) => {
    const result = await botSkillManager.installFromUrl(botId, entry);
    // 安装后重建该 Bot 的 Agent
    await rebuildLocalBot(botId);
    return result;
  });

  ipcMain.handle('bot-skill:uninstall', async (_event, botId: string, skillName: string) => {
    const result = await botSkillManager.uninstall(botId, skillName);
    // 卸载后重建该 Bot 的 Agent
    await rebuildLocalBot(botId);
    return result;
  });

  ipcMain.handle('bot-skill:get-content', (_event, botId: string, skillName: string) =>
    botSkillManager.getSkillContent(botId, skillName),
  );

  ipcMain.handle('bot-skill:select-dir', async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择 Skill 目录',
      message: '请选择包含 SKILL.md 的目录',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // --- 在线 Skill 搜索 IPC ---
  ipcMain.handle('plugin:search', (_event, query: string, limit?: number, offset?: number) =>
    pluginSearchClient.search(query, limit, offset),
  );

  // --- 通用工具执行 IPC ---
  ipcMain.handle('tool:exec', async (_event, request: GenericToolExecRequest) => {
    const workspacePath = botSkillManager.getWorkspacePath(request.botId);
    const skillDirs = await botSkillManager.getSkillDirs(request.botId);
    return genericToolExecutor.execute(request, workspacePath, skillDirs);
  });

  // --- Local Bot (Mastra) IPC ---
  const localBotManager = new LocalBotManager();

  // 注入 BotSkillManager
  localBotManager.setBotSkillManager(botSkillManager);

  /** Skill 安装/卸载后重建指定 Bot 的 Agent */
  async function rebuildLocalBot(botId: string): Promise<void> {
    if (localBotManager.isActive(botId)) {
      const config = localBotManager.getConfig(botId);
      if (config) {
        try {
          await localBotManager.initBot(botId, config);
        } catch (err) {
          console.error(`[main] 重建本地 Bot ${botId} 失败:`, err);
        }
      }
    }
  }

  // 设置回调：通过 IPC 将流式事件发送到渲染进程
  localBotManager.setCallbacks({
    onChunk: (data) => {
      const win = getMainWindow();
      if (win) win.webContents.send('localbot:emit', 'localbot:stream', data);
    },
    onEnd: (data) => {
      const win = getMainWindow();
      if (win) win.webContents.send('localbot:emit', 'localbot:stream:end', data);
    },
    onError: (data) => {
      const win = getMainWindow();
      if (win) win.webContents.send('localbot:emit', 'localbot:error', data);
    },
  });

  ipcMain.handle('localbot:init', async (_event, botId: string, config: any) => {
    await localBotManager.initBot(botId, config);
    return { success: true };
  });

  ipcMain.handle('localbot:handle-message', async (_event, botId: string, conversationId: string, content: string) => {
    await localBotManager.handleMessage(botId, conversationId, content);
    return { success: true };
  });

  ipcMain.handle('localbot:remove', (_event, botId: string) => {
    localBotManager.removeBot(botId);
    return { success: true };
  });

  ipcMain.handle('localbot:active-bots', () => {
    return localBotManager.getActiveBots();
  });

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
