/**
 * Skill 市场管理器（SKILL.md 标准）
 *
 * 管理在线 Skill 注册表（registry）：
 *   - 存储/编辑注册表 URL 列表
 *   - 拉取注册表索引（带 5 分钟缓存）
 *   - 从 Git 仓库克隆安装 Skill
 *   - 下载 Skill zip 包 → 解压 → 验证 → 安装
 */
import { net } from 'electron';
import Store from 'electron-store';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import extractZip from 'extract-zip';
import type { SkillPackageManager } from './SkillPackageManager';

/** 注册表条目（与 @chat/shared SkillRegistryEntry 一致） */
interface SkillRegistryEntry {
  name: string;
  displayName: string;
  description: string;
  platform: string;
  version: string;
  author: string;
  license?: string;
  tags?: string[];
  repoUrl?: string;
  downloadUrl?: string;
  size?: number;
}

/** 注册表索引（与 @chat/shared SkillRegistryIndex 一致） */
interface SkillRegistryIndex {
  name?: string;
  updatedAt?: string;
  skills: SkillRegistryEntry[];
}

/** 缓存条目 */
interface CacheEntry {
  data: SkillRegistryIndex;
  fetchedAt: number;
}

/** 缓存有效期（5 分钟） */
const CACHE_TTL = 5 * 60 * 1000;

/** 默认注册表 URL 列表 */
const DEFAULT_REGISTRIES = [
  'https://raw.githubusercontent.com/jay2079037995/chat-skills/main/registry.json',
];

export class SkillMarketplace {
  private store: Store;
  private cache = new Map<string, CacheEntry>();

  constructor(private packageManager: SkillPackageManager) {
    this.store = new Store({ name: 'skill-marketplace' });
    // 初始化默认注册表
    if (!this.store.has('registries')) {
      this.store.set('registries', DEFAULT_REGISTRIES);
    }
  }

  /** 获取注册表 URL 列表 */
  getRegistries(): string[] {
    return (this.store.get('registries') as string[]) || DEFAULT_REGISTRIES;
  }

  /** 设置注册表 URL 列表 */
  setRegistries(urls: string[]): void {
    this.store.set('registries', urls);
    this.cache.clear();
  }

  /** 添加注册表 URL */
  addRegistry(url: string): void {
    const registries = this.getRegistries();
    if (!registries.includes(url)) {
      registries.push(url);
      this.store.set('registries', registries);
    }
  }

  /** 移除注册表 URL */
  removeRegistry(url: string): void {
    const registries = this.getRegistries().filter((r) => r !== url);
    this.store.set('registries', registries);
    this.cache.delete(url);
  }

  /** 拉取所有注册表的 Skill 列表（带缓存） */
  async fetchAllSkills(): Promise<SkillRegistryEntry[]> {
    const registries = this.getRegistries();
    const allSkills: SkillRegistryEntry[] = [];
    const seen = new Set<string>();

    const results = await Promise.allSettled(
      registries.map((url) => this.fetchRegistry(url)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const skill of result.value.skills) {
          if (!seen.has(skill.name)) {
            seen.add(skill.name);
            allSkills.push(skill);
          }
        }
      }
    }

