/**
 * ChatWindow v1.3.0 集成测试
 *
 * 测试引用回复预览条的集成、发送带引用消息、取消引用、Emoji Picker 集成。
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ChatWindow from '../src/modules/chat/components/ChatWindow';
import type { Message } from '@chat/shared';

// 可变 mock 状态
const mockSendMessage = jest.fn();
const mockSetReplyingTo = jest.fn();
let mockReplyingTo: Message | null = null;

const mockMessages: Message[] = [
  { id: 'm1', conversationId: 'conv1', senderId: 'user2', type: 'text', content: '你好呀', createdAt: Date.now() - 5000 },
  { id: 'm2', conversationId: 'conv1', senderId: 'user1', type: 'text', content: '你也好', createdAt: Date.now() - 3000 },
];

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      currentConversationId: 'conv1',
      messages: { conv1: mockMessages },
      conversations: [
        { id: 'conv1', type: 'private', participants: ['user1', 'user2'], updatedAt: Date.now(), unreadCount: 0 },
      ],
      participantNames: { user2: 'alice' },
      groupNames: {},
      botUserIds: new Set(),
      sendMessage: mockSendMessage,
      hasMore: {},
      loadingMore: false,
      loadMoreMessages: jest.fn(),
      replyingTo: mockReplyingTo,
      setReplyingTo: mockSetReplyingTo,
      lastReadMap: {},
      typingUsers: {},
      participantAvatars: {},
    }),
}));

jest.mock('../src/modules/chat/stores/useSocketStore', () => ({
  useSocketStore: Object.assign(
    (selector: (s: any) => any) =>
      selector({
        onlineUsers: new Set(['user2']),
        socket: null,
      }),
    {
      getState: () => ({
        socket: { emit: jest.fn(), connected: true },
      }),
    },
  ),
}));

jest.mock('../src/modules/auth/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({
      user: { id: 'user1', username: 'testuser' },
    }),
}));

// Mock EmojiPicker 的动态依赖
jest.mock('@emoji-mart/data', () => ({ default: {} }));
jest.mock('emoji-mart', () => ({
  Picker: jest.fn().mockImplementation(function MockPicker() {
    return document.createElement('div');
  }),
}));

const renderChatWindow = () => {
  return render(
    <ConfigProvider locale={zhCN}>
      <ChatWindow />
    </ConfigProvider>,
  );
};

describe('ChatWindow v1.3.0 集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReplyingTo = null;
  });

  // ========== 引用回复 ==========
  describe('引用回复集成', () => {
    it('replyingTo 有值时显示 ReplyPreview 引用条', async () => {
      mockReplyingTo = {
        id: 'reply-target',
        conversationId: 'conv1',
        senderId: 'user2',
        type: 'text',
        content: '这条消息被引用了',
        createdAt: Date.now(),
      };

      await act(async () => {
        renderChatWindow();
      });

      expect(screen.getByText('回复 alice')).toBeDefined();
      expect(screen.getByText('这条消息被引用了')).toBeDefined();
    });

    it('replyingTo 为 null 时不显示 ReplyPreview', async () => {
      mockReplyingTo = null;

      await act(async () => {
        renderChatWindow();
      });

      expect(screen.queryByText(/^回复 /)).toBeNull();
    });

    it('点击引用条关闭按钮调用 setReplyingTo(null)', async () => {
      mockReplyingTo = {
        id: 'm1',
        conversationId: 'conv1',
        senderId: 'user2',
        type: 'text',
        content: '你好呀',
        createdAt: Date.now(),
      };

      await act(async () => {
        renderChatWindow();
      });

      // ReplyPreview 内的关闭按钮
      const closeBtn = screen.getByText('回复 alice').closest('[class*="container"]')?.querySelector('button');
      if (closeBtn) {
        await act(async () => {
          fireEvent.click(closeBtn);
        });
      }

      expect(mockSetReplyingTo).toHaveBeenCalledWith(null);
    });

    it('引用状态下发送消息调用 sendMessage', async () => {
      mockReplyingTo = {
        id: 'm1',
        conversationId: 'conv1',
        senderId: 'user2',
        type: 'text',
        content: '你好呀',
        createdAt: Date.now(),
      };

      await act(async () => {
        renderChatWindow();
      });

      const textarea = screen.getByPlaceholderText('输入消息...');
      await act(async () => {
        fireEvent.change(textarea, { target: { value: '回复你的消息' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByText('发送'));
      });

      expect(mockSendMessage).toHaveBeenCalledWith('回复你的消息');
    });
  });

  // ========== Emoji Picker 集成 ==========
  describe('Emoji Picker 集成', () => {
    it('工具栏包含 Emoji 按钮', async () => {
      await act(async () => {
        renderChatWindow();
      });

      // SmileOutlined 图标渲染为 anticon
      const emojiButtons = document.querySelectorAll('[class*="anticon-smile"]');
      expect(emojiButtons.length).toBeGreaterThan(0);
    });
  });

  // ========== 右键菜单 ==========
  describe('右键菜单集成', () => {
    it('右键消息弹出上下文菜单', async () => {
      await act(async () => {
        renderChatWindow();
      });

      // CSS module 类名被 mock 为空字符串，直接在消息文本的父 div 上触发右键
      const msgText = screen.getByText('你也好');
      const bubbleDiv = msgText.closest('div[class]') || msgText.parentElement!;
      await act(async () => {
        fireEvent.contextMenu(bubbleDiv);
      });

      // 应弹出菜单（自己的消息应能看到回复/编辑/撤回）
      expect(screen.getByText(/回复/)).toBeDefined();
    });
  });
});
