/**
 * MessageContextMenu 移动端测试 (v1.8.0)
 *
 * 测试移动端底部 ActionSheet 模式和桌面端固定定位菜单模式。
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MessageContextMenu from '../src/modules/chat/components/MessageContextMenu';
import type { Message } from '@chat/shared';

// Mock useSocketStore
const mockEmit = jest.fn();
jest.mock('../src/modules/chat/stores/useSocketStore', () => ({
  useSocketStore: {
    getState: () => ({
      socket: { emit: mockEmit, connected: true },
    }),
  },
}));

// Mock useChatStore
jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: {
    getState: () => ({
      handleRecalled: jest.fn(),
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

describe('MessageContextMenu — 移动端 ActionSheet (v1.8.0)', () => {
  const onClose = jest.fn();
  const onReply = jest.fn();
  const onEdit = jest.fn();
  const position = { x: 0, y: 0 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('isMobile=true 渲染底部 ActionSheet（带遮罩和取消按钮）', async () => {
    const msg = createMessage();
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={false}
          position={position}
          isMobile={true}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    // 应有取消按钮（移动端专属）
    expect(screen.getByText('取消')).toBeDefined();
    // 应有回复按钮
    expect(screen.getByText(/回复/)).toBeDefined();
    // 应有 Reaction emoji
    expect(screen.getByText('👍')).toBeDefined();
  });

  it('isMobile=false 渲染固定定位菜单（无取消按钮）', async () => {
    const msg = createMessage();
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={false}
          position={{ x: 100, y: 200 }}
          isMobile={false}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    // 桌面端无取消按钮
    expect(screen.queryByText('取消')).toBeNull();
    // 仍有回复按钮
    expect(screen.getByText(/回复/)).toBeDefined();
  });

  it('移动端点击取消按钮关闭菜单', async () => {
    const msg = createMessage();
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={false}
          position={position}
          isMobile={true}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText('取消'));
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('移动端菜单项正常触发回复回调', async () => {
    const msg = createMessage();
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={false}
          position={position}
          isMobile={true}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/回复/));
    });

    expect(onReply).toHaveBeenCalledWith(msg);
    expect(onClose).toHaveBeenCalled();
  });

  it('移动端 Reaction emoji 正常发送', async () => {
    const msg = createMessage();
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={false}
          position={position}
          isMobile={true}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText('❤️'));
    });

    expect(mockEmit).toHaveBeenCalledWith(
      'message:react',
      { messageId: 'msg1', conversationId: 'conv1', emoji: '❤️' },
    );
    expect(onClose).toHaveBeenCalled();
  });
});
