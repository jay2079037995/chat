/**
 * 系统托盘管理器
 *
 * 在系统托盘区域显示应用图标。
 * 点击托盘图标可显示/隐藏窗口，右键显示菜单。
 */
import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { getMainWindow } from './windowManager';

/** 托盘实例引用 */
let tray: Tray | null = null;

/** 获取托盘图标路径 */
function getTrayIconPath(): string {
  const basePath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '..', 'assets');
  return path.join(basePath, 'tray-icon.png');
}

/** 创建系统托盘 */
export function createTray(): void {
  const iconPath = getTrayIconPath();
  const icon = nativeImage.createFromPath(iconPath);

  // macOS 上将托盘图标设为 Template 图标（自动适配深色/浅色模式）
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('Chat');

  // 构建托盘右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        (app as any)._forceQuit = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 单击托盘图标切换窗口显示/隐藏
  tray.on('click', () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
}

/** 销毁托盘 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
