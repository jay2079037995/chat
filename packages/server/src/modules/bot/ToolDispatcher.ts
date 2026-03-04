/**
 * 通用工具异步分发器
 *
 * 负责将通用工具执行请求通过 Socket.IO 发送到目标用户的 Electron 客户端，
 * 并异步等待执行结果返回。使用 Promise + 超时机制管理请求生命周期。
 * 替代旧的 SkillDispatcher，事件从 skill:exec/result 改为 tool:exec/result。
 */
import { randomUUID } from 'crypto';
import type { Server as SocketIOServer } from 'socket.io';
import type { GenericToolExecRequest, GenericToolExecResult, GenericToolName } from '@chat/shared';

/** 默认超时 30 秒 */
const DEFAULT_TIMEOUT_MS = 30000;

/** 等待中的请求 */
interface PendingRequest {
  resolve: (result: GenericToolExecResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ToolDispatcher {
  private pending = new Map<string, PendingRequest>();
  private io: SocketIOServer | null = null;

  /** 延迟注入 Socket.IO 实例 */
  setIO(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * 向目标用户分发通用工具执行请求
   *
   * @param targetUserId 执行工具的目标用户 ID
   * @param toolName 工具名称
   * @param params 工具参数
   * @param botId 发起请求的 Bot ID
   * @param conversationId 会话 ID
   * @returns 执行结果
   */
  dispatch(
    targetUserId: string,
    toolName: GenericToolName,
    params: Record<string, unknown>,
    botId: string,
    conversationId: string,
  ): Promise<GenericToolExecResult> {
    if (!this.io) {
      return Promise.resolve({
        requestId: '',
        success: false,
        error: 'Socket.IO 未初始化',
      });
    }

    const requestId = randomUUID();
    const request: GenericToolExecRequest = {
      requestId,
      toolName,
      params,
      botId,
      conversationId,
    };

    return new Promise<GenericToolExecResult>((resolve) => {
      // 超时自动返回错误
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({
          requestId,
          success: false,
          error: '工具执行超时（30 秒），请确保目标用户正在使用 Electron 桌面端',
        });
      }, DEFAULT_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, timer });

      // 发送到目标用户的私有房间
      this.io!.to(`user:${targetUserId}`).emit('tool:exec', request);
    });
  }

  /**
   * 处理客户端返回的工具执行结果
   *
   * 由 Socket.IO 的 tool:result 事件触发。
   */
  handleResult(result: GenericToolExecResult): void {
    const pending = this.pending.get(result.requestId);
    if (!pending) return; // 已超时或重复回调，忽略

    clearTimeout(pending.timer);
    this.pending.delete(result.requestId);
    pending.resolve(result);
  }
}
