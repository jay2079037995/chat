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
export type GenericToolName =
  | 'bash_exec' | 'read_file' | 'write_file' | 'list_files' | 'read_file_binary'
  | 'search_skills' | 'install_skill' | 'uninstall_skill' | 'list_skills' | 'read_skill'
  | 'execute_skill_script';

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
 * 5 个通用工具：4 个文件/命令操作 + 1 个交互式选项展示。
 */
export const GENERIC_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'bash_exec',
      description: '在 Bot 工作区目录中执行 Shell 命令。工作目录已设为工作区，无需 cd。可用于运行脚本、安装依赖、编译代码等操作。',
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
            description: '文件路径（相对路径基于工作区目录解析；也可传入 Skill 目录的绝对路径来读取参考文件）',
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
      description: '将内容写入工作区目录中的文件。只允许写入工作区内。',
      parameters: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string',
            description: '文件路径（相对路径基于工作区目录解析，只允许写入工作区内）',
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
            description: '目录路径（相对路径基于工作区目录解析，也可传入 Skill 目录路径），省略则列出工作区根目录',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'send_file_to_chat',
      description: '将文件或目录发送到聊天对话中。文件将作为可下载附件显示，图片将显示预览。如果指定的是目录，会自动打包为 zip 文件后发送。',
      parameters: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string',
            description: '要发送的文件或目录路径（相对路径基于工作区目录解析）',
          },
          description: {
            type: 'string',
            description: '文件描述（可选，显示在聊天中）',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'present_choices',
      description: '向用户展示可选择的选项列表或请求文本输入。用户将看到可点击的选项按钮或输入框，选择后内容会自动作为用户消息发送。当你需要用户做选择时使用此工具。',
      parameters: {
        type: 'object' as const,
        properties: {
          type: {
            type: 'string',
            enum: ['single_select', 'text_input'],
            description: '交互类型：single_select 为选项按钮，text_input 为文本输入框',
          },
          prompt: {
            type: 'string',
            description: '提示文字（显示在选项或输入框上方）',
          },
          choices: {
            type: 'array',
            items: {
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    label: { type: 'string', description: '选项标签' },
                    description: { type: 'string', description: '选项描述（可选）' },
                  },
                  required: ['label'],
                },
              ],
            },
            description: 'type=single_select 时的选项列表，支持字符串或 {label, description} 对象格式',
          },
          placeholder: {
            type: 'string',
            description: 'type=text_input 时的输入框占位符文字',
          },
        },
        required: ['type'],
      },
    },
  },
  // ─── v2.1.0 Skill 管理工具 ──────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'search_skills',
      description: '在 claude-plugins.dev 上搜索可用的 Skill。返回匹配的 Skill 列表，包含名称、描述、安装次数等信息。',
      parameters: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词',
          },
          limit: {
            type: 'number',
            description: '返回结果数量上限，默认 10',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'install_skill',
      description: '安装 Skill。支持从 claude-plugins.dev URL 安装或从本地路径安装。安装前请先用 present_choices 向用户确认。',
      parameters: {
        type: 'object' as const,
        properties: {
          url: {
            type: 'string',
            description: 'Skill 的 SKILL.md 原始文件 URL（从 search_skills 结果中获取）',
          },
          localPath: {
            type: 'string',
            description: '本地 Skill 目录路径（包含 SKILL.md 的目录）',
          },
          overwrite: {
            type: 'boolean',
            description: '如果已存在同名 Skill，是否覆盖安装，默认 false',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'uninstall_skill',
      description: '卸载已安装的 Skill。卸载前请先用 present_choices 向用户确认。',
      parameters: {
        type: 'object' as const,
        properties: {
          name: {
            type: 'string',
            description: '要卸载的 Skill 名称',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_skills',
      description: '列出当前 Bot 已安装的所有 Skill。返回每个 Skill 的名称和描述。',
      parameters: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_skill',
      description: '读取已安装 Skill 的完整 SKILL.md 指令内容。当需要了解某个 Skill 的详细用法时使用。',
      parameters: {
        type: 'object' as const,
        properties: {
          name: {
            type: 'string',
            description: '要读取的 Skill 名称',
          },
        },
        required: ['name'],
      },
    },
  },
  // ─── v2.2.0 沙箱脚本执行 ──────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'execute_skill_script',
      description: '在安全沙箱中执行已安装 Skill 的 scripts/ 目录下的脚本。脚本的文件系统和网络访问受限。',
      parameters: {
        type: 'object' as const,
        properties: {
          skillName: {
            type: 'string',
            description: '脚本所属的 Skill 名称',
          },
          scriptPath: {
            type: 'string',
            description: '脚本在 scripts/ 目录内的相对路径（如 "init.sh" 或 "build.py"）',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: '命令行参数列表',
          },
          input: {
            type: 'string',
            description: '标准输入内容',
          },
        },
        required: ['skillName', 'scriptPath'],
      },
    },
  },
];
