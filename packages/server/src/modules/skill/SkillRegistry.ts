/**
 * Skill 元数据注册表
 *
 * 服务端内存中维护所有已注册 Skill 的定义，
 * 提供查询和生成 LLM tools 数组的能力。
 */
import type { SkillDefinition, SkillAction, LLMTool } from '@chat/shared';

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

  /** 注册一个 Skill */
  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
    // 更新函数名索引
    for (const action of skill.actions) {
      this.actionIndex.set(action.functionName, { skill, action });
    }
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
   * 生成 LLM tools 数组（OpenAI function calling 格式）
   * 支持按平台和白名单过滤
   */
  generateTools(options?: GenerateToolsOptions): LLMTool[] {
    const tools: LLMTool[] = [];

    for (const skill of this.skills.values()) {
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
