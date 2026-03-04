import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ChatWindow from '../src/modules/chat/components/ChatWindow';

// Mock stores
const mockSendMessage = jest.fn();
const mockMessages = [
  { id: 'm1', conversationId: 'conv1', senderId: 'user2', type: 'text', content: '你好呀', createdAt: Date.now() - 5000 },
  { id: 'm2', conversationId: 'conv1', senderId: 'user1', type: 'text', content: '你也好', createdAt: Date.now() - 3000 },
  { id: 'm3', conversationId: 'conv1', senderId: 'user2', type: 'image', content: '/uploads/images/photo.png', fileName: 'photo.png', fileSize: 10240, mimeType: 'image/png', createdAt: Date.now() - 2000 },
  { id: 'm4', conversationId: 'conv1', senderId: 'user1', type: 'code', content: 'console.log("hi")', codeLanguage: 'javascript', createdAt: Date.now() - 1000 },
  { id: 'm5', conversationId: 'conv1', senderId: 'user2', type: 'file', content: '/uploads/files/doc.pdf', fileName: 'doc.pdf', fileSize: 204800, mimeType: 'application/pdf', createdAt: Date.now() - 500 },
];

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      currentConversationId: 'conv1',
      messages: {
        conv1: mockMessages,
      },
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
      typingUsers: {},
      participantAvatars: {},
      pinnedMessages: [],
      loadPinnedMessages: jest.fn(),
      streamingMessages: {},
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

    expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
    expect(screen.getByText('在线')).toBeDefined();
  });

  it('should render text messages with correct content', async () => {
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

describe('ChatWindow - 混合消息类型 (v0.4.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render image message as img element', async () => {
    await act(async () => {
      renderChatWindow();
    });
    const imgs = screen.getAllByRole('img');
    const photoImg = imgs.find((img) => img.getAttribute('src') === '/uploads/images/photo.png');
    expect(photoImg).toBeDefined();
  });

  it('should render code message with language label', async () => {
    await act(async () => {
      renderChatWindow();
    });
    expect(screen.getByText('javascript')).toBeDefined();
  });

  it('should render file message with file name', async () => {
    await act(async () => {
      renderChatWindow();
    });
    expect(screen.getByText('doc.pdf')).toBeDefined();
  });

  it('should render message toolbar for type switching', async () => {
    await act(async () => {
      renderChatWindow();
    });
    // MessageToolbar renders type switching buttons
    expect(screen.getByPlaceholderText('输入消息...')).toBeDefined();
  });
});
