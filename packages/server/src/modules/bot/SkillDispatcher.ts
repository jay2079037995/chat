/**
 * Skill 异步分发器
 *
 * 负责将 Skill 执行请求通过 Socket.IO 发送到目标用户的 Electron 客户端，
 * 并异步等待执行结果返回。使用 Promise + 超时机制管理请求生命周期。
 */
import { randomUUID } from 'crypto';
import type { Server as SocketIOServer } from 'socket.io';
import type { SkillExecRequest, SkillExecResult } from '@chat/shared';

/** 默认超时 30 秒 */
const DEFAULT_TIMEOUT_MS = 30000;

/** 等待中的请求 */
interface PendingRequest {
  resolve: (result: SkillExecResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class SkillDispatcher {
  private pending = new Map<string, PendingRequest>();
  private io: SocketIOServer | null = null;

  /** 延迟注入 Socket.IO 实例 */
  setIO(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * 向目标用户分发 Skill 执行请求
   *
   * @param targetUserId 执行 Skill 的目标用户 ID
   * @param functionName 要执行的函数名
   * @param params 函数参数
   * @param botId 发起请求的 Bot ID
   * @param conversationId 会话 ID
   * @returns 执行结果
   */
  dispatch(
    targetUserId: string,
    functionName: string,
    params: Record<string, unknown>,
    botId: string,
    conversationId: string,
  ): Promise<SkillExecResult> {
    if (!this.io) {
      return Promise.resolve({
        requestId: '',
        success: false,
        error: 'Socket.IO 未初始化',
      });
    }

    const requestId = randomUUID();
    const request: SkillExecRequest = {
      requestId,
      functionName,
      params,
      botId,
      conversationId,
    };

    return new Promise<SkillExecResult>((resolve) => {
      // 超时自动返回错误
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({
          requestId,
          success: false,
          error: 'Skill 执行超时（30 秒），请确保目标用户正在使用 Electron 桌面端',
        });
      }, DEFAULT_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, timer });

      // 发送到目标用户的私有房间
      this.io!.to(`user:${targetUserId}`).emit('skill:exec', request);
    });
  }

  /**
   * 处理客户端返回的 Skill 执行结果
   *
   * 由 Socket.IO 的 skill:result 事件触发。
   */
  handleResult(result: SkillExecResult): void {
    const pending = this.pending.get(result.requestId);
    if (!pending) return; // 已超时或重复回调，忽略

    clearTimeout(pending.timer);
    this.pending.delete(result.requestId);
    pending.resolve(result);
  }
}
