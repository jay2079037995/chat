/**
 * LLM Tool Calling 共享类型定义
 *
 * 保留 LLM function calling 所需的工具定义和调用类型。
 * Skill 相关类型已迁移至 claude-skill.ts。
 */

/** JSON Schema 参数定义（OpenAI function calling 格式） */
export interface SkillParameterSchema {
  /** JSON Schema 类型 */
  type: 'object';
  /** 参数属性定义 */
  properties: Record<string, {
    /** 参数类型 */
    type: string;
    /** 参数描述 */
    description: string;
    /** 枚举值（可选） */
    enum?: string[];
    /** 默认值（可选） */
    default?: unknown;
  }>;
  /** 必填参数列表 */
  required?: string[];
}

/** OpenAI function calling 格式的工具定义 */
export interface LLMTool {
  /** 工具类型（固定为 function） */
  type: 'function';
  /** 函数定义 */
  function: {
    /** 函数名 */
    name: string;
    /** 函数描述 */
    description: string;
    /** 参数 JSON Schema */
    parameters: SkillParameterSchema;
  };
}

/** LLM 返回的 tool_call */
export interface LLMToolCall {
  /** tool call ID（LLM 生成） */
  id: string;
  /** 类型（固定为 function） */
  type: 'function';
  /** 函数调用信息 */
  function: {
    /** 函数名 */
    name: string;
    /** JSON 字符串形式的参数 */
    arguments: string;
  };
}
