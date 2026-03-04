/**
 * ToolDispatcher 测试
 *
 * 测试通用工具 Socket.IO 分发和超时处理。
 */
import { ToolDispatcher } from '../src/modules/bot/ToolDispatcher';

describe('ToolDispatcher', () => {
  let dispatcher: ToolDispatcher;
  let mockIO: any;
  let emitSpy: jest.Mock;

  beforeEach(() => {
    dispatcher = new ToolDispatcher();
    emitSpy = jest.fn();
    mockIO = {
      to: jest.fn().mockReturnValue({ emit: emitSpy }),
    };
    dispatcher.setIO(mockIO);
  });

  test('dispatch 发送 tool:exec 事件到目标用户', async () => {
    const promise = dispatcher.dispatch(
      'user-123', 'bash_exec',
      { command: 'echo hello' },
      'bot-1', 'conv-1',
    );

    // 验证发送了事件
    expect(mockIO.to).toHaveBeenCalledWith('user:user-123');
    expect(emitSpy).toHaveBeenCalledWith('tool:exec', expect.objectContaining({
      toolName: 'bash_exec',
      params: { command: 'echo hello' },
      botId: 'bot-1',
      conversationId: 'conv-1',
    }));

    // 获取 requestId 并模拟返回结果
    const request = emitSpy.mock.calls[0][1];
    dispatcher.handleResult({
      requestId: request.requestId,
      success: true,
      data: 'hello\n',
    });

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.data).toBe('hello\n');
  });

  test('无 Socket.IO 时返回错误', async () => {
    const noIODispatcher = new ToolDispatcher();
    const result = await noIODispatcher.dispatch(
      'user-123', 'bash_exec', {}, 'bot-1', 'conv-1',
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Socket.IO');
  });

  test('重复 handleResult 被忽略', () => {
    const promise = dispatcher.dispatch(
      'user-123', 'read_file',
      { path: 'test.txt' },
      'bot-1', 'conv-1',
    );

    const request = emitSpy.mock.calls[0][1];

    // 第一次 handleResult
    dispatcher.handleResult({
      requestId: request.requestId,
      success: true,
      data: 'content',
    });

    // 第二次 handleResult（应被忽略）
    dispatcher.handleResult({
      requestId: request.requestId,
      success: false,
      error: 'duplicate',
    });

    return promise.then((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toBe('content');
    });
  });

  test('超时返回错误', async () => {
    jest.useFakeTimers();

    const promise = dispatcher.dispatch(
      'user-123', 'bash_exec',
      { command: 'sleep 60' },
      'bot-1', 'conv-1',
    );

    // 快进 30 秒触发超时
    jest.advanceTimersByTime(30000);

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('超时');

    jest.useRealTimers();
  });
});
