/**
 * Mac 文件管理 Skill 执行器
 */
import { exec } from './utils';
import * as os from 'os';

export async function mac_finder_search(params: Record<string, unknown>): Promise<unknown> {
  const query = params.query as string;
  const directory = (params.directory as string) || os.homedir();
  const limit = (params.limit as number) || 20;

  const output = await exec(`mdfind -onlyin "${directory}" "kMDItemFSName == '*${query}*'" | head -${limit}`);
  return { files: output.trim().split('\n').filter(Boolean) };
}

export async function mac_finder_open(params: Record<string, unknown>): Promise<unknown> {
  const path = params.path as string;
  await exec(`open "${path}"`);
  return { opened: true, path };
}

export async function mac_finder_move(params: Record<string, unknown>): Promise<unknown> {
  const source = params.source as string;
  const destination = params.destination as string;
  await exec(`mv "${source}" "${destination}"`);
  return { moved: true, from: source, to: destination };
}

export async function mac_finder_copy(params: Record<string, unknown>): Promise<unknown> {
  const source = params.source as string;
  const destination = params.destination as string;
  await exec(`cp -R "${source}" "${destination}"`);
  return { copied: true, from: source, to: destination };
}

export async function mac_finder_compress(params: Record<string, unknown>): Promise<unknown> {
  const path = params.path as string;
  const outputPath = (params.outputPath as string) || `${path}.zip`;
  await exec(`zip -r "${outputPath}" "${path}"`);
  return { compressed: true, output: outputPath };
}

export async function mac_finder_info(params: Record<string, unknown>): Promise<unknown> {
  const path = params.path as string;
  const output = await exec(`stat -f '%z %m %Sp %N' "${path}" && file "${path}"`);
  const lines = output.trim().split('\n');
  const [stat, fileType] = lines;
  const parts = stat.split(' ');
  return {
    size: parseInt(parts[0], 10),
    modifiedAt: parseInt(parts[1], 10) * 1000,
    permissions: parts[2],
    type: fileType,
  };
}
