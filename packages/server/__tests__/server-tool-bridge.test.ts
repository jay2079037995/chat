/**
 * ServerToolBridge — 工具回调测试（v1.24.0）
 *
 * 测试 onStepProgress / onToolLog 回调在 dispatchTool、
 * send_file_to_chat、present_choices 中的触发。
 */
import { createServerTools } from '../src/modules/bot/ServerToolBridge';
import type { StepProgressData, ToolLogData } from '../src/modules/bot/ServerToolBridge';

/** 创建 mock dispatcher */
function createMockDispatcher(result: { data?: unknown; error?: string } = { data: 'ok' }): any {
  return {
    dispatch: jest.fn().mockResolvedValue(result),
    handleResult: jest.fn(),
    pending: new Map(),
    io: null,
    setIO: jest.fn(),
  };
}

describe('ServerToolBridge — 回调测试', () => {
  describe('dispatchTool（bash_exec / read_file 等）', () => {
    test('成功执行时触发 start → complete 进度回调', async () => {
      const progressCalls: StepProgressData[] = [];
      const logCalls: ToolLogData[] = [];

      const tools = createServerTools({
        dispatcher: createMockDispatcher({ data: 'file content' }),
        targetUserId: 'user-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        onStepProgress: (data) => progressCalls.push(data),
        onToolLog: (log) => logCalls.push(log),
      });

      const result = await tools.bash_exec.execute!({ command: 'ls -la' } as any, {} as any);

      expect(result).toBe('file content');
      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0]).toMatchObject({ step: 'bash_exec', status: 'start', detail: 'ls -la' });
      expect(progressCalls[1]).toMatchObject({ step: 'bash_exec', status: 'complete' });
      expect(progressCalls[1].durationMs).toBeGreaterThanOrEqual(0);

      expect(logCalls).toHaveLength(1);
      expect(logCalls[0]).toMatchObject({
        toolName: 'bash_exec',
        input: { command: 'ls -la' },
        output: 'file content',
      });
      expect(logCalls[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    test('dispatcher 返回 error 时触发 error 进度回调', async () => {
      const progressCalls: StepProgressData[] = [];
      const logCalls: ToolLogData[] = [];

      const tools = createServerTools({
        dispatcher: createMockDispatcher({ error: 'command not found' }),
        targetUserId: 'user-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        onStepProgress: (data) => progressCalls.push(data),
        onToolLog: (log) => logCalls.push(log),
      });

      const result = await tools.bash_exec.execute!({ command: 'invalid' } as any, {} as any);

      expect(result).toBe('Error: command not found');
      expect(progressCalls[1]).toMatchObject({ step: 'bash_exec', status: 'error', detail: 'command not found' });
      expect(logCalls[0].error).toBe('command not found');
    });

    test('dispatcher 抛出异常时触发 error 进度回调', async () => {
      const progressCalls: StepProgressData[] = [];
      const dispatcher = createMockDispatcher();
      dispatcher.dispatch.mockRejectedValueOnce(new Error('timeout'));

      const tools = createServerTools({
        dispatcher,
        targetUserId: 'user-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        onStepProgress: (data) => progressCalls.push(data),
        onToolLog: jest.fn(),
      });

      await expect(tools.read_file.execute!({ path: '/tmp/file' } as any, {} as any)).rejects.toThrow('timeout');
      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0]).toMatchObject({ step: 'read_file', status: 'start', detail: '/tmp/file' });
      expect(progressCalls[1]).toMatchObject({ step: 'read_file', status: 'error', detail: 'timeout' });
    });

    test('read_file detail 为文件路径', async () => {
      const progressCalls: StepProgressData[] = [];

      const tools = createServerTools({
        dispatcher: createMockDispatcher({ data: 'content' }),
        targetUserId: 'user-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        onStepProgress: (data) => progressCalls.push(data),
      });

      await tools.read_file.execute!({ path: '/home/user/file.txt' } as any, {} as any);
      expect(progressCalls[0].detail).toBe('/home/user/file.txt');
    });

    test('不提供回调时不报错', async () => {
      const tools = createServerTools({
        dispatcher: createMockDispatcher({ data: 'ok' }),
        targetUserId: 'user-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        // 不提供 onStepProgress / onToolLog
      });

      const result = await tools.bash_exec.execute!({ command: 'echo hi' } as any, {} as any);
      expect(result).toBe('ok');
    });
  });

  describe('send_file_to_chat', () => {
    test('成功时触发 start → complete 进度回调 + 文件产物回调', async () => {
      const progressCalls: StepProgressData[] = [];
      const logCalls: ToolLogData[] = [];
      const artifactCalls: any[] = [];

      const tools = createServerTools({
        dispatcher: createMockDispatcher({
          data: { base64: 'YWJj', fileName: 'test.txt', fileSize: 3, mimeType: 'text/plain' },
        }),
        targetUserId: 'user-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        onStepProgress: (data) => progressCalls.push(data),
        onToolLog: (log) => logCalls.push(log),
        onFileArtifact: (a) => artifactCalls.push(a),
      });

      const result = await tools.send_file_to_chat.execute!({ path: 'test.txt' } as any, {} as any);

      expect(result).toContain('test.txt');
      expect(progressCalls[0]).toMatchObject({ step: 'send_file_to_chat', status: 'start', detail: 'test.txt' });
      expect(progressCalls[1]).toMatchObject({ step: 'send_file_to_chat', status: 'complete' });
      expect(logCalls[0].toolName).toBe('send_file_to_chat');
      expect(artifactCalls).toHaveLength(1);
      expect(artifactCalls[0].fileName).toBe('test.txt');
    });

    test('dispatcher 返回 error 时触发 error 回调', async () => {
      const progressCalls: StepProgressData[] = [];

      const tools = createServerTools({
        dispatcher: createMockDispatcher({ error: '文件不存在' }),
        targetUserId: 'user-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        onStepProgress: (data) => progressCalls.push(data),
        onToolLog: jest.fn(),
      });

      const result = await tools.send_file_to_chat.execute!({ path: 'missing.txt' } as any, {} as any);
      expect(result).toContain('Error');
      expect(progressCalls[1]).toMatchObject({ step: 'send_file_to_chat', status: 'error' });
    });
  });

  describe('present_choices', () => {
    test('触发 start → complete 进度回调 + 工具日志', async () => {
      const progressCalls: StepProgressData[] = [];
      const logCalls: ToolLogData[] = [];
      const metadataCalls: any[] = [];

      const tools = createServerTools({
        dispatcher: createMockDispatcher(),
        targetUserId: 'user-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        onStepProgress: (data) => progressCalls.push(data),
        onToolLog: (log) => logCalls.push(log),
        onPresentChoices: (m) => metadataCalls.push(m),
      });

      const result = await tools.present_choices.execute!({
        type: 'single_select',
        prompt: '选择一个',
        choices: ['A', 'B'],
      } as any, {} as any);

      expect(result).toBe('已向用户展示选项');
      expect(progressCalls[0]).toMatchObject({ step: 'present_choices', status: 'start', detail: 'single_select' });
      expect(progressCalls[1]).toMatchObject({ step: 'present_choices', status: 'complete' });
      expect(logCalls[0]).toMatchObject({ toolName: 'present_choices' });
      expect(metadataCalls).toHaveLength(1);
      expect(metadataCalls[0].choices.items).toEqual(['A', 'B']);
    });
  });

  describe('getToolDetail 辅助函数', () => {
    test('bash_exec 截断命令到 100 字符', async () => {
      const progressCalls: StepProgressData[] = [];
      const longCmd = 'x'.repeat(200);

      const tools = createServerTools({
        dispatcher: createMockDispatcher({ data: 'ok' }),
        targetUserId: 'user-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        onStepProgress: (data) => progressCalls.push(data),
      });

      await tools.bash_exec.execute!({ command: longCmd } as any, {} as any);
      expect(progressCalls[0].detail).toBe(longCmd.slice(0, 100));
    });

    test('list_files 没有特殊 detail', async () => {
      const progressCalls: StepProgressData[] = [];

      const tools = createServerTools({
        dispatcher: createMockDispatcher({ data: 'file1\nfile2' }),
        targetUserId: 'user-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        onStepProgress: (data) => progressCalls.push(data),
      });

      await tools.list_files.execute!({} as any, {} as any);
      // list_files without path → detail is empty string
      expect(progressCalls[0].detail).toBeFalsy();
    });
  });
});
