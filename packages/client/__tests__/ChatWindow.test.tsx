import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ChatWindow from '../src/modules/chat/components/ChatWindow';

// Mock stores
const mockSendMessage = jest.fn();
jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      currentConversationId: 'conv1',
      messages: {
        conv1: [
          { id: 'm1', conversationId: 'conv1', senderId: 'user2', type: 'text', content: '你好呀', createdAt: Date.now() - 5000 },
          { id: 'm2', conversationId: 'conv1', senderId: 'user1', type: 'text', content: '你也好', createdAt: Date.now() - 3000 },
        ],
      },
      conversations: [
        { id: 'conv1', type: 'private', participants: ['user1', 'user2'], updatedAt: Date.now(), unreadCount: 0 },
      ],
      participantNames: { user2: 'alice' },
      sendMessage: mockSendMessage,
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

const renderChatWindow = () => {
  return render(
    <ConfigProvider locale={zhCN}>
      <ChatWindow />
    </ConfigProvider>,
  );
};

describe('ChatWindow (v0.3.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render chat header with user name and online status', async () => {
    await act(async () => {
      renderChatWindow();
    });

    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('在线')).toBeDefined();
  });

  it('should render messages with correct content', async () => {
    await act(async () => {
      renderChatWindow();
    });

    expect(screen.getByText('你好呀')).toBeDefined();
    expect(screen.getByText('你也好')).toBeDefined();
  });

  it('should render send button', async () => {
    await act(async () => {
      renderChatWindow();
    });

    expect(screen.getByText('发送')).toBeDefined();
  });

  it('should call sendMessage on click', async () => {
    await act(async () => {
      renderChatWindow();
    });

    const textarea = screen.getByPlaceholderText('输入消息...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '测试消息' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('发送'));
    });

    expect(mockSendMessage).toHaveBeenCalledWith('测试消息');
  });
});
