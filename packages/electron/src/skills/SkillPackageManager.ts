/**
 * Skill 包管理器（SKILL.md 标准）
 *
 * 管理 userData/skills/ 目录下的 Skill 包。
 * 每个 Skill 包是一个子目录，包含：
 *   - SKILL.md       — YAML frontmatter + Markdown 指令（必需）
 *   - scripts/handler.js — CommonJS 模块，导出 { functionName: async (params) => result }（可选）
 */
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { parseSkillMd, toSkillDefinition } from './SkillMdParser';
import type { SkillDefinition } from './SkillMdParser';
import type { SkillHandler } from './handlers';
import type { PermissionLevel } from './PermissionManager';

export type { SkillDefinition };

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
    const skillMdPath = path.join(pkgDir, 'SKILL.md');

    if (!fs.existsSync(skillMdPath)) {
      throw new Error(`缺少 SKILL.md: ${dirName}`);
    }

    // 解析 SKILL.md
    const raw = fs.readFileSync(skillMdPath, 'utf-8');
    const parsed = parseSkillMd(raw);
    const skillDef = toSkillDefinition(parsed, 'custom');

    this.customSkills.set(skillDef.name, skillDef);

    // 尝试加载 scripts/handler.js（可选）
    const handlerPath = path.join(pkgDir, 'scripts', 'handler.js');
    if (fs.existsSync(handlerPath)) {
      // 清除缓存以支持热重载
      const resolvedPath = require.resolve(handlerPath);
      delete require.cache[resolvedPath];
      const handlerModule = require(handlerPath);

      // 映射 handler 和 permission
      for (const action of skillDef.actions) {
        const fn = handlerModule[action.functionName];
        if (typeof fn === 'function') {
          this.customHandlers.set(action.functionName, fn);
        } else {
          console.warn(`[SkillPackageManager] handler.js 缺少函数: ${action.functionName}`);
        }
        const perm = (action.permission || skillDef.permission || 'read') as PermissionLevel;
        this.customPermissions.set(action.functionName, perm);
      }
    }
  }

  /**
   * 安装自定义 Skill 包（从指定目录复制）
   * @param sourcePath 包含 SKILL.md 的源目录
   */
  install(sourcePath: string): SkillDefinition {
    const skillMdPath = path.join(sourcePath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      throw new Error('指定目录缺少 SKILL.md');
    }

    // 解析 SKILL.md 获取 name
    const raw = fs.readFileSync(skillMdPath, 'utf-8');
    const parsed = parseSkillMd(raw);
    const name = parsed.frontmatter.name;
    if (!name) {
      throw new Error('SKILL.md 缺少 name 字段');
    }

    // 使用 skill name 做目录名（去掉特殊字符）
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = path.join(SKILLS_DIR, safeName);

    // 如果已存在则覆盖
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true });
    }
    fs.cpSync(sourcePath, targetDir, { recursive: true });

    // 重新加载该包
    this.loadPackage(safeName);
    return this.customSkills.get(name)!;
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
