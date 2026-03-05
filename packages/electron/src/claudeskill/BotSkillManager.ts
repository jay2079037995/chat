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
  /** 自定义工作目录配置文件路径 */
  private readonly workspaceConfigPath: string;
  /** 自定义工作目录内存缓存 { botId → dirPath } */
  private customWorkspaces: Record<string, string> = {};

  constructor() {
    this.baseDir = path.join(app.getPath('userData'), 'bots');
    this.workspaceConfigPath = path.join(this.baseDir, 'workspace-config.json');
    this.loadWorkspaceConfig();
  }

  /**
   * 获取 Bot 的 Skill 存储目录
   */
  private getSkillsDir(botId: string): string {
    return path.join(this.baseDir, botId, 'skills');
  }

  /**
   * 获取 Bot 的工作区目录（优先返回自定义路径）
   */
  getWorkspacePath(botId: string): string {
    const custom = this.customWorkspaces[botId];
    if (custom && fs.existsSync(custom)) {
      return custom;
    }
    return path.join(this.baseDir, botId, 'workspace');
  }

  /**
   * 设置自定义工作目录
   */
  setCustomWorkspace(botId: string, dirPath: string): void {
    this.customWorkspaces[botId] = dirPath;
    this.saveWorkspaceConfig();
  }

  /**
   * 清除自定义工作目录（恢复默认）
   */
  clearCustomWorkspace(botId: string): void {
    delete this.customWorkspaces[botId];
    this.saveWorkspaceConfig();
  }

  /**
   * 获取自定义工作目录（如有）
   */
  getCustomWorkspace(botId: string): string | null {
    return this.customWorkspaces[botId] || null;
  }

  /** 从磁盘加载自定义工作目录配置 */
  private loadWorkspaceConfig(): void {
    try {
      if (fs.existsSync(this.workspaceConfigPath)) {
        this.customWorkspaces = JSON.parse(fs.readFileSync(this.workspaceConfigPath, 'utf-8'));
      }
    } catch {
      this.customWorkspaces = {};
    }
  }

  /** 保存自定义工作目录配置到磁盘 */
  private saveWorkspaceConfig(): void {
    this.ensureDir(path.dirname(this.workspaceConfigPath));
    fs.writeFileSync(this.workspaceConfigPath, JSON.stringify(this.customWorkspaces, null, 2));
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
      // GitHub API 限速检测
      if (response.status === 403 || response.status === 429) {
        const resetHeader = response.headers.get('x-ratelimit-reset');
        const retryAfter = resetHeader
          ? Math.ceil((Number(resetHeader) * 1000 - Date.now()) / 60000)
          : null;
        const waitMsg = retryAfter && retryAfter > 0
          ? `，请等待约 ${retryAfter} 分钟后重试`
          : '，请稍后重试';
        throw new Error(`GitHub API 请求被限速 (HTTP ${response.status})${waitMsg}`);
      }
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

    // 写入 SKILL.md（失败时回滚清理目录）
    try {
      await fs.promises.writeFile(path.join(targetDir, 'SKILL.md'), skillMdContent, 'utf-8');
    } catch (writeErr) {
      // 回滚：清理刚创建的目录
      try { await fs.promises.rm(targetDir, { recursive: true }); } catch { /* ignore */ }
      throw writeErr;
    }

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
   * 构建包含 Skill 概览的系统提示词（v2.1.0 概览模式）
   *
   * 仅注入 Skill 名称和描述，Agent 使用 read_skill 按需加载完整指令。
   *
   * @param botId Bot ID
   * @param basePrompt 基础系统提示词
   * @returns 增强后的系统提示词
   */
  async buildSystemPromptWithSkills(botId: string, basePrompt: string): Promise<string> {
    const skills = await this.listSkills(botId);
    const workspacePath = this.getWorkspacePath(botId);

    const sections: string[] = [
      '',
      '# 工作区环境',
      '',
      `你拥有一个专属的工作目录: \`${workspacePath}\``,
      '',
      '## 工具使用说明',
      '',
      '你可以使用以下工具来执行任务：',
      '',
      '### 基础工具',
      '- `bash_exec`: 执行 Shell 命令。命令在工作区目录中运行，无需 cd。',
      '- `read_file`: 读取文件。相对路径基于工作区目录解析。',
      '- `write_file`: 写入文件。相对路径基于工作区目录解析。只能写入工作区内的文件。',
      '- `list_files`: 列出目录。默认列出工作区根目录。',
      '- `present_choices`: 向用户展示可点击的选项按钮或请求文本输入。',
      '',
      '### Skill 管理工具',
      '- `search_skills`: 在 claude-plugins.dev 上搜索可用的 Skill。',
      '- `install_skill`: 安装 Skill（从 URL 或本地路径）。**安装前请用 present_choices 确认。**',
      '- `uninstall_skill`: 卸载已安装的 Skill。**卸载前请用 present_choices 确认。**',
      '- `list_skills`: 列出已安装的所有 Skill。',
      '- `read_skill`: 读取 Skill 的完整 SKILL.md 指令。当需要使用某个 Skill 时，先用此工具加载其指令。',
      '',
      '**重要**:',
      '- 所有相对路径都基于工作区目录解析',
      '- 你可以直接使用相对路径（如 `output.docx`），无需拼接绝对路径',
      '- bash_exec 的工作目录已设为工作区，直接运行命令即可',
      '- 当用户需求超出你的能力范围时，使用 search_skills 搜索合适的 Skill',
    ];

    // 有 Skill 时追加概览（仅名称 + 描述）
    if (skills.length > 0) {
      const skillList = skills
        .map((s) => `- **${s.name}**: ${s.description || '(无描述)'}`)
        .join('\n');

      sections.push(
        '',
        '# 已安装 Skills（概览）',
        '',
        '以下 Skill 已安装。使用 `read_skill` 工具加载完整指令后再使用。',
        '',
        skillList,
      );
    }

    return basePrompt + sections.join('\n');
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
