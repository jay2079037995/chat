/**
 * 沙箱脚本执行器（v2.2.0）
 *
 * 在受限环境中执行 Skill 脚本。
 * 过滤敏感环境变量，限制输出大小，强制超时。
 */
import { exec } from 'child_process';
import * as path from 'path';

/** 沙箱执行结果 */
export interface SandboxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** 默认超时（60 秒） */
const DEFAULT_TIMEOUT = 60000;

/** stdout 最大字符数 */
const MAX_STDOUT = 10000;

/** stderr 最大字符数 */
const MAX_STDERR = 2000;

/** 敏感环境变量关键词（阻止传入） */
const SENSITIVE_ENV_PATTERNS = [
  'secret', 'token', 'password', 'key', 'credential', 'auth',
  'private', 'apikey', 'api_key',
];

/**
 * 过滤敏感环境变量
 */
function filterEnv(env: Record<string, string | undefined>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_ENV_PATTERNS.some(p => lowerKey.includes(p));
    if (!isSensitive) {
      filtered[key] = value;
    }
  }
  return filtered;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `\n... (truncated, total ${str.length} chars)`;
}

export class SandboxExecutor {
  /**
   * 执行脚本
   */
  async execute(
    scriptPath: string,
    args: string[] = [],
    input?: string,
    env?: Record<string, string>,
    workspacePath?: string,
    timeout: number = DEFAULT_TIMEOUT,
  ): Promise<SandboxExecResult> {
    const safeEnv = {
      ...filterEnv(process.env as Record<string, string | undefined>),
      ...(env ? filterEnv(env) : {}),
    };

    const ext = path.extname(scriptPath).toLowerCase();
    const quotedArgs = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');
    let command: string;

    if (ext === '.sh' || ext === '') {
      command = `bash "${scriptPath}" ${quotedArgs}`;
    } else if (ext === '.py') {
      command = `python3 "${scriptPath}" ${quotedArgs}`;
    } else if (ext === '.js' || ext === '.mjs') {
      command = `node "${scriptPath}" ${quotedArgs}`;
    } else if (ext === '.ts') {
      command = `npx tsx "${scriptPath}" ${quotedArgs}`;
    } else {
      command = `"${scriptPath}" ${quotedArgs}`;
    }

    return new Promise((resolve) => {
      const child = exec(
        command,
        {
          cwd: workspacePath || process.cwd(),
          timeout,
          maxBuffer: 1024 * 1024,
          env: { ...safeEnv, HOME: workspacePath || process.env.HOME || '' },
        },
        (error, stdout, stderr) => {
          if (error && !stdout && !stderr) {
            resolve({
              stdout: '',
              stderr: truncate(error.message, MAX_STDERR),
              exitCode: (error as any).code || 1,
            });
          } else {
            resolve({
              stdout: truncate(stdout || '', MAX_STDOUT),
              stderr: truncate(stderr || '', MAX_STDERR),
              exitCode: error ? (error as any).code || 1 : 0,
            });
          }
        },
      );

      if (input && child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }
    });
  }
}
