import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MessageSearch from '../src/modules/chat/components/MessageSearch';

const mockSelectConversation = jest.fn();

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      participantNames: { user1: 'Alice', user2: 'Bob' },
      groupNames: { 'group:g1': '测试群' },
      conversations: [
        { id: 'private:user1:user2', type: 'private', participants: ['user1', 'user2'], updatedAt: Date.now(), unreadCount: 0 },
        { id: 'group:g1', type: 'group', participants: ['user1', 'user2'], updatedAt: Date.now(), unreadCount: 0 },
      ],
      selectConversation: mockSelectConversation,
    }),
}));

const mockSearchMessages = jest.fn();

jest.mock('../src/modules/chat/services/chatService', () => ({
  chatService: {
    searchMessages: (...args: any[]) => mockSearchMessages(...args),
  },
}));

const mockOnClose = jest.fn();

const renderSearch = (visible = true) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <MessageSearch visible={visible} onClose={mockOnClose} />
    </ConfigProvider>,
  );
};

describe('MessageSearch (v0.6.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render search modal with input', async () => {
    await act(async () => {
      renderSearch();
    });

    expect(screen.getByText('搜索聊天记录')).toBeDefined();
    expect(screen.getByPlaceholderText('输入关键词搜索')).toBeDefined();
  });

  it('should not render when not visible', async () => {
    await act(async () => {
      renderSearch(false);
    });

    expect(screen.queryByText('搜索聊天记录')).toBeNull();
  });

  it('should show results after search', async () => {
    mockSearchMessages.mockResolvedValue([
      {
        id: 'msg1',
        conversationId: 'private:user1:user2',
        senderId: 'user1',
        type: 'text',
        content: '你好世界',
        createdAt: Date.now(),
      },
    ]);

    await act(async () => {
      renderSearch();
    });

    const input = screen.getByPlaceholderText('输入关键词搜索');
    await act(async () => {
      fireEvent.change(input, { target: { value: '你好' } });
    });

    // 触发防抖
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    // 等待搜索结果
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSearchMessages).toHaveBeenCalledWith('你好');
    expect(screen.getByText(/你好/)).toBeDefined();
  });

  it('should show empty state when no results', async () => {
    mockSearchMessages.mockResolvedValue([]);

    await act(async () => {
      renderSearch();
    });

    const input = screen.getByPlaceholderText('输入关键词搜索');
    await act(async () => {
      fireEvent.change(input, { target: { value: '不存在' } });
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('未找到相关消息')).toBeDefined();
  });
});
