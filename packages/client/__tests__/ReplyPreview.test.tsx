/**
 * ReplyPreview 组件测试 (v1.3.0)
 *
 * 测试引用回复预览条的渲染和关闭功能。
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReplyPreview from '../src/modules/chat/components/ReplyPreview';
import type { Message } from '@chat/shared';

/** 创建测试消息 */
function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg1',
    conversationId: 'conv1',
    senderId: 'user1',
    type: 'text',
    content: '这是一条被回复的消息',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('ReplyPreview (v1.3.0)', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('显示发送者名称', async () => {
    const msg = createMessage();
    await act(async () => {
      render(<ReplyPreview message={msg} senderName="alice" onClose={onClose} />);
    });

    expect(screen.getByText('回复 alice')).toBeDefined();
  });

  it('显示消息内容摘要', async () => {
    const msg = createMessage({ content: '这是一条被回复的消息' });
    await act(async () => {
      render(<ReplyPreview message={msg} senderName="alice" onClose={onClose} />);
    });

    expect(screen.getByText('这是一条被回复的消息')).toBeDefined();
  });

  it('长内容截断到 80 字符', async () => {
    const longContent = '长'.repeat(100);
    const msg = createMessage({ content: longContent });
    await act(async () => {
      render(<ReplyPreview message={msg} senderName="alice" onClose={onClose} />);
    });

    // 80 个字 + "..."
    const expected = '长'.repeat(80) + '...';
    expect(screen.getByText(expected)).toBeDefined();
  });

  it('点击关闭按钮触发回调', async () => {
    const msg = createMessage();
    await act(async () => {
      render(<ReplyPreview message={msg} senderName="alice" onClose={onClose} />);
    });

    // 关闭按钮
    const closeBtn = document.querySelector('button');
    if (closeBtn) {
      await act(async () => {
        fireEvent.click(closeBtn);
      });
    }

    expect(onClose).toHaveBeenCalled();
  });
});
