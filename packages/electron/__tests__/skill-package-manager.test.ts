/**
 * SkillPackageManager 单元测试
 *
 * 验证自定义 Skill 包的加载、安装、卸载和校验逻辑。
 * 使用真实临时目录替代 mock 文件系统。
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

// 创建临时 skills 目录
const tmpSkillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-pkg-test-'));

// Mock electron app 指向临时目录
jest.mock('electron', () => ({
  app: {
    getPath: () => tmpSkillsDir,
  },
}));

// SkillPackageManager 内部用 path.join(app.getPath('userData'), 'skills') 做 SKILLS_DIR
// 所以 SKILLS_DIR = tmpSkillsDir/skills
const SKILLS_DIR = path.join(tmpSkillsDir, 'skills');

/** 创建一个有效的 Skill 包目录 */
function createSkillPackage(
  dir: string,
  manifest: Record<string, unknown>,
  handlerCode: string,
): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dir, 'handler.js'), handlerCode);
}

const validManifest = {
  name: 'test-skill',
  displayName: 'Test Skill',
  description: '测试用 Skill',
  platform: 'all',
  permission: 'read',
  actions: [
    {
      functionName: 'test_run',
      description: '测试运行',
      parameters: { type: 'object', properties: {} },
    },
  ],
  version: '1.0.0',
};

const validHandlerCode = `
module.exports = {
  test_run: async (params) => ({ ok: true }),
};
`;

describe('SkillPackageManager', () => {
  beforeEach(() => {
    // 清理 skills 目录
    if (fs.existsSync(SKILLS_DIR)) {
      fs.rmSync(SKILLS_DIR, { recursive: true });
    }
    fs.mkdirSync(SKILLS_DIR, { recursive: true });

    // 清除 require 缓存中的 handler 模块
    for (const key of Object.keys(require.cache)) {
      if (key.includes('skill-pkg-test-')) {
        delete require.cache[key];
      }
    }
  });

  afterAll(() => {
    // 清理临时目录
    if (fs.existsSync(tmpSkillsDir)) {
      fs.rmSync(tmpSkillsDir, { recursive: true });
    }
  });

  test('构造函数确保 skills 目录存在', () => {
    // 删除 skills 目录，构造函数应重新创建
    fs.rmSync(SKILLS_DIR, { recursive: true });
    const { SkillPackageManager } = require('../src/skills/SkillPackageManager');
    new SkillPackageManager();
    expect(fs.existsSync(SKILLS_DIR)).toBe(true);
  });

  test('loadAll 加载目录中的有效 Skill 包', () => {
    createSkillPackage(path.join(SKILLS_DIR, 'test-skill'), validManifest, validHandlerCode);

    const { SkillPackageManager } = require('../src/skills/SkillPackageManager');
    const manager = new SkillPackageManager();
    manager.loadAll();

    const skills = manager.listCustomSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('test-skill');
    expect(skills[0].source).toBe('custom');
  });

  test('loadAll 跳过空目录（无子包）', () => {
    const { SkillPackageManager } = require('../src/skills/SkillPackageManager');
    const manager = new SkillPackageManager();
    manager.loadAll();
    expect(manager.listCustomSkills()).toHaveLength(0);
  });

  test('缺少 manifest.json 时跳过并输出错误', () => {
    const pkgDir = path.join(SKILLS_DIR, 'bad-pkg');
    fs.mkdirSync(pkgDir);
    fs.writeFileSync(path.join(pkgDir, 'handler.js'), 'module.exports = {};');
    // 不创建 manifest.json

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { SkillPackageManager } = require('../src/skills/SkillPackageManager');
    const manager = new SkillPackageManager();
    manager.loadAll();

    expect(manager.listCustomSkills()).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('uninstall 删除已安装的 Skill', () => {
    createSkillPackage(path.join(SKILLS_DIR, 'test-skill'), validManifest, validHandlerCode);

    const { SkillPackageManager } = require('../src/skills/SkillPackageManager');
    const manager = new SkillPackageManager();
    manager.loadAll();
    expect(manager.listCustomSkills()).toHaveLength(1);

    const result = manager.uninstall('test-skill');
    expect(result).toBe(true);
    expect(manager.listCustomSkills()).toHaveLength(0);
    expect(manager.getHandler('test_run')).toBeUndefined();
  });

  test('uninstall 不存在的 Skill 返回 false', () => {
    const { SkillPackageManager } = require('../src/skills/SkillPackageManager');
    const manager = new SkillPackageManager();
    expect(manager.uninstall('nonexistent')).toBe(false);
  });

  test('getHandler 返回加载的 handler 函数', async () => {
    createSkillPackage(path.join(SKILLS_DIR, 'test-skill'), validManifest, validHandlerCode);

    const { SkillPackageManager } = require('../src/skills/SkillPackageManager');
    const manager = new SkillPackageManager();
    manager.loadAll();

    const handler = manager.getHandler('test_run');
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');

    const result = await handler!({});
    expect(result).toEqual({ ok: true });
  });

  test('getPermission 返回 action 级权限', () => {
    const manifest = {
      ...validManifest,
      name: 'perm-skill',
      actions: [
        {
          functionName: 'perm_exec',
          description: '执行操作',
          parameters: { type: 'object', properties: {} },
          permission: 'execute',
        },
      ],
    };

    createSkillPackage(
      path.join(SKILLS_DIR, 'perm-skill'),
      manifest,
      `module.exports = { perm_exec: async () => ({}) };`,
    );

    const { SkillPackageManager } = require('../src/skills/SkillPackageManager');
    const manager = new SkillPackageManager();
    manager.loadAll();

    expect(manager.getPermission('perm_exec')).toBe('execute');
  });
});
