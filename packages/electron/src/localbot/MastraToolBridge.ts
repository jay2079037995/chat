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
import type { GenericToolName } from '../../../shared/dist';

/**
 * 创建通用 Mastra Tool 集合
 *
 * 所有 Bot 共享同样的 4 个通用工具定义，但每个 Bot 有独立的
 * workspacePath 和 skillDirs。
 *
 * @param workspacePath Bot 工作区目录
 * @param skillDirs Bot 已安装的 Skill 目录列表
 */
export function createGenericMastraTools(
  workspacePath: string,
  skillDirs: string[],
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
  };
}
