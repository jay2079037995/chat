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

/** 网络监听器清理函数 */
let networkCleanup: (() => void) | null = null;

interface SocketState {
  /** Socket.IO 客户端实例 */
  socket: TypedSocket | null;
  /** 是否已连接 */
  connected: boolean;
  /** 在线用户 ID 集合 */
  onlineUsers: Set<string>;
  /** 浏览器网络状态 */
  isOnline: boolean;

  /** 建立 Socket 连接（传入 sessionId 用于认证） */
  connect: (sessionId: string) => void;
  /** 断开连接 */
  disconnect: () => void;
  /** 开始监听网络状态变化 */
  startNetworkListener: () => void;
  /** 停止监听网络状态变化 */
  stopNetworkListener: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  onlineUsers: new Set(),
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  connect: (sessionId: string) => {
    const { socket: existing } = get();
    if (existing?.connected) return;

    // 断开旧连接
    existing?.disconnect();

    /** Electron 打包后从本地文件加载，Socket 需指向服务端地址 */
    const serverUrl = (window as any).electronAPI?.serverUrl || '';

    const socket: TypedSocket = io(serverUrl || undefined, {
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
      // 连接成功后刷新离线消息队列
      import('../../../services/offlineQueue').then(({ offlineQueue }) => {
        if (offlineQueue.isEmpty()) return;
        void offlineQueue.flush((msg) => {
          return new Promise<boolean>((resolve) => {
            socket.emit(
              'message:send',
              {
                conversationId: msg.conversationId,
                type: msg.type,
                content: msg.content,
                ...(msg.fileName && { fileName: msg.fileName }),
                ...(msg.fileSize && { fileSize: msg.fileSize }),
                ...(msg.mimeType && { mimeType: msg.mimeType }),
                ...(msg.codeLanguage && { codeLanguage: msg.codeLanguage }),
                ...(msg.replyTo && { replyTo: msg.replyTo }),
              },
              (message) => {
                import('./useChatStore').then(({ useChatStore }) => {
                  useChatStore.getState().receiveMessage(message);
                });
                resolve(true);
              },
            );
            setTimeout(() => resolve(false), 3000);
          });
        });
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
        const store = useChatStore.getState();
        store.receiveMessage(message);

        // 浏览器通知：非当前会话 + 页面非聚焦时弹出（免打扰会话不通知）
        const isMuted = store.mutedIds.has(message.conversationId);
        if (!isMuted && (message.conversationId !== store.currentConversationId || document.hidden)) {
          import('../utils/notification').then(({ showBrowserNotification }) => {
            const senderName = store.participantNames[message.senderId] || message.senderId;
            const body = message.type === 'text'
              ? message.content
              : message.type === 'image' ? '[图片]'
              : message.type === 'audio' ? '[语音]'
              : message.type === 'file' ? '[文件]'
              : message.content;
            showBrowserNotification(senderName, body, message.conversationId);
          });
        }
      });
    });

    // 已读回执
    socket.on('message:read', (data) => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().handleReadReceipt(data.conversationId, data.userId, data.lastReadAt);
      });
    });

    // 输入状态
    socket.on('typing:start', (data) => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().setTypingUser(data.conversationId, data.userId, true);
      });
    });

    socket.on('typing:stop', (data) => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().setTypingUser(data.conversationId, data.userId, false);
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

    // 消息撤回事件
    socket.on('message:recalled', (data) => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().handleRecalled(data.messageId, data.conversationId);
      });
    });

    // 消息编辑事件
    socket.on('message:edited', (data) => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().handleEdited(data.messageId, data.conversationId, data.newContent, data.editedAt);
      });
    });

    // 消息表情回应变更事件
    socket.on('message:reacted', (data) => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().handleReacted(data.messageId, data.conversationId, data.reactions);
      });
    });

    // 消息置顶事件
    socket.on('message:pinned', (data) => {
      import('./useChatStore').then(({ useChatStore }) => {
        useChatStore.getState().handleMessagePinned(data.conversationId, data.messageId, data.pinned);
      });
    });

    // @提及 通知
    socket.on('mention:notify', (data) => {
      import('antd').then(({ notification }) => {
        notification.info({
          message: `${data.senderName} @了你`,
          description: data.message.content.length > 80
            ? data.message.content.slice(0, 80) + '...'
            : data.message.content,
          duration: 5,
          placement: 'topRight',
        });
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

    // Skill 执行请求 → 转发到 Electron IPC
    import('../services/skillBridge').then(({ initSkillBridge }) => {
      initSkillBridge(socket);
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

  startNetworkListener: () => {
    const handleOnline = () => {
      console.log('[Network] 网络已恢复');
      set({ isOnline: true });
      const { socket } = get();
      if (socket && !socket.connected) {
        socket.connect();
      }
    };

    const handleOffline = () => {
      console.warn('[Network] 网络已断开');
      set({ isOnline: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    networkCleanup = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },

  stopNetworkListener: () => {
    networkCleanup?.();
    networkCleanup = null;
  },
}));
