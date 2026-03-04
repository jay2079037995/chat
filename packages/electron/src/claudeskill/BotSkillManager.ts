/**
 * Bot Skill 管理器
 *
 * 每个 Bot 拥有独立的 Skill 列表，互不影响。
 * 负责 Skill 的安装（本地/在线）、卸载、列表、读取、系统提示词拼接。
 *
 * 存储结构：
 * userData/bots/{botId}/skills/{skill-name}/SKILL.md
 * userData/bots/{botId}/workspace/（Bot 工作区）
 */
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { parseSkillMdContent, parseSkillDir } from './ClaudeSkillParser';
import type { ClaudeSkill, ClaudeSkillMeta, PluginEntry } from '../../../shared/dist';

export class BotSkillManager {
  /** 基础数据目录 */
  private readonly baseDir: string;

  constructor() {
    this.baseDir = path.join(app.getPath('userData'), 'bots');
  }

  /**
   * 获取 Bot 的 Skill 存储目录
   */
  private getSkillsDir(botId: string): string {
    return path.join(this.baseDir, botId, 'skills');
  }

  /**
   * 获取 Bot 的工作区目录
   */
  getWorkspacePath(botId: string): string {
    return path.join(this.baseDir, botId, 'workspace');
  }

  /**
   * 确保目录存在
   */
  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 从本地目录安装 Skill
   *
   * @param botId Bot ID
   * @param sourcePath 源 Skill 目录路径（需包含 SKILL.md）
   * @returns 安装后的 Skill 元数据
   */
  async installFromLocal(botId: string, sourcePath: string): Promise<ClaudeSkillMeta> {
    // 解析 SKILL.md 获取元数据
    const skill = await parseSkillDir(sourcePath);
    const targetDir = path.join(this.getSkillsDir(botId), skill.name);

    // 确保目标目录存在
    this.ensureDir(path.dirname(targetDir));

    // 如果已存在同名 Skill，先删除
    if (fs.existsSync(targetDir)) {
      await fs.promises.rm(targetDir, { recursive: true });
    }

    // 递归复制整个 Skill 目录
    await this.copyDir(sourcePath, targetDir);

    return {
      name: skill.name,
      description: skill.description,
      version: skill.version,
      author: skill.author,
      tags: skill.tags,
      source: 'local',
    };
  }

  /**
   * 从在线 URL 安装 Skill（claude-plugins.dev）
   *
   * @param botId Bot ID
   * @param entry claude-plugins.dev 的 Skill 条目
   * @returns 安装后的 Skill 元数据
   */
  async installFromUrl(botId: string, entry: PluginEntry): Promise<ClaudeSkillMeta> {
    // 下载 SKILL.md 内容
    const response = await fetch(entry.metadata.rawFileUrl);
    if (!response.ok) {
      throw new Error(`下载 SKILL.md 失败: HTTP ${response.status}`);
    }
    const skillMdContent = await response.text();

    // 解析 SKILL.md 获取元数据
    const skill = parseSkillMdContent(skillMdContent);
    const targetDir = path.join(this.getSkillsDir(botId), skill.name);

    // 确保目标目录存在
    this.ensureDir(targetDir);

    // 如果已存在同名 Skill，先删除
    if (fs.existsSync(targetDir)) {
      await fs.promises.rm(targetDir, { recursive: true });
    }
    this.ensureDir(targetDir);

    // 写入 SKILL.md
    await fs.promises.writeFile(path.join(targetDir, 'SKILL.md'), skillMdContent, 'utf-8');

    return {
      name: skill.name,
      description: skill.description,
      version: skill.version,
      author: entry.author || skill.author,
      tags: skill.tags,
      source: 'online',
      namespace: entry.namespace,
    };
  }

  /**
   * 卸载 Skill
   *
   * @param botId Bot ID
   * @param skillName Skill 名称
   */
  async uninstall(botId: string, skillName: string): Promise<boolean> {
    const skillDir = path.join(this.getSkillsDir(botId), skillName);
    if (!fs.existsSync(skillDir)) {
      return false;
    }

    await fs.promises.rm(skillDir, { recursive: true });
    return true;
  }

