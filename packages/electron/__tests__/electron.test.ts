/**
 * Electron 打包验证与基本结构测试
 *
 * 验证 Electron 包的文件结构和配置正确性。
 * 注意：不启动实际的 Electron 进程（需要 GUI 环境），
 * 仅验证文件和配置层面的正确性。
 */
import fs from 'fs';
import path from 'path';

const ELECTRON_ROOT = path.resolve(__dirname, '..');

describe('Electron 包结构验证', () => {
  test('package.json 存在且包含必要字段', () => {
    const pkgPath = path.join(ELECTRON_ROOT, 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.name).toBe('@chat/electron');
    expect(pkg.main).toBe('dist/main.js');
    expect(pkg.devDependencies).toHaveProperty('electron');
    expect(pkg.devDependencies).toHaveProperty('electron-builder');
  });

  test('主进程入口文件存在', () => {
    expect(fs.existsSync(path.join(ELECTRON_ROOT, 'src', 'main.ts'))).toBe(true);
  });

  test('preload 脚本存在', () => {
    expect(fs.existsSync(path.join(ELECTRON_ROOT, 'src', 'preload.ts'))).toBe(true);
  });

  test('窗口管理模块存在', () => {
    expect(fs.existsSync(path.join(ELECTRON_ROOT, 'src', 'windowManager.ts'))).toBe(true);
  });

  test('菜单构建模块存在', () => {
    expect(fs.existsSync(path.join(ELECTRON_ROOT, 'src', 'menuBuilder.ts'))).toBe(true);
  });

  test('托盘管理模块存在', () => {
    expect(fs.existsSync(path.join(ELECTRON_ROOT, 'src', 'trayManager.ts'))).toBe(true);
  });

  test('持久化配置模块存在', () => {
    expect(fs.existsSync(path.join(ELECTRON_ROOT, 'src', 'store.ts'))).toBe(true);
  });

  test('应用图标存在', () => {
    expect(fs.existsSync(path.join(ELECTRON_ROOT, 'assets', 'icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(ELECTRON_ROOT, 'assets', 'tray-icon.png'))).toBe(true);
  });
});

describe('electron-builder 配置验证', () => {
  test('配置文件存在', () => {
    expect(fs.existsSync(path.join(ELECTRON_ROOT, 'electron-builder.yml'))).toBe(true);
  });

  test('配置包含三平台目标', () => {
    const content = fs.readFileSync(path.join(ELECTRON_ROOT, 'electron-builder.yml'), 'utf-8');
    expect(content).toContain('mac:');
    expect(content).toContain('win:');
    expect(content).toContain('linux:');
    expect(content).toContain('dmg');
    expect(content).toContain('nsis');
    expect(content).toContain('AppImage');
  });
});