    return allSkills;
  }

  /**
   * 从 Git 仓库安装 Skill
   *
   * 支持格式：
   *   - https://github.com/user/repo.git
   *   - https://github.com/user/repo
   *   - git@github.com:user/repo.git
   *   - https://github.com/user/repo/tree/main/skills/my-skill（子目录）
   *
   * @param gitUrl Git 仓库 URL
   * @param subDir 可选的子目录路径（当 SKILL.md 不在仓库根目录时）
   */
  async installFromGit(gitUrl: string, subDir?: string): Promise<unknown> {
    const tmpDir = path.join(os.tmpdir(), `skill-git-${Date.now()}`);

    try {
      // 解析 GitHub URL 中的子目录
      const parsed = this.parseGitUrl(gitUrl);
      const cloneUrl = parsed.cloneUrl;
      const effectiveSubDir = subDir || parsed.subDir;

      // 克隆仓库
      fs.mkdirSync(tmpDir, { recursive: true });
      execSync(`git clone --depth 1 ${cloneUrl} "${tmpDir}/repo"`, {
        timeout: 60000,
        stdio: 'pipe',
      });

      // 确定安装源目录
      let installDir = path.join(tmpDir, 'repo');
      if (effectiveSubDir) {
        installDir = path.join(installDir, effectiveSubDir);
      }

      // 查找 SKILL.md
      const skillMdDir = this.findSkillMdDir(installDir);
      if (!skillMdDir) {
        throw new Error('仓库中找不到 SKILL.md 文件');
      }

      return this.packageManager.install(skillMdDir);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
  }

  /** 下载并安装 Skill 包（zip 格式） */
  async downloadAndInstall(entry: SkillRegistryEntry): Promise<unknown> {
    // 优先使用 Git 安装
    if (entry.repoUrl) {
      return this.installFromGit(entry.repoUrl);
    }

    if (!entry.downloadUrl) {
      throw new Error('注册表条目缺少 repoUrl 和 downloadUrl');
    }

    const tmpDir = path.join(os.tmpdir(), `skill-download-${Date.now()}`);
    const zipPath = path.join(tmpDir, `${entry.name}.zip`);
    const extractDir = path.join(tmpDir, 'extracted');

    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.mkdirSync(extractDir, { recursive: true });

      // 下载 zip
      await this.downloadFile(entry.downloadUrl, zipPath);

      // 解压
      await extractZip(zipPath, { dir: extractDir });

      // 查找 SKILL.md
      const installDir = this.findSkillMdDir(extractDir);
      if (!installDir) {
        throw new Error('下载的包中找不到 SKILL.md');
      }

      return this.packageManager.install(installDir);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
  }

  /**
   * 解析 Git URL，提取克隆地址和子目录
   *
   * 支持 GitHub /tree/branch/path 格式的子目录提取
   */
  private parseGitUrl(url: string): { cloneUrl: string; subDir?: string } {
    // 处理 GitHub tree URL: https://github.com/user/repo/tree/branch/path/to/skill
    const treeMatch = url.match(
      /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/tree\/[^/]+\/(.+)$/,
    );
    if (treeMatch) {
      return {
        cloneUrl: treeMatch[1] + '.git',
        subDir: treeMatch[2],
      };
    }

    // 普通 URL，确保有 .git 后缀
    let cloneUrl = url.trim();
    if (cloneUrl.startsWith('https://') && !cloneUrl.endsWith('.git')) {
      cloneUrl += '.git';
    }

    return { cloneUrl };
  }

  /** 查找包含 SKILL.md 的目录 */
  private findSkillMdDir(dir: string): string | null {
    if (fs.existsSync(path.join(dir, 'SKILL.md'))) {
      return dir;
    }
    // 检查一级子目录
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(dir, entry.name);
        if (fs.existsSync(path.join(subDir, 'SKILL.md'))) {
          return subDir;
        }
      }
    }
    return null;
  }

  /** 拉取单个注册表（带缓存） */
  private async fetchRegistry(url: string): Promise<SkillRegistryIndex> {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached.data;
    }

    const data = await this.httpGet(url);
    const index: SkillRegistryIndex = JSON.parse(data);

    if (!index.skills || !Array.isArray(index.skills)) {
      throw new Error(`无效的注册表格式: ${url}`);
    }

    this.cache.set(url, { data: index, fetchedAt: Date.now() });
    return index;
  }

  /** HTTP GET 请求 */
  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      let data = '';
      request.on('response', (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}: ${url}`));
          return;
        }
        response.on('data', (chunk) => { data += chunk.toString(); });
        response.on('end', () => resolve(data));
        response.on('error', reject);
      });
      request.on('error', reject);
      request.end();
    });
  }

  /** 下载文件到本地路径 */
  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      const file = fs.createWriteStream(destPath);
      request.on('response', (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          file.close();
          reject(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }
        response.on('data', (chunk) => { file.write(chunk); });
        response.on('end', () => {
          file.end(() => resolve());
        });
        response.on('error', (err) => {
          file.close();
          reject(err);
        });
      });
      request.on('error', (err) => {
        file.close();
        reject(err);
      });
      request.end();
    });
  }
}
