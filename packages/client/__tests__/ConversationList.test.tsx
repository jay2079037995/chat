import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ConversationList from '../src/modules/chat/components/ConversationList';

// Mock stores
const mockSelectConversation = jest.fn();
jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      conversations: [
        {
          id: 'conv1',
          type: 'private',
          participants: ['user1', 'user2'],
          lastMessage: { id: 'm1', content: '你好', createdAt: Date.now(), senderId: 'user2', conversationId: 'conv1', type: 'text' },
          updatedAt: Date.now(),
          unreadCount: 2,
        },
        {
          id: 'conv2',
          type: 'private',
          participants: ['user1', 'user3'],
          lastMessage: null,
          updatedAt: Date.now() - 1000,
          unreadCount: 0,
        },
        {
          id: 'group:g1',
          type: 'group',
          participants: ['user1', 'user2', 'user3'],
          lastMessage: { id: 'm2', content: '大家好', createdAt: Date.now() - 500, senderId: 'user2', conversationId: 'group:g1', type: 'text' },
          updatedAt: Date.now() - 500,
          unreadCount: 1,
        },
      ],
      currentConversationId: null,
      selectConversation: mockSelectConversation,
      participantNames: { user2: 'alice', user3: 'bob' },
      groupNames: { 'group:g1': '测试群组' },
    }),
}));

jest.mock('../src/modules/chat/stores/useSocketStore', () => ({
  useSocketStore: (selector: (s: any) => any) =>
    selector({
      onlineUsers: new Set(['user2']),
    }),
}));

jest.mock('../src/modules/auth/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({
      user: { id: 'user1', username: 'testuser' },
    }),
}));

const renderList = () => {
  return render(
    <ConfigProvider locale={zhCN}>
      <ConversationList />
    </ConfigProvider>,
  );
};

describe('ConversationList (v0.3.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render conversation list with user names', async () => {
    await act(async () => {
      renderList();
    });

    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('bob')).toBeDefined();
  });

  it('should show last message preview', async () => {
    await act(async () => {
      renderList();
    });

    expect(screen.getByText('你好')).toBeDefined();
    expect(screen.getByText('暂无消息')).toBeDefined();
  });

  it('should show unread badge', async () => {
    await act(async () => {
      renderList();
    });

    expect(screen.getByText('2')).toBeDefined();
  });

  it('should call selectConversation on click', async () => {
    await act(async () => {
      renderList();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('alice'));
    });

    expect(mockSelectConversation).toHaveBeenCalledWith('conv1');
  });
});

describe('ConversationList - 群组会话 (v0.5.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render group conversation with group name', async () => {
    await act(async () => {
      renderList();
    });

    expect(screen.getByText('测试群组')).toBeDefined();
  });

  it('should show sender name in group last message preview', async () => {
    await act(async () => {
      renderList();
    });

    expect(screen.getByText('alice: 大家好')).toBeDefined();
  });

  it('should call selectConversation on group click', async () => {
    await act(async () => {
      renderList();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('测试群组'));
    });

    expect(mockSelectConversation).toHaveBeenCalledWith('group:g1');
  });
});
