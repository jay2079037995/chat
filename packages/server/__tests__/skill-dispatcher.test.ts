/**
 * SkillDispatcher 单元测试
 */
import { SkillDispatcher } from '../src/modules/bot/SkillDispatcher';

describe('SkillDispatcher', () => {
  let dispatcher: SkillDispatcher;
  let mockIO: any;

  beforeEach(() => {
    dispatcher = new SkillDispatcher();
    mockIO = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    };
    dispatcher.setIO(mockIO);
  });

  test('无 IO 时应返回错误', async () => {
    const noIODispatcher = new SkillDispatcher();
    const result = await noIODispatcher.dispatch('user1', 'test_fn', {}, 'bot1', 'conv1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Socket.IO');
  });

  test('dispatch 应发送 skill:exec 事件到正确的用户房间', () => {
    // 不 await，因为会等待 handleResult
    const promise = dispatcher.dispatch('user123', 'test_fn', { a: 1 }, 'bot1', 'conv1');

    expect(mockIO.to).toHaveBeenCalledWith('user:user123');
    const emitFn = mockIO.to('user:user123').emit;
    expect(emitFn).toHaveBeenCalledWith('skill:exec', expect.objectContaining({
      functionName: 'test_fn',
      params: { a: 1 },
      botId: 'bot1',
      conversationId: 'conv1',
    }));

    // 获取 requestId 并 resolve
    const request = emitFn.mock.calls[0][1];
    dispatcher.handleResult({
      requestId: request.requestId,
      success: true,
      data: { result: 'ok' },
    });

    return promise.then((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'ok' });
    });
  });

  test('handleResult 应 resolve 等待中的 Promise', async () => {
    const promise = dispatcher.dispatch('user1', 'fn', {}, 'bot', 'conv');

    const emitFn = mockIO.to().emit;
    const request = emitFn.mock.calls[0][1];

    dispatcher.handleResult({
      requestId: request.requestId,
      success: false,
      error: '执行失败',
    });

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toBe('执行失败');
  });

  test('重复的 handleResult 应被忽略', async () => {
    const promise = dispatcher.dispatch('user1', 'fn', {}, 'bot', 'conv');

    const emitFn = mockIO.to().emit;
    const request = emitFn.mock.calls[0][1];

    dispatcher.handleResult({
      requestId: request.requestId,
      success: true,
      data: 'first',
    });

    // 第二次 handleResult 不应报错
    dispatcher.handleResult({
      requestId: request.requestId,
      success: true,
      data: 'second',
    });

    const result = await promise;
    expect(result.data).toBe('first');
  });
});
