/**
 * Skill 元数据注册表
 *
 * 服务端内存中维护所有已注册 Skill 的定义，
 * 提供查询和生成 LLM tools 数组的能力。
 * 支持动态注册/注销、启用/禁用（Redis 持久化）。
 */
import type { SkillDefinition, SkillAction, LLMTool } from '@chat/shared';
import { getRedisClient } from '../../repositories/redis/RedisClient';

/** Redis 键：Skill 启用状态 Hash */
const SKILL_ENABLED_KEY = 'skill_enabled';

/** generateTools 过滤选项 */
export interface GenerateToolsOptions {
  /** 按平台过滤 */
  platform?: string;
  /** 仅包含指定函数名（白名单） */
  allowedFunctions?: string[];
}

export class SkillRegistry {
  /** Skill 名称 → 定义 */
  private skills = new Map<string, SkillDefinition>();
  /** 函数名 → { skill, action } 快速索引 */
  private actionIndex = new Map<string, { skill: SkillDefinition; action: SkillAction }>();

  /** 注册一个 Skill（自动填充 source 默认值） */
  register(skill: SkillDefinition): void {
    const enriched: SkillDefinition = { ...skill, source: skill.source || 'builtin' };
    this.skills.set(enriched.name, enriched);
    for (const action of enriched.actions) {
      this.actionIndex.set(action.functionName, { skill: enriched, action });
    }
  }

  /** 注销一个 Skill（仅允许 custom 来源） */
  unregister(name: string): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;
    if (skill.source === 'builtin') return false;
    for (const action of skill.actions) {
      this.actionIndex.delete(action.functionName);
    }
    this.skills.delete(name);
    return true;
  }

  /** 获取所有已注册 Skill */
  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /** 根据名称获取 Skill */
  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /** 根据函数名查找对应的 Skill 和 Action */
  findAction(functionName: string): { skill: SkillDefinition; action: SkillAction } | null {
    return this.actionIndex.get(functionName) ?? null;
  }

  /**
   * 设置 Skill 启用/禁用状态（持久化到 Redis）
   */
  async setEnabled(name: string, enabled: boolean): Promise<boolean> {
    const skill = this.skills.get(name);
    if (!skill) return false;
    skill.enabled = enabled;
    const redis = getRedisClient();
    await redis.hset(SKILL_ENABLED_KEY, name, enabled ? '1' : '0');
    return true;
  }

  /**
   * 从 Redis 加载所有 Skill 的启用状态
   * 启动时及 skill:sync 后调用
   */
  async loadEnabledStates(): Promise<void> {
    const redis = getRedisClient();
    const states = await redis.hgetall(SKILL_ENABLED_KEY);
    for (const [name, val] of Object.entries(states)) {
      const skill = this.skills.get(name);
      if (skill) {
        skill.enabled = val === '1';
      }
    }
  }

  /**
   * 生成 LLM tools 数组（OpenAI function calling 格式）
   * 支持按平台和白名单过滤，自动排除已禁用的 Skill
   */
  generateTools(options?: GenerateToolsOptions): LLMTool[] {
    const tools: LLMTool[] = [];

    for (const skill of this.skills.values()) {
      // 过滤已禁用的 Skill（enabled 为 undefined 时视为启用）
      if (skill.enabled === false) continue;

      // 按平台过滤
      if (options?.platform && skill.platform !== 'all' && skill.platform !== options.platform) {
        continue;
      }

      for (const action of skill.actions) {
        // 按白名单过滤
        if (options?.allowedFunctions && !options.allowedFunctions.includes(action.functionName)) {
          continue;
        }

        tools.push({
          type: 'function',
          function: {
            name: action.functionName,
            description: action.description,
            parameters: action.parameters,
          },
        });
      }
    }

    return tools;
  }
}
