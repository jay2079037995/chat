/**
 * 通用工具执行器
 *
 * 在 Bot 的 workspace 沙箱中执行通用工具。
 * 支持 5 种工具：bash_exec、read_file、write_file、list_files、read_file_binary。
 * 所有文件操作限制在 workspace 和 skill 目录范围内（安全沙箱）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import archiver from 'archiver';
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
        case 'read_file_binary':
          data = await this.readFileBinary(request.params, workspacePath, skillDirs);
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
