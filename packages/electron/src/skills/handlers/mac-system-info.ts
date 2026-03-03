/**
 * Mac 系统信息 Skill 执行器
 */
import { exec } from './utils';
import * as os from 'os';

export async function mac_system_info_cpu(): Promise<unknown> {
  const model = os.cpus()[0]?.model || 'Unknown';
  const cores = os.cpus().length;
  const usage = await exec(`top -l 1 -n 0 | grep "CPU usage"`);
  return { model, cores, usage: usage.trim() };
}

export async function mac_system_info_memory(): Promise<unknown> {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  return {
    total: `${(totalBytes / 1024 / 1024 / 1024).toFixed(1)} GB`,
    free: `${(freeBytes / 1024 / 1024 / 1024).toFixed(1)} GB`,
    used: `${((totalBytes - freeBytes) / 1024 / 1024 / 1024).toFixed(1)} GB`,
    usagePercent: `${(((totalBytes - freeBytes) / totalBytes) * 100).toFixed(1)}%`,
  };
}

export async function mac_system_info_disk(): Promise<unknown> {
  const output = await exec(`df -h / | tail -1`);
  const parts = output.trim().split(/\s+/);
  return {
    filesystem: parts[0],
    total: parts[1],
    used: parts[2],
    available: parts[3],
    usagePercent: parts[4],
  };
}

export async function mac_system_info_network(): Promise<unknown> {
  const interfaces = os.networkInterfaces();
  const result: Record<string, unknown[]> = {};
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (addrs) {
      result[name] = addrs.map((a) => ({
        address: a.address,
        family: a.family,
        internal: a.internal,
      }));
    }
  }
  return { interfaces: result };
}
