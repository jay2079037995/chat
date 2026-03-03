/**
 * 聊天状态管理 (Zustand Store)
 *
 * 管理会话列表、当前会话、消息缓存和未读计数。
 */
import { create } from 'zustand';
import type { Message, MessageType } from '@chat/shared';
import { MESSAGES_PER_PAGE } from '@chat/shared';
import { chatService, type ConversationWithUnread } from '../services/chatService';
import { groupService } from '../services/groupService';
import { useSocketStore } from './useSocketStore';
import { cacheService } from '../../../services/cacheService';

interface ChatState {
  /** 会话列表（含未读计数） */
  conversations: ConversationWithUnread[];
  /** 当前选中的会话 ID */
  currentConversationId: string | null;
  /** 消息缓存：convId → Message[] */
  messages: Record<string, Message[]>;
  /** 参与者用户名映射：userId → username */
  participantNames: Record<string, string>;
  /** 群组名称映射：groupId → groupName */
  groupNames: Record<string, string>;
  /** 机器人用户 ID 集合 */
  botUserIds: Set<string>;
  /** 是否正在加载 */
  loading: boolean;
  /** 各会话是否还有更多历史消息 */
  hasMore: Record<string, boolean>;
  /** 是否正在加载历史消息 */
  loadingMore: boolean;
  /** 当前正在回复的消息（引用回复） */
  replyingTo: Message | null;
  /** 各参与者的最后已读时间戳：convId → { userId → timestamp } */
  lastReadMap: Record<string, Record<string, number>>;
  /** 正在输入的用户：convId → Set<userId> */
  typingUsers: Record<string, Set<string>>;
  /** 参与者头像映射：userId → avatarUrl */
  participantAvatars: Record<string, string>;
  /** 置顶会话 ID 集合 */
  pinnedIds: Set<string>;
  /** 免打扰会话 ID 集合 */
  mutedIds: Set<string>;
  /** 归档会话 ID 集合 */
  archivedIds: Set<string>;
  /** 会话标签映射：convId → string[] */
  convTags: Record<string, string[]>;
  /** 当前会话的置顶消息列表 */
  pinnedMessages: Message[];
  /** 当前标签筛选（空=不筛选） */
  tagFilter: string;
  /** 是否显示归档列表 */
  showArchived: boolean;

