import React from 'react';
import { render, screen } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ChatWindow from '../src/modules/chat/components/ChatWindow';

const mockSendMessage = jest.fn();

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      currentConversationId: 'conv1',
      messages: { conv1: [] },
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
      replyingTo: null,
      setReplyingTo: jest.fn(),
      lastReadMap: {},
      typingUsers: { conv1: new Set(['user2']) },
      participantAvatars: {},
      pinnedMessages: [],
      loadPinnedMessages: jest.fn(),
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
        socket: { connected: true, emit: jest.fn() },
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

const renderWindow = () =>
  render(
    <ConfigProvider locale={zhCN}>
      <ChatWindow />
    </ConfigProvider>,
  );

describe('TypingIndicator', () => {
  it('shows typing indicator when someone is typing', () => {
    renderWindow();
    expect(screen.getByText('alice 正在输入...')).toBeTruthy();
  });
});
