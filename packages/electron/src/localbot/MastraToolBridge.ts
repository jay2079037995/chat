/**
 * Mastra Tool 桥接器
 *
 * 提供 4 个通用 Mastra Tool（bash_exec/read_file/write_file/list_files），
 * 供 LocalBotManager 的 Mastra Agent 使用。
 * 替代旧的 26 个硬编码 Skill handler 包装。
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GenericToolExecutor } from '../claudeskill/GenericToolExecutor';
import type { GenericToolName, MessageMetadata } from '../../../shared/dist';

/** present_choices 回调类型 */
export type PresentChoicesCallback = (metadata: MessageMetadata) => void;

/**
 * 创建通用 Mastra Tool 集合
 *
 * 所有 Bot 共享同样的 4+1 个通用工具定义，但每个 Bot 有独立的
 * workspacePath 和 skillDirs。
 *
 * @param workspacePath Bot 工作区目录
 * @param skillDirs Bot 已安装的 Skill 目录列表
 * @param onPresentChoices present_choices 工具回调
 */
export function createGenericMastraTools(
  workspacePath: string,
  skillDirs: string[],
  onPresentChoices?: PresentChoicesCallback,
): Record<string, ReturnType<typeof createTool>> {
  const executor = new GenericToolExecutor();

  /** 通用执行函数 */
  const execTool = async (toolName: GenericToolName, params: Record<string, unknown>) => {
    const result = await executor.execute(
      {
        requestId: `local_${Date.now()}`,
        toolName,
        params,
        botId: '',
        conversationId: '',
      },
      workspacePath,
      skillDirs,
    );

    if (!result.success) {
      return `错误: ${result.error}`;
    }
    return typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
  };

  return {
    bash_exec: createTool({
      id: 'bash_exec',
      description: '在工作区目录中执行 Shell 命令。可用于运行脚本、安装依赖、编译代码等操作。',
      inputSchema: z.object({
        command: z.string().describe('要执行的 Shell 命令'),
        timeout: z.number().optional().describe('超时时间（毫秒），默认 30000'),
      }),
      execute: async ({ context }) => {
        return execTool('bash_exec', context as Record<string, unknown>);
      },
    }),

    read_file: createTool({
      id: 'read_file',
      description: '读取工作区或 Skill 目录中的文件内容。',
      inputSchema: z.object({
        path: z.string().describe('文件路径（相对于工作区或 Skill 目录）'),
      }),
      execute: async ({ context }) => {
        return execTool('read_file', context as Record<string, unknown>);
      },
    }),

    write_file: createTool({
      id: 'write_file',
      description: '将内容写入工作区目录中的文件。',
      inputSchema: z.object({
        path: z.string().describe('文件路径（相对于工作区）'),
        content: z.string().describe('要写入的文件内容'),
      }),
      execute: async ({ context }) => {
        return execTool('write_file', context as Record<string, unknown>);
      },
    }),

    list_files: createTool({
      id: 'list_files',
      description: '列出工作区或 Skill 目录中的文件和子目录。',
      inputSchema: z.object({
        path: z.string().optional().describe('目录路径（相对于工作区或 Skill 目录），默认为根目录'),
      }),
      execute: async ({ context }) => {
        return execTool('list_files', context as Record<string, unknown>);
      },
    }),

    present_choices: createTool({
      id: 'present_choices',
      description: '向用户展示可选择的选项列表或请求文本输入。用户将看到可点击的选项按钮或输入框，选择后内容会自动作为用户消息发送。',
      inputSchema: z.object({
        type: z.enum(['single_select', 'text_input']).describe('交互类型'),
        prompt: z.string().optional().describe('提示文字'),
        choices: z.array(z.string()).optional().describe('type=single_select 时的选项列表'),
        placeholder: z.string().optional().describe('type=text_input 时的输入框占位符'),
      }),
      execute: async ({ context }) => {
        const params = context as Record<string, unknown>;
        const type = params.type as string;
        let metadata: MessageMetadata;

        if (type === 'text_input') {
          metadata = {
            inputRequest: {
              label: (params.prompt as string) || '请输入',
              placeholder: params.placeholder as string | undefined,
            },
          };
        } else {
          metadata = {
            choices: {
              prompt: params.prompt as string | undefined,
              items: (params.choices as string[]) || [],
            },
          };
        }

        onPresentChoices?.(metadata);
        return '选项已展示给用户。';
      },
    }),
  };
}
