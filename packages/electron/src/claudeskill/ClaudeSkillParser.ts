/**
 * Claude Skill SKILL.md 解析器
 *
 * 解析符合 Claude Agent Skills 标准的 SKILL.md 文件。
 * SKILL.md 由 YAML frontmatter（--- 分隔）和 Markdown 指令正文组成。
 *
 * 格式示例：
 * ```
 * ---
 * name: my-skill
 * description: 描述 Skill 的用途
 * version: 1.0.0
 * author: someone
 * tags: [tag1, tag2]
 * ---
 *
 * # Skill 指令正文
 * AI 读取这段内容来了解如何执行 Skill...
 * ```
 */
import yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import type { ClaudeSkill } from '../../../shared/dist';

/** SKILL.md frontmatter 结构 */
interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  'allowed-tools'?: string[];
}

/**
 * 解析 SKILL.md 文件原始文本
 *
 * @param raw SKILL.md 原始文本内容
 * @returns ClaudeSkill 对象
 * @throws 格式不合法或缺少必要字段时抛出错误
 */
export function parseSkillMdContent(raw: string): ClaudeSkill {
  const trimmed = raw.trim();

  // 无内容或无 frontmatter 时返回默认值
  if (!trimmed || !trimmed.startsWith('---')) {
    return {
      name: 'unknown',
      description: '',
      instructions: trimmed,
    };
  }

  // 查找第二个 ---
  const secondDelimiter = trimmed.indexOf('---', 3);
  if (secondDelimiter === -1) {
    throw new Error('SKILL.md frontmatter 未闭合（缺少第二个 ---）');
  }

  const yamlStr = trimmed.substring(3, secondDelimiter).trim();
  const instructions = trimmed.substring(secondDelimiter + 3).trim();

  // 解析 YAML
  let frontmatter: SkillFrontmatter;
  try {
    frontmatter = yaml.load(yamlStr) as SkillFrontmatter;
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

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    version: frontmatter.version,
    author: frontmatter.author,
    tags: frontmatter.tags,
    instructions,
  };
}

/**
 * 从目录路径解析 SKILL.md 文件
 *
 * @param dirPath Skill 目录路径（需包含 SKILL.md）
 * @returns ClaudeSkill 对象（含目录信息）
 */
export async function parseSkillDir(dirPath: string): Promise<ClaudeSkill> {
  const skillMdPath = path.join(dirPath, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`未找到 SKILL.md 文件: ${skillMdPath}`);
  }

  const raw = await fs.promises.readFile(skillMdPath, 'utf-8');
  const skill = parseSkillMdContent(raw);

  // 检查子目录
  skill.dirPath = dirPath;
  skill.hasScripts = fs.existsSync(path.join(dirPath, 'scripts'));
  skill.hasReferences = fs.existsSync(path.join(dirPath, 'references'));

  return skill;
}
