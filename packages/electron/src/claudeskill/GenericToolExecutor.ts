/**
 * 通用工具执行器
 *
 * 在 Bot 的 workspace 沙箱中执行通用工具。
 * 支持 11 种工具：
 * - 文件/命令：bash_exec、read_file、write_file、list_files、read_file_binary
 * - Skill 管理：search_skills、install_skill、uninstall_skill、list_skills、read_skill
 * - 沙箱执行：execute_skill_script
 *
 * 所有文件操作限制在 workspace 和 skill 目录范围内（安全沙箱）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import archiver from 'archiver';
import type { GenericToolExecRequest, GenericToolExecResult } from '../../../shared/dist';
import type { BotSkillManager } from './BotSkillManager';
import type { PluginSearchClient } from './PluginSearchClient';
import { SandboxExecutor } from './SandboxExecutor';

/** 默认命令超时时间（毫秒） */
const DEFAULT_TIMEOUT = 30000;

export class GenericToolExecutor {
  private botSkillManager: BotSkillManager | null = null;
  private pluginSearchClient: PluginSearchClient | null = null;
  private sandboxExecutor = new SandboxExecutor();

  /**
   * 注入 Skill 管理依赖（延迟注入，避免循环依赖）
   */
  setSkillDependencies(skillManager: BotSkillManager, searchClient: PluginSearchClient): void {
    this.botSkillManager = skillManager;
    this.pluginSearchClient = searchClient;
  }

  /**
   * 执行通用工具
   *
   * @param request 工具执行请求
   * @param workspacePath Bot 工作区目录
   * @param skillDirs Bot 已安装的 Skill 目录列表
   * @returns 执行结果
   */
  async execute(
    request: GenericToolExecRequest,
    workspacePath: string,
    skillDirs: string[],
  ): Promise<GenericToolExecResult> {
    try {
      // 确保工作区存在
      if (!fs.existsSync(workspacePath)) {
        fs.mkdirSync(workspacePath, { recursive: true });
      }

      let data: unknown;

      switch (request.toolName) {
        case 'bash_exec':
          data = await this.bashExec(request.params, workspacePath);
          break;
        case 'read_file':
          data = await this.readFile(request.params, workspacePath, skillDirs);
          break;
        case 'write_file':
          data = await this.writeFile(request.params, workspacePath);
          break;
        case 'list_files':
          data = await this.listFiles(request.params, workspacePath, skillDirs);
          break;
        case 'read_file_binary':
          data = await this.readFileBinary(request.params, workspacePath, skillDirs);
          break;
        // v2.1.0 Skill 管理工具
        case 'search_skills':
          data = await this.searchSkills(request.params);
          break;
        case 'install_skill':
          data = await this.installSkill(request.params, request.botId);
          break;
        case 'uninstall_skill':
          data = await this.uninstallSkill(request.params, request.botId);
          break;
        case 'list_skills':
          data = await this.listSkillsTool(request.botId);
          break;
        case 'read_skill':
          data = await this.readSkill(request.params, request.botId);
          break;
        case 'execute_skill_script':
          data = await this.executeSkillScript(request.params, request.botId, workspacePath);
          break;
        default:
          throw new Error(`未知工具: ${request.toolName}`);
      }

      return {
        requestId: request.requestId,
        success: true,
        data,
      };
    } catch (err) {
      return {
        requestId: request.requestId,
        success: false,
        error: (err as Error).message,
      };
    }
  }

  // ========================
  // 文件/命令工具（原有）
  // ========================

  /**
   * 执行 Shell 命令
   */
  private async bashExec(
    params: Record<string, unknown>,
    workspacePath: string,
  ): Promise<string> {
    const command = params.command as string;
    if (!command) {
      throw new Error('bash_exec 缺少 command 参数');
    }

    const timeout = (params.timeout as number) || DEFAULT_TIMEOUT;

    return new Promise<string>((resolve, reject) => {
      exec(
        command,
        {
          cwd: workspacePath,
          timeout,
          maxBuffer: 1024 * 1024, // 1MB
          env: { ...process.env, HOME: workspacePath },
        },
        (error, stdout, stderr) => {
          if (error) {
            // 命令执行失败但有输出时，返回输出内容
            if (stdout || stderr) {
              resolve(`${stdout}${stderr ? '\n[stderr]: ' + stderr : ''}`);
            } else {
              reject(new Error(`命令执行失败: ${error.message}`));
            }
          } else {
            resolve(stdout + (stderr ? '\n[stderr]: ' + stderr : ''));
          }
        },
      );
    });
  }