  /**
   * 列出 Bot 已安装的所有 Skill
   *
   * @param botId Bot ID
   * @returns Skill 元数据列表
   */
  async listSkills(botId: string): Promise<ClaudeSkillMeta[]> {
    const skillsDir = this.getSkillsDir(botId);
    if (!fs.existsSync(skillsDir)) {
      return [];
    }

    const entries = await fs.promises.readdir(skillsDir, { withFileTypes: true });
    const skills: ClaudeSkillMeta[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(skillsDir, entry.name);
      try {
        const skill = await parseSkillDir(skillDir);
        skills.push({
          name: skill.name,
          description: skill.description,
          version: skill.version,
          author: skill.author,
          tags: skill.tags,
        });
      } catch {
        // 跳过无效的 Skill 目录
        console.warn(`[BotSkillManager] 跳过无效 Skill 目录: ${skillDir}`);
      }
    }

    return skills;
  }

  /**
   * 获取 Skill 完整内容（含 SKILL.md 指令正文）
   *
   * @param botId Bot ID
   * @param skillName Skill 名称
   * @returns 完整的 ClaudeSkill 对象
   */
  async getSkillContent(botId: string, skillName: string): Promise<ClaudeSkill | null> {
    const skillDir = path.join(this.getSkillsDir(botId), skillName);
    if (!fs.existsSync(skillDir)) {
      return null;
    }

    try {
      return await parseSkillDir(skillDir);
    } catch {
      return null;
    }
  }

  /**
   * 获取 Bot 所有 Skill 目录列表
   */
  async getSkillDirs(botId: string): Promise<string[]> {
    const skillsDir = this.getSkillsDir(botId);
    if (!fs.existsSync(skillsDir)) {
      return [];
    }

    const entries = await fs.promises.readdir(skillsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(skillsDir, e.name));
  }

  /**
   * 构建包含 Skill 指令的系统提示词
   *
   * 将所有已安装 Skill 的指令内容拼接到基础系统提示词中。
   *
   * @param botId Bot ID
   * @param basePrompt 基础系统提示词
   * @returns 增强后的系统提示词
   */
  async buildSystemPromptWithSkills(botId: string, basePrompt: string): Promise<string> {
    const skills = await this.listSkillsWithContent(botId);

    if (skills.length === 0) {
      return basePrompt;
    }

    // 拼接 Skill 指令块
    const skillBlocks = skills
      .map((skill) => {
        const header = `## Skill: ${skill.name}`;
        const desc = skill.description ? `\n${skill.description}` : '';
        const body = skill.instructions ? `\n\n${skill.instructions}` : '';
        return `${header}${desc}${body}`;
      })
      .join('\n\n---\n\n');

    const skillSection = [
      '',
      '# 可用 Skills',
      '',
      '你可以使用以下工具来执行 Skill 指令中描述的任务：',
      '- `bash_exec`: 执行 Shell 命令',
      '- `read_file`: 读取文件',
      '- `write_file`: 写入文件',
      '- `list_files`: 列出目录',
      '',
      '以下是你已安装的 Skills 及其指令：',
      '',
      skillBlocks,
    ].join('\n');

    return basePrompt + skillSection;
  }

  /**
   * 获取所有 Skill 指令的拼接文本（用于服务端 Bot 推送）
   */
  async getSkillInstructions(botId: string): Promise<string> {
    return this.buildSystemPromptWithSkills(botId, '');
  }

  /**
   * 列出所有 Skill（含完整内容）
   */
  private async listSkillsWithContent(botId: string): Promise<ClaudeSkill[]> {
    const skillsDir = this.getSkillsDir(botId);
    if (!fs.existsSync(skillsDir)) {
      return [];
    }

    const entries = await fs.promises.readdir(skillsDir, { withFileTypes: true });
    const skills: ClaudeSkill[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(skillsDir, entry.name);
      try {
        const skill = await parseSkillDir(skillDir);
        skills.push(skill);
      } catch {
        // 跳过无效目录
      }
    }

    return skills;
  }

  /**
   * 递归复制目录
   */
  private async copyDir(src: string, dest: string): Promise<void> {
    this.ensureDir(dest);
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }
}
