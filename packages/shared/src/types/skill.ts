/**
 * Skill 系统共享类型定义
 *
 * 基于 Claude Plugins / Agent Skills Open Standard（SKILL.md 标准）。
 * Skill 是 Bot 通过 LLM function calling 远程调用 Electron 桌面端
 * 本地能力（备忘录、日历、文件操作等）的标准化接口。
 */

/** Skill 权限级别 */
export type SkillPermission = 'read' | 'write' | 'execute' | 'dangerous';

/** Skill 支持的平台 */
export type SkillPlatform = 'mac' | 'windows' | 'linux' | 'all';

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

/** Skill 中的单个操作（对应 LLM 的一个 function） */
export interface SkillAction {
  /** 函数名（全局唯一，格式：skill名_action名，如 mac_notes_list） */
  functionName: string;
  /** 操作描述（LLM 可见） */
  description: string;
  /** 参数定义 */
  parameters: SkillParameterSchema;
  /** 操作级权限覆盖（可选，默认继承 Skill 级权限） */
  permission?: SkillPermission;
}

/** Skill 来源类型 */
export type SkillSource = 'builtin' | 'custom';

/**
 * Skill 元数据定义（兼容 SKILL.md 标准）
 *
 * 对应 SKILL.md YAML frontmatter 的结构化表示。
 */
export interface SkillDefinition {
  /** Skill 名称（唯一标识，如 mac-notes） */
  name: string;
  /** Skill 显示名称 */
  displayName: string;
  /** Skill 描述（Claude 用于判断何时调用） */
  description: string;
  /** 版本号（semver） */
  version: string;
  /** 支持的平台 */
  platform: SkillPlatform;
  /** 默认权限级别 */
  permission: SkillPermission;
  /** 该 Skill 包含的操作列表 */
  actions: SkillAction[];
  /** Skill 来源（内置/自定义），默认 builtin */
  source?: SkillSource;
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** 许可证（如 Apache-2.0、MIT） */
  license?: string;
  /** 作者 */
  author?: string;
  /** 标签 */
  tags?: string[];
  /** SKILL.md 的 Markdown 正文内容（不含 frontmatter） */
  instructions?: string;
}

/** Skill 同步请求（Electron → 服务端，推送自定义 Skill 元数据） */
export interface SkillSyncRequest {
  /** 所有本地安装的自定义 Skill 清单列表 */
  customSkills: SkillDefinition[];
}

/** Skill 同步结果（服务端 → Electron） */
export interface SkillSyncResult {
  /** 服务端已注册的所有 Skill（含启用状态） */
  registeredSkills: Array<{ name: string; enabled: boolean }>;
}

/** Skill 执行请求（服务端 → 客户端） */
export interface SkillExecRequest {
  /** 请求唯一标识（用于匹配响应） */
  requestId: string;
  /** 要执行的函数名 */
  functionName: string;
  /** 函数参数 */
  params: Record<string, unknown>;
  /** 发起请求的 Bot ID */
  botId: string;
  /** 会话 ID */
  conversationId: string;
}

/** Skill 执行结果（客户端 → 服务端） */
export interface SkillExecResult {
  /** 对应的请求 ID */
  requestId: string;
  /** 是否执行成功 */
  success: boolean;
  /** 成功时的返回数据 */
  data?: unknown;
  /** 失败时的错误信息 */
  error?: string;
}

/** Skill 市场注册表条目（兼容 SKILL.md 标准） */
export interface SkillRegistryEntry {
  /** Skill 名称（唯一标识） */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 描述 */
  description: string;
  /** 支持的平台 */
  platform: SkillPlatform;
  /** 版本号 */
  version: string;
  /** 作者 */
  author: string;
  /** 许可证 */
  license?: string;
  /** 标签 */
  tags?: string[];
  /** Git 仓库地址（优先） */
  repoUrl?: string;
  /** 下载地址（zip 包，备选） */
  downloadUrl?: string;
  /** 包大小（字节） */
  size?: number;
}

/** Skill 注册表索引（注册表服务器返回的 JSON 格式） */
export interface SkillRegistryIndex {
  /** 注册表名称 */
  name?: string;
  /** 最后更新时间 */
  updatedAt?: string;
  /** Skill 列表 */
  skills: SkillRegistryEntry[];
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
