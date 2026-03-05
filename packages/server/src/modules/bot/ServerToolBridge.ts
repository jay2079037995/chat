/**
 * 服务端 Mastra 工具桥接
 *
 * 将通用工具定义转换为 Mastra createTool() 格式，
 * 每个工具的 execute() 通过 ToolDispatcher 分发到 Electron 端执行。
 * present_choices 和 send_file_to_chat 工具本地处理。
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ToolDispatcher } from './ToolDispatcher';
import type { MessageMetadata, RichChoiceItem } from '@chat/shared';
import { MODEL_PROVIDERS } from '@chat/shared';

/** 文件产物（由 send_file_to_chat 工具生成） */
export interface FileArtifact {
  /** base64 编码的文件数据 */
  base64: string;
  /** 文件名 */
  fileName: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** MIME 类型 */
  mimeType: string;
}

/** 步骤进度回调数据 */
export interface StepProgressData {
  step: string;
  status: 'start' | 'complete' | 'error';
  detail?: string;
  durationMs?: number;
}

/** 工具执行日志回调数据 */
export interface ToolLogData {
  toolName: string;
  input: Record<string, unknown>;
  output?: string;
  /** 输出原始总长度（截断前） */
  outputLength?: number;
  error?: string;
  durationMs: number;
}

interface ToolBridgeOptions {
  /** 通用工具分发器 */
  dispatcher: ToolDispatcher;
  /** Bot owner 的 userId（Electron 工具执行目标） */
  targetUserId: string;
  /** Bot ID */
  botId: string;
  /** 会话 ID */
  conversationId: string;
  /** present_choices 回调（本地拦截，不发送到 Electron） */
  onPresentChoices?: (metadata: MessageMetadata) => void;
  /** 文件产物回调（send_file_to_chat 生成） */
  onFileArtifact?: (artifact: FileArtifact) => void;
  /** 步骤进度回调（工具执行前后通知） */
  onStepProgress?: (data: StepProgressData) => void;
  /** 工具执行日志回调（记录每个工具调用的详情） */
  onToolLog?: (log: ToolLogData) => void;
  /** 模型切换回调（switch_model 工具使用） */
  onSwitchModel?: (modelStr: string) => void;
}

/** 获取工具执行的简短描述（用于进度提示） */
function getToolDetail(toolName: string, params: Record<string, unknown>): string | undefined {
  if (toolName === 'bash_exec') return String(params.command || '').slice(0, 100);
  if (toolName === 'read_file' || toolName === 'write_file' || toolName === 'list_files') return String(params.path || '');
  if (toolName === 'read_file_binary') return String(params.path || '');
  return undefined;
}

/** 截断字符串到指定长度 */
function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

/** 分发工具到 Electron 并返回结果字符串 */
async function dispatchTool(
  options: ToolBridgeOptions,
  toolName: 'bash_exec' | 'read_file' | 'write_file' | 'list_files' | 'read_file_binary'
    | 'search_skills' | 'install_skill' | 'uninstall_skill' | 'list_skills' | 'read_skill'
    | 'execute_skill_script',
  params: Record<string, unknown>,
): Promise<string> {
  const startTime = Date.now();
  const detail = getToolDetail(toolName, params);

  options.onStepProgress?.({ step: toolName, status: 'start', detail });

  try {
    const result = await options.dispatcher.dispatch(
      options.targetUserId, toolName, params, options.botId, options.conversationId,
    );

    const durationMs = Date.now() - startTime;
    const hasError = !!result.error;
    const output = hasError
      ? `Error: ${result.error}`
      : typeof result.data === 'string' ? result.data : JSON.stringify(result.data ?? '');

    options.onStepProgress?.({ step: toolName, status: hasError ? 'error' : 'complete', detail: hasError ? result.error : undefined, durationMs });
    options.onToolLog?.({ toolName, input: params, output: truncate(output, 5000), outputLength: output.length, error: result.error || undefined, durationMs });

    return output;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    options.onStepProgress?.({ step: toolName, status: 'error', detail: err.message, durationMs });
    options.onToolLog?.({ toolName, input: params, error: err.message, durationMs });
    throw err;
  }
}

/**
 * 创建 Mastra 格式的服务端工具
 */
