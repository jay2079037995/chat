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
      console.log('[Socket] 已连接, id:', socket.id);
      set({ connected: true });
      // 重连时刷新会话列表（获取准确未读计数）
      import('./useChatStore').then(({ useChatStore }) => {
        void useChatStore.getState().loadConversations();
      });
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] 连接失败:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] 断开连接:', reason);
      set({ connected: false });
    });

    // 连接时接收当前所有在线用户列表
    socket.on('users:online_list', (userIds: string[]) => {
      set({ onlineUsers: new Set(userIds) });
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

    // 上线后接收离线消息
    socket.on('sync:offline_messages', (messages) => {
      import('./useChatStore').then(({ useChatStore }) => {
        const store = useChatStore.getState();
        for (const msg of messages) {
          store.receiveMessage(msg);
        }
        void store.loadConversations();
      });
    });

    // 群组事件：被邀请入群 → 刷新会话列表
    socket.on('group:invited', () => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().loadConversations();
      });
    });

    // 群组事件：被踢出群 → 移除会话
    socket.on('group:kicked', (data) => {
      import('./useChatStore').then(({ useChatStore }) => {
        const store = useChatStore.getState();
        useChatStore.setState((state) => ({
          conversations: state.conversations.filter((c) => c.id !== data.conversationId),
          currentConversationId:
            state.currentConversationId === data.conversationId
              ? null
              : state.currentConversationId,
        }));
        // 如果当前正在看被踢的群，重新加载
        if (store.currentConversationId === data.conversationId) {
          void store.loadConversations();
        }
      });
    });

    // 群组事件：新成员加入
    socket.on('group:member_added', () => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().loadConversations();
      });
    });

    // 群组事件：成员被移除
    socket.on('group:member_removed', () => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().loadConversations();
      });
    });

    // 群组事件：群组已解散 → 移除会话（逻辑同 group:kicked）
    socket.on('group:dissolved', (data) => {
      import('./useChatStore').then(({ useChatStore }) => {
        const store = useChatStore.getState();
        useChatStore.setState((state) => ({
          conversations: state.conversations.filter((c) => c.id !== data.conversationId),
          currentConversationId:
            state.currentConversationId === data.conversationId
              ? null
              : state.currentConversationId,
        }));
        if (store.currentConversationId === data.conversationId) {
          void store.loadConversations();
        }
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
