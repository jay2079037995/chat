/**
 * Claude Agent Skills 标准类型定义
 *
 * 基于 Claude Agent Skills 标准（SKILL.md 格式）。
 * Skill 是 AI 指令 + 通用工具（bash/read/write）的组合，
 * 替代旧的 handler 函数 → function calling 模式。
 */

/** Claude Skill 元数据（列表展示用） */
export interface ClaudeSkillMeta {
  /** Skill 名称（唯一标识） */
  name: string;
  /** Skill 描述 */
  description: string;
  /** 版本号 */
  version?: string;
  /** 作者 */
  author?: string;
  /** 标签 */
  tags?: string[];
  /** 来源：本地安装 / 在线安装 */
  source?: 'local' | 'online';
  /** 命名空间（在线安装时的 namespace） */
  namespace?: string;
}

/** Claude Skill 完整数据（含 SKILL.md 指令正文） */
export interface ClaudeSkill extends ClaudeSkillMeta {
  /** SKILL.md 的 Markdown 指令正文（AI 读取并执行） */
  instructions: string;
  /** Skill 目录路径 */
  dirPath?: string;
  /** 是否包含 scripts/ 子目录 */
  hasScripts?: boolean;
  /** 是否包含 references/ 子目录 */
  hasReferences?: boolean;
}

/** claude-plugins.dev 搜索结果 */
export interface PluginSearchResult {
  /** 搜索到的 Skill 列表 */
  skills: PluginEntry[];
  /** 总数 */
  total: number;
  /** 每页数量 */
  limit: number;
  /** 偏移量 */
  offset: number;
}

/** claude-plugins.dev 单条 Skill 条目 */
export interface PluginEntry {
  /** Skill ID */
  id: string;
  /** Skill 名称 */
  name: string;
  /** 命名空间（作者/组织） */
  namespace: string;
  /** 描述 */
  description: string;
  /** 源码 URL */
  sourceUrl: string;
  /** 作者 */
  author: string;
  /** GitHub stars 数 */
  stars: number;
  /** 安装次数 */
  installs: number;
  /** 元数据（GitHub 仓库信息） */
  metadata: {
    /** 仓库所有者 */
    repoOwner: string;
    /** 仓库名称 */
    repoName: string;
    /** 目录路径 */
    directoryPath: string;
    /** SKILL.md 原始文件 URL */
    rawFileUrl: string;
  };
}

/** 通用工具名称 */
export type GenericToolName = 'bash_exec' | 'read_file' | 'write_file' | 'list_files';

/** 通用工具执行请求（Server Bot → Electron） */
export interface GenericToolExecRequest {
  /** 请求唯一标识（用于匹配响应） */
  requestId: string;
  /** 工具名称 */
  toolName: GenericToolName;
  /** 工具参数 */
  params: Record<string, unknown>;
  /** 发起请求的 Bot ID */
  botId: string;
  /** 会话 ID */
  conversationId: string;
}

/** 通用工具执行结果 */
export interface GenericToolExecResult {
  /** 对应的请求 ID */
  requestId: string;
  /** 是否执行成功 */
  success: boolean;
  /** 成功时的返回数据 */
  data?: unknown;
  /** 失败时的错误信息 */
  error?: string;
}

/**
 * 通用工具 LLM function calling 定义（服务端 Bot 使用）
 *
 * 固定 4 个通用工具，替代旧的动态 Skill 工具列表。
 */
export const GENERIC_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'bash_exec',
      description: '在工作区目录中执行 Shell 命令。可用于运行脚本、安装依赖、编译代码等操作。',
      parameters: {
        type: 'object' as const,
        properties: {
          command: {
            type: 'string',
            description: '要执行的 Shell 命令',
          },
          timeout: {
            type: 'number',
            description: '超时时间（毫秒），默认 30000',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: '读取工作区或 Skill 目录中的文件内容。',
      parameters: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string',
            description: '文件路径（相对于工作区或 Skill 目录）',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: '将内容写入工作区目录中的文件。',
      parameters: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string',
            description: '文件路径（相对于工作区）',
          },
          content: {
            type: 'string',
            description: '要写入的文件内容',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: '列出工作区或 Skill 目录中的文件和子目录。',
      parameters: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string',
            description: '目录路径（相对于工作区或 Skill 目录），默认为根目录',
          },
        },
        required: [],
      },
    },
  },
];
