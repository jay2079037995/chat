/**
 * 通用工具执行器
 *
 * 在 Bot 的 workspace 沙箱中执行通用工具。
 * 支持 4 种工具：bash_exec、read_file、write_file、list_files。
 * 所有文件操作限制在 workspace 和 skill 目录范围内（安全沙箱）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import type { GenericToolExecRequest, GenericToolExecResult } from '../../../shared/dist';

/** 默认命令超时时间（毫秒） */
const DEFAULT_TIMEOUT = 30000;

export class GenericToolExecutor {
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
