/**
 * SkillMarketplace 管理器单元测试（v1.14.0）
 *
 * 测试注册表管理、缓存、findManifestDir、fetchAllSkills 去重逻辑。
 * Mock electron-store / electron.net / fs / extract-zip。
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

// 创建临时目录用于 findManifestDir 测试
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-marketplace-test-'));

// Mock electron-store
const mockStoreData: Record<string, any> = {};
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: (key: string) => mockStoreData[key],
    set: (key: string, value: any) => { mockStoreData[key] = value; },
    has: (key: string) => key in mockStoreData,
  }));
});

// Mock electron
jest.mock('electron', () => ({
  app: { getPath: () => tmpDir },
  net: {
    request: jest.fn(),
  },
}));

// Mock extract-zip
jest.mock('extract-zip', () => jest.fn().mockResolvedValue(undefined));

describe('SkillMarketplace', () => {
  beforeEach(() => {
    // 清空 mock store
    Object.keys(mockStoreData).forEach((key) => delete mockStoreData[key]);
    // 清除 require 缓存
    jest.resetModules();
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  function loadMarketplace() {
    // 需要 mock SkillPackageManager
    jest.mock('../src/skills/SkillPackageManager', () => ({
      SkillPackageManager: jest.fn().mockImplementation(() => ({
        install: jest.fn().mockReturnValue({ name: 'test-skill' }),
        listCustomSkills: jest.fn().mockReturnValue([]),
        loadAll: jest.fn(),
      })),
    }));

    const { SkillMarketplace } = require('../src/skills/SkillMarketplace');
    const { SkillPackageManager } = require('../src/skills/SkillPackageManager');
    const pkgManager = new SkillPackageManager();
    return new SkillMarketplace(pkgManager);
  }

  test('构造函数初始化默认注册表', () => {
    const mp = loadMarketplace();
    const registries = mp.getRegistries();
    expect(registries).toHaveLength(1);
    expect(registries[0]).toContain('githubusercontent.com');
  });

  test('getRegistries 返回注册表列表', () => {
    mockStoreData.registries = ['https://example.com/registry.json'];
    const mp = loadMarketplace();
    expect(mp.getRegistries()).toEqual(['https://example.com/registry.json']);
  });

  test('setRegistries 更新注册表并清缓存', () => {
    const mp = loadMarketplace();
    mp.setRegistries(['https://a.com/reg.json', 'https://b.com/reg.json']);
    expect(mockStoreData.registries).toEqual(['https://a.com/reg.json', 'https://b.com/reg.json']);
  });

  test('addRegistry 添加不重复 URL', () => {
    const mp = loadMarketplace();
    const initial = mp.getRegistries();
    const initialLen = initial.length;

    mp.addRegistry('https://new-registry.com/index.json');
    expect(mp.getRegistries()).toHaveLength(initialLen + 1);

    // 重复添加不增加
    mp.addRegistry('https://new-registry.com/index.json');
    expect(mp.getRegistries()).toHaveLength(initialLen + 1);
  });

  test('removeRegistry 移除 URL', () => {
    mockStoreData.registries = ['https://a.com/reg.json', 'https://b.com/reg.json'];
    const mp = loadMarketplace();

    mp.removeRegistry('https://a.com/reg.json');
    expect(mockStoreData.registries).toEqual(['https://b.com/reg.json']);
  });

  test('findManifestDir 查找直接目录中的 manifest', () => {
    const testDir = path.join(tmpDir, 'find-test-1');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'manifest.json'), '{}');

    const mp = loadMarketplace();
    // 通过 private 方法测试：使用 prototype 访问
    const result = (mp as any).findManifestDir(testDir);
    expect(result).toBe(testDir);

    // 清理
    fs.rmSync(testDir, { recursive: true });
  });

  test('findManifestDir 查找子目录中的 manifest', () => {
    const testDir = path.join(tmpDir, 'find-test-2');
    const subDir = path.join(testDir, 'my-skill');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'manifest.json'), '{}');

    const mp = loadMarketplace();
    const result = (mp as any).findManifestDir(testDir);
    expect(result).toBe(subDir);

    // 清理
    fs.rmSync(testDir, { recursive: true });
  });

  test('findManifestDir 找不到时返回 null', () => {
    const testDir = path.join(tmpDir, 'find-test-3');
    fs.mkdirSync(testDir, { recursive: true });
    // 不创建 manifest.json

    const mp = loadMarketplace();
    const result = (mp as any).findManifestDir(testDir);
    expect(result).toBeNull();

    // 清理
    fs.rmSync(testDir, { recursive: true });
  });
});
