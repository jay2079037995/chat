/**
 * Skill handler 工具函数
 *
 * 提供 AppleScript / Shell 命令执行的通用封装。
 */
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** 执行 Shell 命令并返回 stdout */
export async function exec(command: string, options?: { cwd?: string; timeout?: number }): Promise<string> {
  const { stdout } = await execFileAsync('/bin/sh', ['-c', command], {
    timeout: options?.timeout || 30000,
    cwd: options?.cwd,
    maxBuffer: 1024 * 1024, // 1MB
  });
  return stdout;
}

/** 执行 AppleScript 并返回结果 */
export async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-e', script], {
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}
