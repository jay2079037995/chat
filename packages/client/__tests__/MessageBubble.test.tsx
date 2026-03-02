/**
 * MessageBubble 组件测试 (v1.3.0)
 *
 * 测试消息气泡的撤回显示、编辑标记、引用快照和 Reactions。
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MessageBubble from '../src/modules/chat/components/MessageBubble';
import type { Message } from '@chat/shared';

/** mock socket.emit */
const mockSocketEmit = jest.fn();

// Mock useAuthStore
jest.mock('../src/modules/auth/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: () => ({
      user: { id: 'user1', username: 'testuser' },
    }),
  },
}));

// Mock useSocketStore
jest.mock('../src/modules/chat/stores/useSocketStore', () => ({
  useSocketStore: {
    getState: () => ({
      socket: { emit: mockSocketEmit, connected: true },
    }),
  },
}));

/** 创建测试消息 */
function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg1',
    conversationId: 'conv1',
    senderId: 'user1',
    type: 'text',
    content: '测试消息',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('MessageBubble (v1.3.0)', () => {
  it('正常显示文本消息', async () => {
    await act(async () => {
      render(<MessageBubble message={createMessage()} isSelf={true} />);
    });
    expect(screen.getByText('测试消息')).toBeDefined();
  });

  it('撤回消息显示撤回提示（自己）', async () => {
    const msg = createMessage({ recalled: true });
    await act(async () => {
      render(
        <MessageBubble message={msg} isSelf={true} participantNames={{ user1: 'testuser' }} />,
      );
    });
    expect(screen.getByText('你撤回了一条消息')).toBeDefined();
  });

  it('撤回消息显示撤回提示（他人）', async () => {
    const msg = createMessage({ recalled: true, senderId: 'user2' });
    await act(async () => {
      render(
        <MessageBubble message={msg} isSelf={false} participantNames={{ user2: 'alice' }} />,
      );
    });
    expect(screen.getByText('alice撤回了一条消息')).toBeDefined();
  });

  it('编辑后显示已编辑标记', async () => {
    const msg = createMessage({ edited: true, editedAt: Date.now() });
    await act(async () => {
      render(<MessageBubble message={msg} isSelf={true} />);
    });
    expect(screen.getByText('(已编辑)')).toBeDefined();
  });

  it('有引用快照时显示引用块', async () => {
    const msg = createMessage({
      replySnapshot: {
        senderId: 'user2',
        content: '被引用的消息内容',
        type: 'text',
      },
    });
    await act(async () => {
      render(
        <MessageBubble
          message={msg}
          isSelf={true}
          participantNames={{ user2: 'alice' }}
        />,
      );
    });
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('被引用的消息内容')).toBeDefined();
  });

  it('有 reactions 时显示 emoji pills', async () => {
    const msg = createMessage({
      reactions: { '👍': ['user1', 'user2'], '❤️': ['user2'] },
    });
    await act(async () => {
      render(<MessageBubble message={msg} isSelf={true} />);
    });
    expect(screen.getByText('👍')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('❤️')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
  });

  it('无 reactions 时不显示 reactions 区域', async () => {
    const msg = createMessage();
    const { container } = render(<MessageBubble message={msg} isSelf={true} />);
    // reactions bar class 不应存在
    expect(container.querySelector('[class*="reactionsBar"]')).toBeNull();
  });

  it('点击 reaction pill 触发 socket.emit toggle 自己的 reaction', async () => {
    mockSocketEmit.mockClear();
    const msg = createMessage({
      reactions: { '👍': ['user1', 'user2'], '❤️': ['user2'] },
    });

    await act(async () => {
      render(<MessageBubble message={msg} isSelf={true} />);
    });

    // 找到 👍 对应的按钮并点击
    const thumbsUpBtn = screen.getByText('👍').closest('button')!;
    await act(async () => {
      fireEvent.click(thumbsUpBtn);
    });

    // 验证 socket.emit 被调用
    expect(mockSocketEmit).toHaveBeenCalledWith('message:react', {
      messageId: 'msg1',
      conversationId: 'conv1',
      emoji: '👍',
    });
  });
});
