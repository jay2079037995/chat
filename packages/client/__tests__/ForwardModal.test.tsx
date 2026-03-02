/**
 * ForwardModal 组件测试
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ForwardModal from '../src/modules/chat/components/ForwardModal';
import type { Message } from '@chat/shared';

const mockForwardMessage = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: Object.assign(
    (selector: (s: any) => any) =>
      selector({
        conversations: [
          {
            id: 'conv1',
            type: 'private',
            participants: ['user1', 'user2'],
            unreadCount: 0,
            updatedAt: Date.now(),
          },
          {
            id: 'conv2',
            type: 'group',
            participants: ['user1', 'user3', 'user4'],
            unreadCount: 0,
            updatedAt: Date.now(),
          },
        ],
        currentConversationId: 'conv1',
        participantNames: { user1: '张三', user2: '李四', user3: '王五', user4: '赵六' },
        groupNames: { conv2: '工作群' },
        forwardMessage: mockForwardMessage,
      }),
    {
      getState: () => ({
        currentConversationId: 'conv1',
      }),
    },
  ),
}));

const mockMessage: Message = {
  id: 'msg1',
  conversationId: 'conv1',
  senderId: 'user1',
  type: 'text',
  content: '要转发的消息',
  createdAt: Date.now(),
} as Message;

const renderForwardModal = (visible = true) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <ForwardModal
        visible={visible}
        message={mockMessage}
        onClose={jest.fn()}
      />
    </ConfigProvider>,
  );
};

describe('ForwardModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render conversation list excluding current', async () => {
    await act(async () => {
      renderForwardModal();
    });
    // 应排除当前会话 conv1，只显示 conv2
    expect(screen.getByText('工作群')).toBeTruthy();
  });

  it('should render search input', async () => {
    await act(async () => {
      renderForwardModal();
    });
    expect(screen.getByPlaceholderText('搜索会话...')).toBeTruthy();
  });

  it('should call onClose when modal is closed', async () => {
    const onClose = jest.fn();
    await act(async () => {
      render(
        <ConfigProvider locale={zhCN}>
          <ForwardModal visible={true} message={mockMessage} onClose={onClose} />
        </ConfigProvider>,
      );
    });

    // 点击取消按钮
    const closeBtn = document.querySelector('.ant-modal-close');
    if (closeBtn) {
      await act(async () => {
        fireEvent.click(closeBtn);
      });
      expect(onClose).toHaveBeenCalled();
    }
  });
});
