/**
 * 原生菜单栏构建器
 *
 * 为 macOS 和 Windows/Linux 分别构建合适的菜单结构。
 * macOS 有应用菜单（第一个菜单项是应用名），Windows/Linux 没有。
 */
import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';

/** 构建并设置应用菜单 */
export function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [];

  // macOS 应用菜单
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 Chat' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 Chat' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 Chat' },
      ],
    });
  }

  // 编辑菜单
  template.push({
    label: '编辑',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' },
    ],
  });

  // 视图菜单
  template.push({
    label: '视图',
    submenu: [
      { role: 'reload', label: '重新加载' },
      { role: 'forceReload', label: '强制重新加载' },
      { role: 'toggleDevTools', label: '开发者工具' },
      { type: 'separator' },
      { role: 'resetZoom', label: '实际大小' },
      { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '缩小' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: '切换全屏' },
    ],
  });

  // 窗口菜单
  template.push({
    label: '窗口',
    submenu: isMac
      ? [
          { role: 'minimize', label: '最小化' },
          { role: 'zoom', label: '缩放' },
          { type: 'separator' },
          { role: 'front', label: '全部置于顶层' },
        ]
      : [
          { role: 'minimize', label: '最小化' },
          { role: 'close', label: '关闭' },
        ],
  });

  // 帮助菜单
  template.push({
    label: '帮助',
    submenu: [
      {
        label: '关于此应用',
        click: async () => {
          await shell.openExternal('https://github.com');
        },
      },
    ],
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