export function createServerTools(options: ToolBridgeOptions) {
  return {
    bash_exec: createTool({
      id: 'bash_exec',
      description: '在 Bot 工作区目录中执行 Shell 命令。工作目录已设为工作区，无需 cd。',
      inputSchema: z.object({
        command: z.string().describe('要执行的 Shell 命令'),
        timeout: z.number().optional().describe('超时时间（毫秒），默认 30000'),
      }),
      execute: async (inputData) => dispatchTool(options, 'bash_exec', inputData as Record<string, unknown>),
    }),

    read_file: createTool({
      id: 'read_file',
      description: '读取工作区或 Skill 目录中的文件内容。',
      inputSchema: z.object({
        path: z.string().describe('文件路径（相对路径基于工作区目录解析）'),
      }),
      execute: async (inputData) => dispatchTool(options, 'read_file', inputData as Record<string, unknown>),
    }),

    write_file: createTool({
      id: 'write_file',
      description: '将内容写入工作区目录中的文件。只允许写入工作区内。',
      inputSchema: z.object({
        path: z.string().describe('文件路径（相对路径基于工作区目录解析）'),
        content: z.string().describe('要写入的文件内容'),
      }),
      execute: async (inputData) => dispatchTool(options, 'write_file', inputData as Record<string, unknown>),
    }),

    list_files: createTool({
      id: 'list_files',
      description: '列出工作区或 Skill 目录中的文件和子目录。',
      inputSchema: z.object({
        path: z.string().optional().describe('目录路径，省略则列出工作区根目录'),
      }),
      execute: async (inputData) => dispatchTool(options, 'list_files', inputData as Record<string, unknown>),
    }),

    send_file_to_chat: createTool({
      id: 'send_file_to_chat',
      description: '将文件或目录发送到聊天对话中。文件将作为可下载附件显示，图片将显示预览。目录自动打包为 zip。',
      inputSchema: z.object({
        path: z.string().describe('要发送的文件或目录路径（相对路径基于工作区目录解析）'),
        description: z.string().optional().describe('文件描述（可选）'),
      }),
      execute: async (params) => {
        const startTime = Date.now();
        options.onStepProgress?.({ step: 'send_file_to_chat', status: 'start', detail: String(params.path || '') });

        try {
          // 通过 ToolDispatcher 让 Electron 读取文件为 base64
          const result = await options.dispatcher.dispatch(
            options.targetUserId, 'read_file_binary', { path: params.path },
            options.botId, options.conversationId,
          );
          const durationMs = Date.now() - startTime;

          if (result.error) {
            options.onStepProgress?.({ step: 'send_file_to_chat', status: 'error', detail: result.error, durationMs });
            options.onToolLog?.({ toolName: 'send_file_to_chat', input: { path: params.path }, error: result.error, durationMs });
            return `Error: ${result.error}`;
          }
          const fileData = result.data as FileArtifact;
          if (!fileData || !fileData.base64) {
            const errMsg = '无法读取文件数据';
            options.onStepProgress?.({ step: 'send_file_to_chat', status: 'error', detail: errMsg, durationMs });
            options.onToolLog?.({ toolName: 'send_file_to_chat', input: { path: params.path }, error: errMsg, durationMs });
            return `Error: ${errMsg}`;
          }
          // 通过回调传递文件产物
          options.onFileArtifact?.(fileData);
          const output = `已将文件 ${fileData.fileName} 发送到聊天`;
          options.onStepProgress?.({ step: 'send_file_to_chat', status: 'complete', durationMs });
          options.onToolLog?.({ toolName: 'send_file_to_chat', input: { path: params.path }, output, durationMs });
          return output;
        } catch (err: any) {
          const durationMs = Date.now() - startTime;
          options.onStepProgress?.({ step: 'send_file_to_chat', status: 'error', detail: err.message, durationMs });
          options.onToolLog?.({ toolName: 'send_file_to_chat', input: { path: params.path }, error: err.message, durationMs });
          throw err;
        }
      },
    }),

    present_choices: createTool({
      id: 'present_choices',
      description: '向用户展示可选择的选项列表或请求文本输入。用户将看到可点击的选项按钮或输入框。',
      inputSchema: z.object({
        type: z.enum(['single_select', 'text_input']).describe('交互类型'),
        prompt: z.string().optional().describe('提示文字（显示在选项上方）'),
        choices: z.array(
          z.union([
            z.string(),
            z.object({
              label: z.string().describe('选项标签'),
              description: z.string().optional().describe('选项描述'),
            }),
          ]),
        ).optional().describe('type=single_select 时的选项列表，支持字符串或 {label, description} 对象'),
        placeholder: z.string().optional().describe('type=text_input 时的输入框占位符'),
      }),
      execute: async (params) => {
        const startTime = Date.now();
        options.onStepProgress?.({ step: 'present_choices', status: 'start', detail: params.type });

        const metadata: MessageMetadata = {};
        if (params.type === 'single_select' && params.choices) {
          // 兼容字符串和对象两种格式
          const items: string[] = [];
          const richItems: RichChoiceItem[] = [];
          let hasRichItems = false;
          for (const choice of params.choices) {
            if (typeof choice === 'string') {
              items.push(choice);
              richItems.push({ label: choice });
            } else {
              items.push(choice.label);
              richItems.push({ label: choice.label, description: choice.description });
              if (choice.description) hasRichItems = true;
            }
          }
          metadata.choices = {
            prompt: params.prompt,
            items,
            ...(hasRichItems ? { richItems } : {}),
          };
        } else if (params.type === 'text_input') {
          metadata.inputRequest = {
            label: params.prompt || '请输入',
            placeholder: params.placeholder,
          };
        }
        options.onPresentChoices?.(metadata);
        const durationMs = Date.now() - startTime;
        options.onStepProgress?.({ step: 'present_choices', status: 'complete', durationMs });
        options.onToolLog?.({ toolName: 'present_choices', input: { type: params.type, prompt: params.prompt }, output: '已向用户展示选项', durationMs });
        return '已向用户展示选项';
      },
    }),

    // ─── v2.1.0 Skill 管理工具 ──────────────────────────

    search_skills: createTool({
      id: 'search_skills',
      description: '在 claude-plugins.dev 上搜索可用的 Skill。',
      inputSchema: z.object({
        query: z.string().describe('搜索关键词'),
        limit: z.number().optional().describe('返回结果数量上限，默认 10'),
      }),
      execute: async (inputData) => dispatchTool(options, 'search_skills' as any, inputData as Record<string, unknown>),
    }),

    install_skill: createTool({
      id: 'install_skill',
      description: '安装 Skill。支持从 URL 或本地路径安装。安装前请先用 present_choices 向用户确认。',
      inputSchema: z.object({
        url: z.string().optional().describe('Skill 的 SKILL.md 原始文件 URL'),
        localPath: z.string().optional().describe('本地 Skill 目录路径'),
        overwrite: z.boolean().optional().describe('是否覆盖已存在的同名 Skill'),
      }),
      execute: async (inputData) => dispatchTool(options, 'install_skill' as any, inputData as Record<string, unknown>),
    }),

    uninstall_skill: createTool({
      id: 'uninstall_skill',
      description: '卸载已安装的 Skill。卸载前请先用 present_choices 向用户确认。',
      inputSchema: z.object({
        name: z.string().describe('要卸载的 Skill 名称'),
      }),
      execute: async (inputData) => dispatchTool(options, 'uninstall_skill' as any, inputData as Record<string, unknown>),
    }),

    list_skills: createTool({
      id: 'list_skills',
      description: '列出当前 Bot 已安装的所有 Skill。',
      inputSchema: z.object({}),
      execute: async (inputData) => dispatchTool(options, 'list_skills' as any, inputData as Record<string, unknown>),
    }),

    read_skill: createTool({
      id: 'read_skill',
      description: '读取已安装 Skill 的完整 SKILL.md 指令内容。',
      inputSchema: z.object({
        name: z.string().describe('要读取的 Skill 名称'),
      }),
      execute: async (inputData) => dispatchTool(options, 'read_skill' as any, inputData as Record<string, unknown>),
    }),

    // ─── v2.2.0 沙箱脚本执行 ──────────────────────────

    execute_skill_script: createTool({
      id: 'execute_skill_script',
      description: '在安全沙箱中执行 Skill 的 scripts/ 目录下的脚本。',
      inputSchema: z.object({
        skillName: z.string().describe('脚本所属的 Skill 名称'),
        scriptPath: z.string().describe('scripts/ 内的相对路径'),
        args: z.array(z.string()).optional().describe('命令行参数'),
        input: z.string().optional().describe('标准输入内容'),
      }),
      execute: async (inputData) => dispatchTool(options, 'execute_skill_script' as any, inputData as Record<string, unknown>),
    }),

    // ─── v2.3.0 模型管理工具（本地处理，不走 Electron） ──────

    list_models: createTool({
      id: 'list_models',
      description: '列出所有可用的 AI 模型 Provider 及其模型列表。',
      inputSchema: z.object({}),
      execute: async () => {
        const entries = Object.entries(MODEL_PROVIDERS).map(([key, info]) => {
          const models = info.models.length > 0
            ? info.models.map(m => `${key}/${m}`).join(', ')
            : '(需手动输入模型名)';
          return `**${info.displayName}** (${key}): ${models}`;
        });
        return `可用 Provider 和模型:\n\n${entries.join('\n')}`;
      },
    }),

    switch_model: createTool({
      id: 'switch_model',
      description: '切换当前对话使用的 AI 模型。格式为 "provider/model"，如 "openai/gpt-4o"。切换在下一轮对话生效。',
      inputSchema: z.object({
        model: z.string().describe('目标模型字符串，格式为 "provider/model"'),
      }),
      execute: async (params) => {
        const model = params.model;
        if (!model.includes('/')) {
          return `无效的模型格式，应为 "provider/model"，如 "openai/gpt-4o"`;
        }
        if (options.onSwitchModel) {
          options.onSwitchModel(model);
          return `模型已切换为 ${model}（下一轮对话生效）`;
        }
        return `模型切换不可用`;
      },
    }),
  };
}
