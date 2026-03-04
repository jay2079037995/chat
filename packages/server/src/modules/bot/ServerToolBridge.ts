/**
 * 服务端 AI SDK 工具桥接
 *
 * 将通用工具定义（GENERIC_TOOL_DEFINITIONS）转换为 AI SDK tool() 格式，
 * 每个工具的 execute() 通过 ToolDispatcher 分发到 Electron 端执行。
 * present_choices 工具本地拦截，不发送到 Electron。
 */
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolDispatcher } from './ToolDispatcher';
import type { MessageMetadata } from '@chat/shared';

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
}

/** 分发工具到 Electron 并返回结果字符串 */
async function dispatchTool(
  options: ToolBridgeOptions,
  toolName: 'bash_exec' | 'read_file' | 'write_file' | 'list_files',
  params: Record<string, unknown>,
): Promise<string> {
  const result = await options.dispatcher.dispatch(
    options.targetUserId, toolName, params, options.botId, options.conversationId,
  );
  if (result.error) {
    return `Error: ${result.error}`;
  }
  return typeof result.data === 'string' ? result.data : JSON.stringify(result.data ?? '');
}

/**
 * 创建 AI SDK 格式的服务端工具
 */
export function createServerTools(options: ToolBridgeOptions) {
  return {
    bash_exec: tool({
      description: '在 Bot 工作区目录中执行 Shell 命令。工作目录已设为工作区，无需 cd。',
      parameters: z.object({
        command: z.string().describe('要执行的 Shell 命令'),
        timeout: z.number().optional().describe('超时时间（毫秒），默认 30000'),
      }),
      execute: async (params) => dispatchTool(options, 'bash_exec', params),
    }),

    read_file: tool({
      description: '读取工作区或 Skill 目录中的文件内容。',
      parameters: z.object({
        path: z.string().describe('文件路径（相对路径基于工作区目录解析）'),
      }),
      execute: async (params) => dispatchTool(options, 'read_file', params),
    }),

    write_file: tool({
      description: '将内容写入工作区目录中的文件。只允许写入工作区内。',
      parameters: z.object({
        path: z.string().describe('文件路径（相对路径基于工作区目录解析）'),
        content: z.string().describe('要写入的文件内容'),
      }),
      execute: async (params) => dispatchTool(options, 'write_file', params),
    }),

    list_files: tool({
      description: '列出工作区或 Skill 目录中的文件和子目录。',
      parameters: z.object({
        path: z.string().optional().describe('目录路径，省略则列出工作区根目录'),
      }),
      execute: async (params) => dispatchTool(options, 'list_files', params as Record<string, unknown>),
    }),

    present_choices: tool({
      description: '向用户展示可选择的选项列表或请求文本输入。用户将看到可点击的选项按钮或输入框。',
      parameters: z.object({
        type: z.enum(['single_select', 'text_input']).describe('交互类型'),
        prompt: z.string().optional().describe('提示文字（显示在选项上方）'),
        choices: z.array(z.string()).optional().describe('type=single_select 时的选项列表'),
        placeholder: z.string().optional().describe('type=text_input 时的输入框占位符'),
      }),
      execute: async (params) => {
        const metadata: MessageMetadata = {};
        if (params.type === 'single_select' && params.choices) {
          metadata.choices = { prompt: params.prompt, items: params.choices };
        } else if (params.type === 'text_input') {
          metadata.inputRequest = {
            label: params.prompt || '请输入',
            placeholder: params.placeholder,
          };
        }
        options.onPresentChoices?.(metadata);
        return '已向用户展示选项';
      },
    }),
  };
}
