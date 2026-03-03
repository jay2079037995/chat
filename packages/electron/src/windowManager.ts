/**
 * 窗口管理器
 *
 * 负责创建主窗口、记忆窗口位置和尺寸、处理窗口生命周期事件。
 */
import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { getWindowState, saveWindowState, type WindowState } from './store';

/** 主窗口实例引用 */
let mainWindow: BrowserWindow | null = null;

/**
 * 验证保存的窗口位置是否仍在可见屏幕范围内
 * （防止外接显示器断开后窗口不可见）
 */
function isPositionValid(state: WindowState): boolean {
  if (state.x === undefined || state.y === undefined) return false;
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const { x, y, width, height } = display.bounds;
    return (
      state.x! >= x &&
      state.y! >= y &&
      state.x! < x + width &&
      state.y! < y + height
    );
  });
}

/** 创建主窗口 */
export function createMainWindow(): BrowserWindow {
  const savedState = getWindowState();

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: savedState.width,
    height: savedState.height,
    minWidth: 800,
    minHeight: 600,
    title: 'Chat',
    show: false, // 准备就绪后再显示，避免白屏闪烁
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  };

  // 如果保存的位置在可见范围内，恢复位置
  if (isPositionValid(savedState)) {
    windowOptions.x = savedState.x;
    windowOptions.y = savedState.y;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // 最大化恢复
  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  // 准备就绪后显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 窗口状态变更时保存
  const saveCurrentState = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const bounds = mainWindow.getBounds();
    saveWindowState({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    });
  };

  mainWindow.on('resize', saveCurrentState);
  mainWindow.on('move', saveCurrentState);
  mainWindow.on('maximize', saveCurrentState);
  mainWindow.on('unmaximize', saveCurrentState);

  // 关闭窗口时最小化到托盘而非退出
  mainWindow.on('close', (event) => {
    if (!(app as any)._forceQuit) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // 加载应用
  const isDev = !app.isPackaged;
  if (isDev) {
    // 开发模式：加载 webpack dev server
    void mainWindow.loadURL('http://localhost:3000');
  } else {
    // 生产模式：加载内嵌的客户端静态文件
    const clientDistPath = path.join(process.resourcesPath, 'client-dist', 'index.html');
    void mainWindow.loadFile(clientDistPath);
  }

  // 开发模式下打开 DevTools
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/** 获取主窗口实例 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
