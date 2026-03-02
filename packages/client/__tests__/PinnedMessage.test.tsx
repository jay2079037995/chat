/**
 * PinnedMessage 组件测试
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PinnedMessage from '../src/modules/chat/components/PinnedMessage';
import type { Message } from '@chat/shared';

const mockMessages: Message[] = [
  {
    id: 'pm1',
    conversationId: 'conv1',
    senderId: 'user1',
    type: 'text',
    content: '这是第一条置顶消息',
    createdAt: Date.now(),
  } as Message,
  {
    id: 'pm2',
    conversationId: 'conv1',
    senderId: 'user2',
    type: 'text',
    content: '这是第二条置顶消息的内容比较长需要截断显示以便用来测试超过五十个字符之后的截断功能是否能够正常工作的一段很长的文字消息',
    createdAt: Date.now(),
  } as Message,
];

const participantNames: Record<string, string> = {
  user1: '张三',
  user2: '李四',
};

describe('PinnedMessage', () => {
  it('should not render when messages is empty', () => {
    const { container } = render(
      <PinnedMessage messages={[]} participantNames={participantNames} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render pinned message with sender name', () => {
    render(
      <PinnedMessage messages={[mockMessages[0]]} participantNames={participantNames} />,
    );
    expect(screen.getByText('张三')).toBeTruthy();
    expect(screen.getByText('这是第一条置顶消息')).toBeTruthy();
  });

  it('should truncate long content to 50 characters', () => {
    render(
      <PinnedMessage messages={[mockMessages[1]]} participantNames={participantNames} />,
    );
    // 50 字截断 + "..."
    const preview = mockMessages[1].content.slice(0, 50) + '...';
    expect(screen.getByText(preview)).toBeTruthy();
  });

  it('should show navigation when multiple messages', () => {
    render(
      <PinnedMessage messages={mockMessages} participantNames={participantNames} />,
    );
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('should navigate between pinned messages', () => {
    render(
      <PinnedMessage messages={mockMessages} participantNames={participantNames} />,
    );
    // 初始显示第一条
    expect(screen.getByText('张三')).toBeTruthy();

    // 点击下一条
    const buttons = screen.getAllByRole('button');
    const nextBtn = buttons.find((b) => !b.hasAttribute('disabled') && b.querySelector('span'));
    if (nextBtn) fireEvent.click(nextBtn);

    expect(screen.getByText('2/2')).toBeTruthy();
    expect(screen.getByText('李四')).toBeTruthy();
  });

  it('should call onUnpin callback', () => {
    const onUnpin = jest.fn();
    render(
      <PinnedMessage
        messages={[mockMessages[0]]}
        participantNames={participantNames}
        onUnpin={onUnpin}
      />,
    );

    // 找到关闭按钮并点击
    const closeBtn = screen.getByTitle('取消置顶');
    fireEvent.click(closeBtn);
    expect(onUnpin).toHaveBeenCalledWith('pm1');
  });
});
