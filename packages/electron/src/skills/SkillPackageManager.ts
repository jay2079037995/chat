/**
 * 自定义 Skill 包管理器
 *
 * 管理 userData/skills/ 目录下的自定义 Skill 包。
 * 每个 Skill 包是一个子目录，包含：
 *   - manifest.json — SkillPackageManifest 定义
 *   - handler.js   — CommonJS 模块，导出 { functionName: async (params) => result }
 */
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { SkillHandler } from './handlers';
import type { PermissionLevel } from './PermissionManager';

/** Skill 平台类型（本地定义，与 @chat/shared 一致） */
type SkillPlatform = 'mac' | 'windows' | 'linux' | 'all';
/** Skill 权限类型（本地定义，与 @chat/shared 一致） */
type SkillPermission = 'read' | 'write' | 'execute' | 'dangerous';

/** Skill Action 定义（本地类型） */
interface SkillAction {
  functionName: string;
  description: string;
  parameters: Record<string, unknown>;
  permission?: SkillPermission;
}

/** Skill 元数据定义（本地类型，与 @chat/shared SkillDefinition 一致） */
export interface SkillDefinition {
  name: string;
  displayName: string;
  description: string;
  platform: SkillPlatform;
  permission: SkillPermission;
  actions: SkillAction[];
  source?: 'builtin' | 'custom';
  enabled?: boolean;
}

/** 自定义 Skill 包清单（对应 manifest.json） */
interface SkillPackageManifest {
  name: string;
  displayName: string;
  description: string;
  platform: SkillPlatform;
  permission: SkillPermission;
  actions: SkillAction[];
  version?: string;
  author?: string;
}

/** Skill 包根目录 */
const SKILLS_DIR = path.join(app.getPath('userData'), 'skills');

export class SkillPackageManager {
  /** 已加载的自定义 Skill 定义 */
  private customSkills = new Map<string, SkillDefinition>();
  /** 已加载的自定义 handler 映射（functionName → handler） */
  private customHandlers = new Map<string, SkillHandler>();
  /** 已加载的自定义权限映射（functionName → permission） */
  private customPermissions = new Map<string, PermissionLevel>();

  constructor() {
    // 确保 skills 目录存在
    if (!fs.existsSync(SKILLS_DIR)) {
      fs.mkdirSync(SKILLS_DIR, { recursive: true });
    }
  }

  /** 扫描并加载所有自定义 Skill 包 */
  loadAll(): void {
    this.customSkills.clear();
    this.customHandlers.clear();
    this.customPermissions.clear();

    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        this.loadPackage(entry.name);
      } catch (err) {
        console.error(`[SkillPackageManager] 加载自定义 Skill 包失败: ${entry.name}`, err);
      }
    }
  }

  /** 加载单个 Skill 包 */
  private loadPackage(dirName: string): void {
    const pkgDir = path.join(SKILLS_DIR, dirName);
    const manifestPath = path.join(pkgDir, 'manifest.json');
    const handlerPath = path.join(pkgDir, 'handler.js');

    if (!fs.existsSync(manifestPath)) {
      throw new Error(`缺少 manifest.json: ${dirName}`);
    }
    if (!fs.existsSync(handlerPath)) {
      throw new Error(`缺少 handler.js: ${dirName}`);
    }

    // 读取 manifest
    const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest: SkillPackageManifest = JSON.parse(manifestRaw);

    // 校验 manifest 结构
    if (!manifest.name || !manifest.actions || !Array.isArray(manifest.actions)) {
      throw new Error(`无效的 manifest.json: ${dirName}`);
    }

    // 加载 handler.js（CommonJS 格式），清除缓存以支持热重载
    const resolvedPath = require.resolve(handlerPath);
    delete require.cache[resolvedPath];
    const handlerModule = require(handlerPath);

    // 构造 SkillDefinition
    const skillDef: SkillDefinition = {
      name: manifest.name,
      displayName: manifest.displayName,
      description: manifest.description,
      platform: manifest.platform,
      permission: manifest.permission,
      actions: manifest.actions,
      source: 'custom',
    };
    this.customSkills.set(manifest.name, skillDef);

    // 映射 handler 和 permission
    for (const action of manifest.actions) {
      const fn = handlerModule[action.functionName];
      if (typeof fn === 'function') {
        this.customHandlers.set(action.functionName, fn);
      } else {
        console.warn(`[SkillPackageManager] handler.js 缺少函数: ${action.functionName}`);
      }
      // 权限：action 级 > skill 级，默认 read
      const perm = (action.permission || manifest.permission || 'read') as PermissionLevel;
      this.customPermissions.set(action.functionName, perm);
    }
  }

  /**
   * 安装自定义 Skill 包（从指定目录复制）
   * @param sourcePath 包含 manifest.json + handler.js 的源目录
   */
  install(sourcePath: string): SkillDefinition {
    const manifestPath = path.join(sourcePath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('指定目录缺少 manifest.json');
    }
    const handlerPath = path.join(sourcePath, 'handler.js');
    if (!fs.existsSync(handlerPath)) {
      throw new Error('指定目录缺少 handler.js');
    }

    const manifest: SkillPackageManifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf-8'),
    );
    if (!manifest.name) {
      throw new Error('manifest.json 缺少 name 字段');
    }

    // 使用 skill name 做目录名（去掉特殊字符）
    const safeName = manifest.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = path.join(SKILLS_DIR, safeName);

    // 如果已存在则覆盖
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true });
    }
    fs.cpSync(sourcePath, targetDir, { recursive: true });

    // 重新加载该包
    this.loadPackage(safeName);
    return this.customSkills.get(manifest.name)!;
  }

  /** 卸载自定义 Skill 包 */
  uninstall(skillName: string): boolean {
    const skill = this.customSkills.get(skillName);
    if (!skill) return false;

    // 删除 handler 和 permission 映射
    for (const action of skill.actions) {
      this.customHandlers.delete(action.functionName);
      this.customPermissions.delete(action.functionName);
    }
    this.customSkills.delete(skillName);

    // 删除文件系统中的目录
    const safeName = skillName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = path.join(SKILLS_DIR, safeName);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true });
    }
    return true;
  }

  /** 获取所有自定义 Skill 定义 */
  listCustomSkills(): SkillDefinition[] {
    return Array.from(this.customSkills.values());
  }

  /** 查找自定义 handler */
  getHandler(functionName: string): SkillHandler | undefined {
    return this.customHandlers.get(functionName);
  }

  /** 查找自定义权限 */
  getPermission(functionName: string): PermissionLevel | undefined {
    return this.customPermissions.get(functionName);
  }

  /** 获取 skills 目录路径 */
  getSkillsDir(): string {
    return SKILLS_DIR;
  }
}
