/**
 * Mac Shell 命令 Skill 执行器
 *
 * ⚠️ 危险操作：每次执行必须经过权限确认。
 */
import { exec } from './utils';
import * as os from 'os';

export async function mac_shell_exec(params: Record<string, unknown>): Promise<unknown> {
  const command = params.command as string;
  const cwd = (params.cwd as string) || os.homedir();
  const timeout = (params.timeout as number) || 30000;

  const output = await exec(command, { cwd, timeout });
  return { stdout: output.trim() };
}
