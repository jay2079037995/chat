/**
 * MessageContextMenu 组件测试 (v1.3.0)
 *
 * 测试右键菜单的显示逻辑、菜单项可见性、撤回/编辑/回复操作。
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
const mockHandleRecalled = jest.fn();
jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: {
    getState: () => ({
      handleRecalled: mockHandleRecalled,
    }),
  },
}));

// Mock antd message
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: { error: jest.fn() },
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

describe('MessageContextMenu (v1.3.0)', () => {
  const onClose = jest.fn();
  const onReply = jest.fn();
  const onEdit = jest.fn();
  const position = { x: 100, y: 200 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('已撤回消息不显示菜单', () => {
    const msg = createMessage({ recalled: true });
    const { container } = render(
      <MessageContextMenu
        message={msg}
        isSelf={true}
        position={position}
        onClose={onClose}
        onReply={onReply}
        onEdit={onEdit}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('自己消息显示撤回和编辑选项', async () => {
    const msg = createMessage();
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={true}
          position={position}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    expect(screen.getByText(/回复/)).toBeDefined();
    expect(screen.getByText(/编辑/)).toBeDefined();
    expect(screen.getByText(/撤回/)).toBeDefined();
  });

  it('他人消息不显示撤回和编辑', async () => {
    const msg = createMessage({ senderId: 'other' });
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={false}
          position={position}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    expect(screen.getByText(/回复/)).toBeDefined();
    expect(screen.queryByText(/编辑/)).toBeNull();
    expect(screen.queryByText(/撤回/)).toBeNull();
  });

  it('非文本类型消息不显示编辑选项', async () => {
    const msg = createMessage({ type: 'image', content: '/uploads/test.jpg' });
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={true}
          position={position}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    expect(screen.queryByText(/编辑/)).toBeNull();
  });

  it('点击回复触发回调', async () => {
    const msg = createMessage();
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={false}
          position={position}
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

  it('点击撤回触发 socket 调用', async () => {
    const msg = createMessage();
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={true}
          position={position}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/撤回/));
    });

    expect(mockEmit).toHaveBeenCalledWith(
      'message:recall',
      { messageId: 'msg1', conversationId: 'conv1' },
      expect.any(Function),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('撤回成功后更新发送者本地消息状态', async () => {
    // 让 mockEmit 在被调用时立即执行 callback({ success: true })
    mockEmit.mockImplementation((_event: string, _data: unknown, cb?: (r: { success: boolean }) => void) => {
      if (cb) cb({ success: true });
    });

    const msg = createMessage();
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={true}
          position={position}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/撤回/));
    });

    // 验证撤回成功后调用 handleRecalled 更新本地状态
    expect(mockHandleRecalled).toHaveBeenCalledWith('msg1', 'conv1');

    // 清理 mockEmit 的实现
    mockEmit.mockReset();
  });

  it('显示 6 个快捷 Reaction 按钮', async () => {
    const msg = createMessage();
    await act(async () => {
      render(
        <MessageContextMenu
          message={msg}
          isSelf={false}
          position={position}
          onClose={onClose}
          onReply={onReply}
          onEdit={onEdit}
        />,
      );
    });

    expect(screen.getByText('👍')).toBeDefined();
    expect(screen.getByText('❤️')).toBeDefined();
    expect(screen.getByText('😂')).toBeDefined();
    expect(screen.getByText('🎉')).toBeDefined();
    expect(screen.getByText('😮')).toBeDefined();
    expect(screen.getByText('😢')).toBeDefined();
  });
});
