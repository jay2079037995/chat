import React from 'react';
import { render, screen } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ChatWindow from '../src/modules/chat/components/ChatWindow';

const now = Date.now();

const mockMessages = [
  { id: 'm1', conversationId: 'conv1', senderId: 'user1', type: 'text', content: '你好', createdAt: now - 5000 },
  { id: 'm2', conversationId: 'conv1', senderId: 'user1', type: 'text', content: '在吗', createdAt: now - 3000 },
  { id: 'm3', conversationId: 'conv1', senderId: 'user2', type: 'text', content: '在的', createdAt: now - 1000 },
];

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      currentConversationId: 'conv1',
      messages: { conv1: mockMessages },
      conversations: [
        { id: 'conv1', type: 'private', participants: ['user1', 'user2'], updatedAt: now, unreadCount: 0 },
      ],
      participantNames: { user1: 'testuser', user2: 'alice' },
      groupNames: {},
      botUserIds: new Set(),
      sendMessage: jest.fn(),
      hasMore: {},
      loadingMore: false,
      loadMoreMessages: jest.fn(),
      replyingTo: null,
      setReplyingTo: jest.fn(),
      lastReadMap: {
        conv1: {
          user2: now - 4000, // alice 已读到 m1（now - 5000），但 m2（now - 3000）未读
        },
      },
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

describe('ReadReceipt', () => {
  it('renders check icons for self messages in private chat', () => {
    const { container } = render(
      <ConfigProvider locale={zhCN}>
        <ChatWindow />
      </ConfigProvider>,
    );

    // CheckOutlined 图标渲染为 span.anticon.anticon-check
    const allCheckIcons = container.querySelectorAll('.anticon-check');
    // m1 已读 → 双勾 = 2 个 check
    // m2 未读 → 单勾 = 1 个 check
    // m3 是对方发的 → 无 check
    // 总共 3 个 check 图标
    expect(allCheckIcons.length).toBe(3);
  });

  it('renders messages from both self and other', () => {
    render(
      <ConfigProvider locale={zhCN}>
        <ChatWindow />
      </ConfigProvider>,
    );

    // 验证消息内容都被渲染
    expect(screen.getByText('你好')).toBeTruthy();
    expect(screen.getByText('在吗')).toBeTruthy();
    expect(screen.getByText('在的')).toBeTruthy();
  });
});
