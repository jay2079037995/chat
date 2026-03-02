/**
 * Electron 主进程入口
 *
 * 负责窗口管理、IPC 注册、Agent 管理器初始化。
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import { getAllAgents, saveAgent, updateAgent, removeAgent, getWindowState, saveWindowState } from './store';
import { AgentManager } from './agentManager';
import type { AgentConfig } from '../shared/types';
import { PROVIDERS } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let agentManager: AgentManager;

const isDev = !app.isPackaged;

function createWindow() {
  const windowState = getWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:3002');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 保存窗口状态
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: mainWindow.isMaximized(),
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/** 向渲染进程推送日志 */
function sendLog(entry: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:log', entry);
  }
}

/** 向渲染进程推送状态变更 */
function sendStatusChange(agentId: string, state: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:status-change', agentId, state);
  }
}

function registerIpcHandlers() {
  // 列出所有 Agent
  ipcMain.handle('agent:list', () => getAllAgents());

  // 创建 Agent
  ipcMain.handle('agent:create', (_event, config: Omit<AgentConfig, 'id' | 'createdAt'>) => {
    const agent: AgentConfig = {
      ...config,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    saveAgent(agent);
    return agent;
  });

  // 更新 Agent
  ipcMain.handle('agent:update', (_event, id: string, updates: Partial<AgentConfig>) => {
    const updated = updateAgent(id, updates);
    if (!updated) throw new Error('AGENT_NOT_FOUND');
    // 如果正在运行，重启以应用新配置
    if (agentManager.getStatus(id) === 'running') {
      agentManager.stopAgent(id);
      agentManager.startAgent(updated);
    }
    return updated;
  });

  // 删除 Agent
  ipcMain.handle('agent:delete', (_event, id: string) => {
    agentManager.stopAgent(id);
    removeAgent(id);
  });

  // 启动 Agent
  ipcMain.handle('agent:start', (_event, id: string) => {
    const agents = getAllAgents();
    const agent = agents.find((a) => a.id === id);
    if (!agent) throw new Error('AGENT_NOT_FOUND');
    agentManager.startAgent(agent);
    updateAgent(id, { enabled: true });
  });

  // 停止 Agent
  ipcMain.handle('agent:stop', (_event, id: string) => {
    agentManager.stopAgent(id);
    updateAgent(id, { enabled: false });
  });

  // 获取所有 Agent 状态
  ipcMain.handle('agent:states', () => {
    const states: Record<string, any> = {};
    const agents = getAllAgents();
    for (const agent of agents) {
      states[agent.id] = agentManager.getState(agent.id) ?? {
        config: agent,
        status: 'stopped',
        messagesProcessed: 0,
      };
    }
    return states;
  });

  // 获取 Provider 信息
  ipcMain.handle('agent:providers', () => PROVIDERS);
}

// 防止多实例
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // 初始化 Agent 管理器（含 Slash 命令配置变更回调）
    agentManager = new AgentManager(sendLog, sendStatusChange, (agentId, updates) => {
      updateAgent(agentId, updates);
      sendStatusChange(agentId, agentManager.getState(agentId) as any);
    });

    // 注册 IPC
    registerIpcHandlers();

    // 创建窗口
    createWindow();

    // 自动恢复 enabled 的 agents
    const agents = getAllAgents();
    for (const agent of agents) {
      if (agent.enabled) {
        agentManager.startAgent(agent);
      }
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });

  app.on('before-quit', () => {
    agentManager?.stopAll();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
