/**
 * SKILL.md 解析器
 *
 * 解析符合 Agent Skills Open Standard 的 SKILL.md 文件。
 * SKILL.md 由 YAML frontmatter（--- 分隔）和 Markdown 正文组成。
 *
 * 格式示例：
 * ```
 * ---
 * name: mac-notes
 * description: 读取、创建、更新、删除和搜索 macOS 备忘录
 * version: 1.0.0
 * license: Apache-2.0
 * compatibility:
 *   platforms: [mac]
 *   permissions: [read, write]
 * metadata:
 *   author: chat-app
 *   tags: [mac, notes, productivity]
 *   actions:
 *     - functionName: mac_notes_list
 *       description: 列出所有备忘录
 *       parameters: { type: object, properties: {} }
 * ---
 *
 * # Mac 备忘录 Skill
 * Markdown 正文...
 * ```
 */
import yaml from 'js-yaml';

/** SKILL.md frontmatter 中 compatibility 部分 */
interface SkillCompatibility {
  platforms?: string[];
  permissions?: string[];
}

/** SKILL.md frontmatter 中 action 定义 */
interface SkillMdAction {
  functionName: string;
  description: string;
  parameters: Record<string, unknown>;
  permission?: string;
}

/** SKILL.md frontmatter 中 metadata 部分 */
interface SkillMdMetadata {
  author?: string;
  tags?: string[];
  actions?: SkillMdAction[];
}

/** SKILL.md 完整 frontmatter 结构 */
export interface SkillMdFrontmatter {
  name: string;
  description: string;
  version?: string;
  license?: string;
  compatibility?: SkillCompatibility;
  'allowed-tools'?: string[];
  metadata?: SkillMdMetadata;
  /** 显示名称（扩展字段） */
  displayName?: string;
}

/** 解析结果 */
export interface SkillMdParseResult {
  /** 解析后的 frontmatter */
  frontmatter: SkillMdFrontmatter;
  /** Markdown 正文内容 */
  content: string;
}

/**
 * 解析 SKILL.md 文件内容
 *
 * @param raw SKILL.md 的原始文本内容
 * @returns 解析后的 frontmatter 和 Markdown 正文
 * @throws 格式不合法或缺少必要字段时抛出错误
 */
export function parseSkillMd(raw: string): SkillMdParseResult {
  const trimmed = raw.trim();

  // 检查是否以 --- 开头
  if (!trimmed.startsWith('---')) {
    throw new Error('SKILL.md 缺少 YAML frontmatter（必须以 --- 开头）');
  }

  // 查找第二个 ---
  const secondDelimiter = trimmed.indexOf('---', 3);
  if (secondDelimiter === -1) {
    throw new Error('SKILL.md frontmatter 未闭合（缺少第二个 ---）');
  }

  const yamlStr = trimmed.substring(3, secondDelimiter).trim();
  const content = trimmed.substring(secondDelimiter + 3).trim();

  // 解析 YAML
  let frontmatter: SkillMdFrontmatter;
  try {
    frontmatter = yaml.load(yamlStr) as SkillMdFrontmatter;
  } catch (err) {
    throw new Error(`SKILL.md YAML 解析失败: ${(err as Error).message}`);
  }

  if (!frontmatter || typeof frontmatter !== 'object') {
    throw new Error('SKILL.md frontmatter 为空或格式无效');
  }

  // 校验必填字段
  if (!frontmatter.name) {
    throw new Error('SKILL.md 缺少必填字段: name');
  }
  if (!frontmatter.description) {
    throw new Error('SKILL.md 缺少必填字段: description');
  }

  return { frontmatter, content };
}

/** Skill 平台类型 */
type SkillPlatform = 'mac' | 'windows' | 'linux' | 'all';
/** Skill 权限类型 */
type SkillPermission = 'read' | 'write' | 'execute' | 'dangerous';

/** SkillDefinition 本地类型（与 @chat/shared 一致） */
export interface SkillDefinition {
  name: string;
  displayName: string;
  description: string;
  version: string;
  platform: SkillPlatform;
  permission: SkillPermission;
  actions: Array<{
    functionName: string;
    description: string;
    parameters: Record<string, unknown>;
    permission?: SkillPermission;
  }>;
  source?: 'builtin' | 'custom';
  enabled?: boolean;
  license?: string;
  author?: string;
  tags?: string[];
  instructions?: string;
}

/**
 * 将 SKILL.md 解析结果转换为 SkillDefinition
 */
export function toSkillDefinition(
  parsed: SkillMdParseResult,
  source: 'builtin' | 'custom' = 'custom',
): SkillDefinition {
  const { frontmatter, content } = parsed;

  // 从 compatibility 中提取 platform 和 permission
  const platforms = frontmatter.compatibility?.platforms || ['all'];
  const permissions = frontmatter.compatibility?.permissions || ['read'];

  // 取第一个 platform 作为主平台
  const platform = (platforms[0] || 'all') as SkillPlatform;
  // 取最高权限作为默认权限
  const permOrder: SkillPermission[] = ['read', 'write', 'execute', 'dangerous'];
  const maxPerm = permissions.reduce((max, p) => {
    const mi = permOrder.indexOf(max as SkillPermission);
    const pi = permOrder.indexOf(p as SkillPermission);
    return pi > mi ? p : max;
  }, 'read') as SkillPermission;

  // 从 metadata 中提取 actions
  const actions = (frontmatter.metadata?.actions || []).map((a) => ({
    functionName: a.functionName,
    description: a.description,
    parameters: a.parameters,
    permission: a.permission as SkillPermission | undefined,
  }));

  // displayName 优先用 frontmatter 中的，否则从 name 生成
  const displayName = frontmatter.displayName || frontmatter.name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    name: frontmatter.name,
    displayName,
    description: frontmatter.description,
    version: frontmatter.version || '1.0.0',
    platform,
    permission: maxPerm,
    actions,
    source,
    license: frontmatter.license,
    author: frontmatter.metadata?.author,
    tags: frontmatter.metadata?.tags,
    instructions: content || undefined,
  };
}
