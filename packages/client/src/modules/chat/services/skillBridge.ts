/**
 * Skill Bridge — Socket.IO ↔ Electron IPC 桥接
 *
 * 接收服务端发来的 skill:exec 请求，通过 Electron IPC 转发到主进程执行，
 * 再将结果通过 socket.emit('skill:result') 回传给服务端。
 *
 * 非 Electron 环境直接返回错误。
 */
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, SkillExecRequest, SkillDefinition } from '@chat/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** electronAPI 类型声明 */
interface ElectronAPI {
  isElectron: boolean;
  execSkill: (request: SkillExecRequest) => Promise<{
    requestId: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
  /** 列出已安装的自定义 Skill */
  listCustomSkills?: () => Promise<SkillDefinition[]>;
}

/** 获取 electronAPI（仅 Electron 环境可用） */
function getElectronAPI(): ElectronAPI | null {
  const api = (window as any).electronAPI;
  if (api && api.isElectron) return api as ElectronAPI;
  return null;
}

/**
 * 初始化 Skill Bridge
 *
 * 在 socket 连接建立后调用，注册 skill:exec 事件监听。
 */
/**
 * 将本地自定义 Skill 同步到服务端 SkillRegistry
 *
 * 可在 Skill 安装/卸载后手动调用，确保服务端及时更新。
 */
export function syncSkillsToServer(socket: TypedSocket): void {
  const electronAPI = getElectronAPI();
  if (!electronAPI?.listCustomSkills) return;
  electronAPI.listCustomSkills().then((customSkills) => {
    socket.emit('skill:sync', { customSkills }, (result) => {
      console.log('[SkillBridge] Skill 同步完成:', result);
    });
  }).catch((err) => {
    console.error('[SkillBridge] 同步失败:', err);
  });
}

export function initSkillBridge(socket: TypedSocket): void {
  // Electron 环境下：连接后同步自定义 Skill 到服务端
  syncSkillsToServer(socket);

  socket.on('skill:exec', async (request: SkillExecRequest) => {
    const electronAPI = getElectronAPI();

    if (!electronAPI) {
      // 非 Electron 环境，返回错误
      socket.emit('skill:result', {
        requestId: request.requestId,
        success: false,
        error: '当前客户端不支持 Skill 执行，请使用 Electron 桌面端',
      });
      return;
    }

    try {
      // 通过 IPC 转发到 Electron 主进程
      const result = await electronAPI.execSkill(request);
      socket.emit('skill:result', result);
    } catch (err: any) {
      socket.emit('skill:result', {
        requestId: request.requestId,
        success: false,
        error: err.message || 'Skill 执行失败',
      });
    }
  });
}