  /** 加载用户的会话列表 */
  loadConversations: () => Promise<void>;
  /** 选择会话（加载消息 + 标记已读） */
  selectConversation: (conversationId: string) => Promise<void>;
  /** 发送消息 */
  sendMessage: (content: string, type?: MessageType, metadata?: {
    fileName?: string; fileSize?: number; mimeType?: string; codeLanguage?: string;
  }) => void;
  /** 接收消息（由 useSocketStore 调用） */
  receiveMessage: (message: Message) => void;
  /** 创建/进入私聊 */
  startPrivateChat: (targetUserId: string) => Promise<void>;
  /** 创建群组 */
  createGroup: (name: string, memberIds: string[]) => Promise<void>;
  /** 加载更多历史消息（上滑分页） */
  loadMoreMessages: (conversationId: string) => Promise<void>;
  /** 处理已读回执 */
  handleReadReceipt: (conversationId: string, userId: string, lastReadAt?: number) => void;
  /** 更新已读时间戳 */
  updateLastRead: (conversationId: string, userId: string, timestamp: number) => void;
  /** 设置用户输入状态 */
  setTypingUser: (conversationId: string, userId: string, isTyping: boolean) => void;
  /** 从本地缓存加载数据（启动时调用） */
  loadFromCache: () => void;
  /** 设置正在回复的消息 */
  setReplyingTo: (message: Message | null) => void;
  /** 处理消息撤回事件 */
  handleRecalled: (messageId: string, conversationId: string) => void;
  /** 处理消息编辑事件 */
  handleEdited: (messageId: string, conversationId: string, newContent: string, editedAt: number) => void;
  /** 处理消息表情回应事件 */
  handleReacted: (messageId: string, conversationId: string, reactions: Record<string, string[]>) => void;
  /** 切换置顶会话 */
  togglePinConversation: (conversationId: string) => Promise<void>;
  /** 切换免打扰会话 */
  toggleMuteConversation: (conversationId: string) => Promise<void>;
  /** 切换归档会话 */
  toggleArchiveConversation: (conversationId: string) => Promise<void>;
  /** 删除会话 */
  deleteConversation: (conversationId: string) => Promise<void>;
  /** 设置会话标签 */
  setConversationTags: (conversationId: string, tags: string[]) => Promise<void>;
  /** 加载当前会话的置顶消息 */
  loadPinnedMessages: (conversationId: string) => Promise<void>;
  /** 转发消息 */
  forwardMessage: (messageId: string, targetConversationId: string) => Promise<void>;
  /** 处理消息置顶事件 */
  handleMessagePinned: (conversationId: string, messageId: string, pinned: boolean) => void;
  /** 设置标签筛选 */
  setTagFilter: (tag: string) => void;
  /** 切换归档列表显示 */
  setShowArchived: (show: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: {},
  participantNames: {},
  groupNames: {},
  botUserIds: new Set(),
  loading: false,
  hasMore: {},
  loadingMore: false,
  replyingTo: null,
  lastReadMap: {},
  typingUsers: {},
  participantAvatars: {},
  pinnedIds: new Set(),
  mutedIds: new Set(),
  archivedIds: new Set(),
  convTags: {},
  pinnedMessages: [],
  tagFilter: '',
  showArchived: false,

  loadConversations: async () => {
    try {
      const { conversations, participantNames, groupNames, botUserIds, lastReadMap, participantAvatars, pinnedIds, mutedIds, archivedIds, tags } = await chatService.getConversations();
      set((state) => ({
        conversations,
        participantNames: { ...state.participantNames, ...participantNames },
        groupNames: { ...state.groupNames, ...groupNames },
        botUserIds: botUserIds ? new Set([...state.botUserIds, ...botUserIds]) : state.botUserIds,
        lastReadMap: lastReadMap ? { ...state.lastReadMap, ...lastReadMap } : state.lastReadMap,
        participantAvatars: participantAvatars ? { ...state.participantAvatars, ...participantAvatars } : state.participantAvatars,
        pinnedIds: pinnedIds ? new Set(pinnedIds) : state.pinnedIds,
        mutedIds: mutedIds ? new Set(mutedIds) : state.mutedIds,
        archivedIds: archivedIds ? new Set(archivedIds) : state.archivedIds,
        convTags: tags || state.convTags,
      }));
      // 缓存会话列表到 localStorage
      cacheService.saveConversations({ conversations, participantNames, groupNames });
    } catch (err) {
      console.error('加载会话列表失败:', err);
    }
  },

  selectConversation: async (conversationId: string) => {
    set({ currentConversationId: conversationId, loading: true });

    // 加入 Socket 房间
    const { socket } = useSocketStore.getState();
    socket?.emit('conversation:join', conversationId);

    try {
      // 加载消息
      const msgs = await chatService.getMessages(conversationId);
      const reversed = msgs.reverse();
      set((state) => ({
        messages: { ...state.messages, [conversationId]: reversed },
        hasMore: { ...state.hasMore, [conversationId]: msgs.length >= MESSAGES_PER_PAGE },
        loading: false,
      }));
      // 缓存消息到 localStorage
      cacheService.saveMessages(conversationId, reversed);

      // 标记已读
      await chatService.markAsRead(conversationId);
      socket?.emit('message:read', { conversationId });

      // 更新未读计数
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c,
        ),
      }));
    } catch (err) {
      // 加载失败时尝试从缓存读取
      const cachedMsgs = cacheService.getMessages(conversationId);
      if (cachedMsgs) {
        set((state) => ({
          messages: { ...state.messages, [conversationId]: cachedMsgs },
          loading: false,
        }));
      } else {
        set({ loading: false });
      }
      console.error('加载消息失败:', err);
    }
  },

  sendMessage: (content: string, type: MessageType = 'text', metadata?) => {
    const { currentConversationId, replyingTo } = get();
    if (!currentConversationId || !content.trim()) return;

    const { socket, isOnline } = useSocketStore.getState();

    // 离线或未连接时加入离线队列
    if (!socket?.connected || !isOnline) {
      import('../../../services/offlineQueue').then(({ offlineQueue }) => {
        offlineQueue.enqueue({
          conversationId: currentConversationId,
          type,
          content: content.trim(),
          ...metadata,
          ...(replyingTo && { replyTo: replyingTo.id }),
        });
      });
      if (replyingTo) set({ replyingTo: null });
      return;
    }

    socket.emit(
      'message:send',
      {
        conversationId: currentConversationId,
        type,
        content: content.trim(),
        ...metadata,
        // 引用回复：附带被回复消息的 ID
        ...(replyingTo && { replyTo: replyingTo.id }),
      },
      (message: Message) => {
        // callback：服务端确认后追加消息
        set((state) => {
          const convMsgs = state.messages[currentConversationId] || [];
          return {
            messages: {
              ...state.messages,
              [currentConversationId]: [...convMsgs, message],
            },
            conversations: state.conversations.map((c) =>
              c.id === currentConversationId
                ? { ...c, lastMessage: message, updatedAt: message.createdAt }
                : c,
            ),
          };
        });
        // 更新消息缓存
        cacheService.saveMessages(currentConversationId, get().messages[currentConversationId] || []);
      },
    );

    // 发送后清除引用状态
    if (replyingTo) {
      set({ replyingTo: null });
    }
  },

  receiveMessage: (message: Message) => {
    const { currentConversationId } = get();

    const conversationExists = get().conversations.some(
      (c) => c.id === message.conversationId,
    );

    set((state) => {
      const convMsgs = state.messages[message.conversationId] || [];
      const updatedMessages = {
        ...state.messages,
        [message.conversationId]: [...convMsgs, message],
      };

      let conversations = state.conversations.map((c) => {
        if (c.id === message.conversationId) {
          return {
            ...c,
            lastMessage: message,
            updatedAt: message.createdAt,
            unreadCount:
              message.conversationId === currentConversationId
                ? c.unreadCount
                : c.unreadCount + 1,
          };
        }
        return c;
      });

      conversations = conversations.sort((a, b) => b.updatedAt - a.updatedAt);

      return { messages: updatedMessages, conversations };
    });

    // 更新消息缓存
    cacheService.saveMessages(message.conversationId, get().messages[message.conversationId] || []);

    // 新会话：从服务端拉取完整会话列表以获取新会话信息
    if (!conversationExists) {
      void get().loadConversations();
    }

    // 当前会话自动标记已读
    if (message.conversationId === currentConversationId) {
      const { socket } = useSocketStore.getState();
      void chatService.markAsRead(message.conversationId);
      socket?.emit('message:read', { conversationId: message.conversationId });
    }
  },

  startPrivateChat: async (targetUserId: string) => {
    try {
      console.log('[Chat] 创建私聊, targetUserId:', targetUserId);
      const { conversation, participantNames } =
        await chatService.createPrivateConversation(targetUserId);
      console.log('[Chat] 私聊已创建, conversationId:', conversation.id);

      set((state) => {
        const exists = state.conversations.some((c) => c.id === conversation.id);
        return {
          participantNames: { ...state.participantNames, ...participantNames },
          conversations: exists
            ? state.conversations
            : [{ ...conversation, unreadCount: 0 }, ...state.conversations],
        };
      });

      await get().selectConversation(conversation.id);
    } catch (err) {
      console.error('[Chat] 创建私聊失败:', err);
    }
  },

  createGroup: async (name: string, memberIds: string[]) => {
    try {
      const { group, conversation, participantNames } = await groupService.createGroup(name, memberIds);

      set((state) => ({
        participantNames: { ...state.participantNames, ...participantNames },
        groupNames: { ...state.groupNames, [group.id]: group.name },
        conversations: [{ ...conversation, unreadCount: 0 }, ...state.conversations],
      }));

      await get().selectConversation(conversation.id);
    } catch (err) {
      console.error('创建群组失败:', err);
      throw err;
    }
  },

  loadMoreMessages: async (conversationId: string) => {
    const { hasMore, loadingMore, messages } = get();
    if (!hasMore[conversationId] || loadingMore) return;

    set({ loadingMore: true });

    try {
      const currentMsgs = messages[conversationId] || [];
      const offset = currentMsgs.length;
      const olderMsgs = await chatService.getMessages(conversationId, offset);

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: [...olderMsgs.reverse(), ...currentMsgs],
        },
        hasMore: {
          ...state.hasMore,
          [conversationId]: olderMsgs.length >= MESSAGES_PER_PAGE,
        },
        loadingMore: false,
      }));
    } catch (err) {
      console.error('加载历史消息失败:', err);
      set({ loadingMore: false });
    }
  },

  handleReadReceipt: (conversationId: string, userId: string, lastReadAt?: number) => {
    if (lastReadAt) {
      set((state) => ({
        lastReadMap: {
          ...state.lastReadMap,
          [conversationId]: {
            ...state.lastReadMap[conversationId],
            [userId]: lastReadAt,
          },
        },
      }));
    }
  },

  updateLastRead: (conversationId: string, userId: string, timestamp: number) => {
    set((state) => ({
      lastReadMap: {
        ...state.lastReadMap,
        [conversationId]: {
          ...state.lastReadMap[conversationId],
          [userId]: timestamp,
        },
      },
    }));
  },

  setTypingUser: (conversationId: string, userId: string, isTyping: boolean) => {
    set((state) => {
      const current = state.typingUsers[conversationId] || new Set<string>();
      const next = new Set(current);
      if (isTyping) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return {
        typingUsers: { ...state.typingUsers, [conversationId]: next },
      };
    });
  },

  loadFromCache: () => {
    const cached = cacheService.getConversations();
    if (cached) {
      set((state) => ({
        conversations: cached.conversations,
        participantNames: { ...state.participantNames, ...cached.participantNames },
        groupNames: { ...state.groupNames, ...cached.groupNames },
      }));
    }
  },

  setReplyingTo: (message: Message | null) => {
    set({ replyingTo: message });
  },

  handleRecalled: (messageId: string, conversationId: string) => {
    set((state) => {
      const convMsgs = state.messages[conversationId];
      if (!convMsgs) return state;
      return {
        messages: {
          ...state.messages,
          [conversationId]: convMsgs.map((m) =>
            m.id === messageId ? { ...m, recalled: true } : m,
          ),
        },
      };
    });
  },

  handleEdited: (messageId: string, conversationId: string, newContent: string, editedAt: number) => {
    set((state) => {
      const convMsgs = state.messages[conversationId];
      if (!convMsgs) return state;
      return {
        messages: {
          ...state.messages,
          [conversationId]: convMsgs.map((m) =>
            m.id === messageId ? { ...m, content: newContent, edited: true, editedAt } : m,
          ),
        },
      };
    });
  },

  handleReacted: (messageId: string, conversationId: string, reactions: Record<string, string[]>) => {
    set((state) => {
      const convMsgs = state.messages[conversationId];
      if (!convMsgs) return state;
      return {
        messages: {
          ...state.messages,
          [conversationId]: convMsgs.map((m) =>
            m.id === messageId ? { ...m, reactions } : m,
          ),
        },
      };
    });
  },

  // --- v1.5.0 会话管理 ---

  togglePinConversation: async (conversationId: string) => {
    const { pinned } = await chatService.togglePinConversation(conversationId);
    set((state) => {
      const next = new Set(state.pinnedIds);
      pinned ? next.add(conversationId) : next.delete(conversationId);
      return { pinnedIds: next };
    });
  },

  toggleMuteConversation: async (conversationId: string) => {
    const { muted } = await chatService.toggleMuteConversation(conversationId);
    set((state) => {
      const next = new Set(state.mutedIds);
      muted ? next.add(conversationId) : next.delete(conversationId);
      return { mutedIds: next };
    });
  },

  toggleArchiveConversation: async (conversationId: string) => {
    const { archived } = await chatService.toggleArchiveConversation(conversationId);
    set((state) => {
      const next = new Set(state.archivedIds);
      archived ? next.add(conversationId) : next.delete(conversationId);
      return { archivedIds: next };
    });
  },

  deleteConversation: async (conversationId: string) => {
    await chatService.deleteConversation(conversationId);
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
      currentConversationId: state.currentConversationId === conversationId ? null : state.currentConversationId,
    }));
  },

  setConversationTags: async (conversationId: string, tags: string[]) => {
    await chatService.setConversationTags(conversationId, tags);
    set((state) => ({
      convTags: { ...state.convTags, [conversationId]: tags },
    }));
  },

  loadPinnedMessages: async (conversationId: string) => {
    try {
      const msgs = await chatService.getPinnedMessages(conversationId);
      set({ pinnedMessages: msgs });
    } catch {
      set({ pinnedMessages: [] });
    }
  },

  forwardMessage: async (messageId: string, targetConversationId: string) => {
    await chatService.forwardMessage(messageId, targetConversationId);
  },

  handleMessagePinned: (conversationId: string, _messageId: string, _pinned: boolean) => {
    const { currentConversationId, loadPinnedMessages } = get();
    if (conversationId === currentConversationId) {
      void loadPinnedMessages(conversationId);
    }
  },

  setTagFilter: (tag: string) => set({ tagFilter: tag }),

  setShowArchived: (show: boolean) => set({ showArchived: show }),
}));