  /**
   * 读取文件
   */
  private async readFile(
    params: Record<string, unknown>,
    workspacePath: string,
    skillDirs: string[],
  ): Promise<string> {
    const filePath = params.path as string;
    if (!filePath) {
      throw new Error('read_file 缺少 path 参数');
    }

    const resolvedPath = this.resolvePath(filePath, workspacePath);
    this.validatePath(resolvedPath, workspacePath, skillDirs);

    return fs.promises.readFile(resolvedPath, 'utf-8');
  }

  /**
   * 写入文件
   */
  private async writeFile(
    params: Record<string, unknown>,
    workspacePath: string,
  ): Promise<string> {
    const filePath = params.path as string;
    const content = params.content as string;

    if (!filePath) {
      throw new Error('write_file 缺少 path 参数');
    }
    if (content === undefined || content === null) {
      throw new Error('write_file 缺少 content 参数');
    }

    const resolvedPath = this.resolvePath(filePath, workspacePath);

    // 写入只允许工作区目录（不允许写入 Skill 目录）
    this.validatePathInDir(resolvedPath, workspacePath);

    // 确保父目录存在
    const parentDir = path.dirname(resolvedPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    await fs.promises.writeFile(resolvedPath, content, 'utf-8');
    return `文件已写入: ${filePath}`;
  }

  /**
   * 列出目录内容
   */
  private async listFiles(
    params: Record<string, unknown>,
    workspacePath: string,
    skillDirs: string[],
  ): Promise<string[]> {
    const dirPath = (params.path as string) || '.';
    const resolvedPath = this.resolvePath(dirPath, workspacePath);
    this.validatePath(resolvedPath, workspacePath, skillDirs);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`目录不存在: ${dirPath}`);
    }

    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isDirectory()) {
      throw new Error(`不是目录: ${dirPath}`);
    }

    const entries = await fs.promises.readdir(resolvedPath, { withFileTypes: true });
    return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  }

  /** 50MB 文件大小限制 */
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024;

  /**
   * 读取文件为 base64（支持目录自动打包 zip）
   */
  private async readFileBinary(
    params: Record<string, unknown>,
    workspacePath: string,
    skillDirs: string[],
  ): Promise<{ base64: string; fileName: string; fileSize: number; mimeType: string }> {
    const filePath = params.path as string;
    if (!filePath) {
      throw new Error('read_file_binary 缺少 path 参数');
    }

    const resolvedPath = this.resolvePath(filePath, workspacePath);
    this.validatePath(resolvedPath, workspacePath, skillDirs);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const stat = await fs.promises.stat(resolvedPath);

    if (stat.isDirectory()) {
      // 目录：打包为 zip
      return this.zipDirectoryToBase64(resolvedPath);
    }

    // 单文件
    if (stat.size > GenericToolExecutor.MAX_FILE_SIZE) {
      throw new Error(`文件过大（${Math.round(stat.size / 1024 / 1024)}MB），超出 50MB 限制`);
    }

    const buffer = await fs.promises.readFile(resolvedPath);
    const fileName = path.basename(resolvedPath);
    return {
      base64: buffer.toString('base64'),
      fileName,
      fileSize: stat.size,
      mimeType: this.detectMimeType(fileName),
    };
  }

  // ========================
  // v2.1.0 Skill 管理工具
  // ========================

  /**
   * 搜索在线 Skill
   */
  private async searchSkills(params: Record<string, unknown>): Promise<string> {
    if (!this.pluginSearchClient) {
      throw new Error('Skill 搜索服务未初始化');
    }

    const query = params.query as string;
    if (!query) throw new Error('search_skills 缺少 query 参数');

    const limit = (params.limit as number) || 10;
    const result = await this.pluginSearchClient.search(query, limit);

    if (result.skills.length === 0) {
      return `未找到匹配 "${query}" 的 Skill`;
    }

    const entries = result.skills.map((s, i) =>
      `${i + 1}. **${s.name}** (${s.namespace})\n   ${s.description}\n   安装: ${s.installs} | Stars: ${s.stars}\n   URL: ${s.metadata.rawFileUrl}`,
    ).join('\n\n');

    return `找到 ${result.total} 个 Skill（显示前 ${result.skills.length} 个）:\n\n${entries}`;
  }

  /**
   * 安装 Skill
   */
  private async installSkill(params: Record<string, unknown>, botId: string): Promise<string> {
    if (!this.botSkillManager) {
      throw new Error('Skill 管理服务未初始化');
    }

    const url = params.url as string | undefined;
    const localPath = params.localPath as string | undefined;

    if (!url && !localPath) {
      throw new Error('install_skill 需要 url 或 localPath 参数');
    }

    try {
      if (url) {
        // 从 URL 安装：构造 PluginEntry
        const entry = {
          id: '', name: '', namespace: '', description: '',
          sourceUrl: url, author: '', stars: 0, installs: 0,
          metadata: {
            repoOwner: '', repoName: '', directoryPath: '',
            rawFileUrl: url,
          },
        };
        const meta = await this.botSkillManager.installFromUrl(botId, entry);
        return JSON.stringify({
          success: true,
          message: `Skill "${meta.name}" 安装成功`,
          skill: meta,
          _action: 'push_skill_instructions',
        });
      } else {
        const meta = await this.botSkillManager.installFromLocal(botId, localPath!);
        return JSON.stringify({
          success: true,
          message: `Skill "${meta.name}" 从本地安装成功`,
          skill: meta,
          _action: 'push_skill_instructions',
        });
      }
    } catch (err: any) {
      // 回滚：安装失败时不需要特殊清理（installFromUrl/installFromLocal 内部已处理）
      throw new Error(`Skill 安装失败: ${err.message}`);
    }
  }

  /**
   * 卸载 Skill
   */
  private async uninstallSkill(params: Record<string, unknown>, botId: string): Promise<string> {
    if (!this.botSkillManager) {
      throw new Error('Skill 管理服务未初始化');
    }

    const name = params.name as string;
    if (!name) throw new Error('uninstall_skill 缺少 name 参数');

    const removed = await this.botSkillManager.uninstall(botId, name);
    if (!removed) {
      return `Skill "${name}" 不存在`;
    }

    return JSON.stringify({
      success: true,
      message: `Skill "${name}" 已卸载`,
      _action: 'push_skill_instructions',
    });
  }

  /**
   * 列出已安装 Skill
   */
  private async listSkillsTool(botId: string): Promise<string> {
    if (!this.botSkillManager) {
      throw new Error('Skill 管理服务未初始化');
    }

    const skills = await this.botSkillManager.listSkills(botId);
    if (skills.length === 0) {
      return '当前没有已安装的 Skill';
    }

    const list = skills.map((s, i) =>
      `${i + 1}. **${s.name}**: ${s.description || '(无描述)'}`,
    ).join('\n');

    return `已安装 ${skills.length} 个 Skill:\n\n${list}`;
  }

  /**
   * 读取 Skill 完整内容
   */
  private async readSkill(params: Record<string, unknown>, botId: string): Promise<string> {
    if (!this.botSkillManager) {
      throw new Error('Skill 管理服务未初始化');
    }

    const name = params.name as string;
    if (!name) throw new Error('read_skill 缺少 name 参数');

    const skill = await this.botSkillManager.getSkillContent(botId, name);
    if (!skill) {
      return `Skill "${name}" 不存在`;
    }

    return `# Skill: ${skill.name}\n\n${skill.instructions}`;
  }

  /**
   * 在沙箱中执行 Skill 脚本（v2.2.0）
   */
  private async executeSkillScript(
    params: Record<string, unknown>,
    botId: string,
    workspacePath: string,
  ): Promise<string> {
    if (!this.botSkillManager) {
      throw new Error('Skill 管理服务未初始化');
    }

    const skillName = params.skillName as string;
    const scriptPath = params.scriptPath as string;
    const args = (params.args as string[]) || [];
    const input = params.input as string | undefined;

    if (!skillName) throw new Error('execute_skill_script 缺少 skillName 参数');
    if (!scriptPath) throw new Error('execute_skill_script 缺少 scriptPath 参数');

    // 验证 Skill 存在
    const skill = await this.botSkillManager.getSkillContent(botId, skillName);
    if (!skill || !skill.dirPath) {
      throw new Error(`Skill "${skillName}" 不存在`);
    }

    // 验证脚本路径在 scripts/ 目录内
    const scriptsDir = path.join(skill.dirPath, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      throw new Error(`Skill "${skillName}" 没有 scripts/ 目录`);
    }

    const fullScriptPath = path.resolve(scriptsDir, scriptPath);
    // 安全检查：确保路径在 scripts/ 内
    if (!fullScriptPath.startsWith(path.resolve(scriptsDir) + path.sep)) {
      throw new Error('脚本路径越界：必须在 scripts/ 目录内');
    }
    if (!fs.existsSync(fullScriptPath)) {
      throw new Error(`脚本不存在: ${scriptPath}`);
    }

    const result = await this.sandboxExecutor.execute(
      fullScriptPath, args, input, undefined, workspacePath,
    );

    return JSON.stringify({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  // ========================
  // 辅助方法
  // ========================

  /**
   * 将目录打包为 zip 并返回 base64
   */
  private zipDirectoryToBase64(
    dirPath: string,
  ): Promise<{ base64: string; fileName: string; fileSize: number; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 6 } });

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('error', (err: Error) => reject(err));
      archive.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length > GenericToolExecutor.MAX_FILE_SIZE) {
          reject(new Error(`压缩后文件过大（${Math.round(buffer.length / 1024 / 1024)}MB），超出 50MB 限制`));
          return;
        }
        const dirName = path.basename(dirPath);
        resolve({
          base64: buffer.toString('base64'),
          fileName: `${dirName}.zip`,
          fileSize: buffer.length,
          mimeType: 'application/zip',
        });
      });

      archive.directory(dirPath, path.basename(dirPath));
      archive.finalize();
    });
  }

  /**
   * 根据文件扩展名推断 MIME 类型
   */
  private detectMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.csv': 'text/csv',
      '.xml': 'application/xml',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.wav': 'audio/wav',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  /**
   * 解析相对路径为绝对路径
   */
  private resolvePath(filePath: string, workspacePath: string): string {
    if (path.isAbsolute(filePath)) {
      return path.resolve(filePath);
    }
    return path.resolve(workspacePath, filePath);
  }

  /**
   * 校验路径是否在允许的目录内（workspace 或 skill 目录）
   */
  private validatePath(
    resolvedPath: string,
    workspacePath: string,
    skillDirs: string[],
  ): void {
    const normalizedPath = path.resolve(resolvedPath);
    const normalizedWorkspace = path.resolve(workspacePath);

    // 允许工作区
    if (normalizedPath.startsWith(normalizedWorkspace + path.sep) || normalizedPath === normalizedWorkspace) {
      return;
    }

    // 允许 Skill 目录
    for (const skillDir of skillDirs) {
      const normalizedSkillDir = path.resolve(skillDir);
      if (normalizedPath.startsWith(normalizedSkillDir + path.sep) || normalizedPath === normalizedSkillDir) {
        return;
      }
    }

    throw new Error(`访问被拒绝: 路径不在允许的目录范围内 (${resolvedPath})`);
  }

  /**
   * 校验路径是否在指定目录内
   */
  private validatePathInDir(resolvedPath: string, dir: string): void {
    const normalizedPath = path.resolve(resolvedPath);
    const normalizedDir = path.resolve(dir);

    if (!normalizedPath.startsWith(normalizedDir + path.sep) && normalizedPath !== normalizedDir) {
      throw new Error(`写入被拒绝: 路径不在工作区范围内 (${resolvedPath})`);
    }
  }
}
