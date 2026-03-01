/**
 * Socket.IO 连接状态管理 (Zustand Store)
 *
 * 管理 WebSocket 连接的生命周期、在线用户列表，
 * 并将接收到的消息转发给 useChatStore。
 */
import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@chat/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketState {
  /** Socket.IO 客户端实例 */
  socket: TypedSocket | null;
  /** 是否已连接 */
  connected: boolean;
  /** 在线用户 ID 集合 */
  onlineUsers: Set<string>;

  /** 建立 Socket 连接（传入 sessionId 用于认证） */
  connect: (sessionId: string) => void;
  /** 断开连接 */
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  onlineUsers: new Set(),

  connect: (sessionId: string) => {
    const { socket: existing } = get();
    if (existing?.connected) return;

    // 断开旧连接
    existing?.disconnect();

    const socket: TypedSocket = io({
      auth: { sessionId },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      set({ connected: true });
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    // 在线状态事件
    socket.on('user:online', (userId: string) => {
      set((state) => {
        const next = new Set(state.onlineUsers);
        next.add(userId);
        return { onlineUsers: next };
      });
    });

    socket.on('user:offline', (userId: string) => {
      set((state) => {
        const next = new Set(state.onlineUsers);
        next.delete(userId);
        return { onlineUsers: next };
      });
    });

    // 接收消息 → 转发给 useChatStore（延迟导入避免循环依赖）
    socket.on('message:receive', (message) => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().receiveMessage(message);
      });
    });

    // 已读回执
    socket.on('message:read', (data) => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().handleReadReceipt(data.conversationId, data.userId);
      });
    });

    set({ socket, connected: false });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false, onlineUsers: new Set() });
    }
  },
}));
