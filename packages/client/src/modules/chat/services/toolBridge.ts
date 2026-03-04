/**
 * Tool Bridge — Socket.IO <-> Electron IPC 桥接
 *
 * 接收服务端发来的 tool:exec 请求，通过 Electron IPC 转发到主进程执行，
 * 再将结果通过 socket.emit('tool:result') 回传给服务端。
 *
 * 同时监听 bot:request-skills 事件，从 Electron 读取 Skill 指令并推送。
 *
 * 非 Electron 环境直接返回错误。
 */
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, GenericToolExecRequest } from '@chat/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** electronAPI 类型声明 */
interface ElectronAPI {
  isElectron: boolean;
  execGenericTool: (request: GenericToolExecRequest) => Promise<{
    requestId: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
}

/** 获取 electronAPI（仅 Electron 环境可用） */
function getElectronAPI(): ElectronAPI | null {
  const api = (window as any).electronAPI;
  if (api && api.isElectron) return api as ElectronAPI;
  return null;
}

/**
 * 初始化 Tool Bridge
 *
 * 在 socket 连接建立后调用，注册 tool:exec 事件监听。
 */
export function initToolBridge(socket: TypedSocket): void {
  // 监听服务端发来的通用工具执行请求
  socket.on('tool:exec', async (request: GenericToolExecRequest) => {
    const electronAPI = getElectronAPI();

    if (!electronAPI) {
      // 非 Electron 环境，返回错误
      socket.emit('tool:result', {
        requestId: request.requestId,
        success: false,
        error: '当前客户端不支持工具执行，请使用 Electron 桌面端',
      });
      return;
    }

    try {
      // 通过 IPC 转发到 Electron 主进程
      const result = await electronAPI.execGenericTool(request);
      socket.emit('tool:result', result);
    } catch (err: any) {
      socket.emit('tool:result', {
        requestId: request.requestId,
        success: false,
        error: err.message || '工具执行失败',
      });
    }
  });
}
