/**
 * InteractiveOptions 决策卡片组件测试
 *
 * 测试决策卡片渲染、富选项、点击交互、已选状态。
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock useChatStore
const mockSendMessage = jest.fn();
jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: {
    getState: () => ({
      sendMessage: mockSendMessage,
    }),
  },
}));

// Mock useSocketStore
const mockEmit = jest.fn();
jest.mock('../src/modules/chat/stores/useSocketStore', () => ({
  useSocketStore: {
    getState: () => ({
      socket: { emit: mockEmit },
    }),
  },
}));

import InteractiveOptions from '../src/modules/chat/components/InteractiveOptions';

describe('InteractiveOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('渲染决策卡片 — 基础选项', () => {
    render(
      <InteractiveOptions
        prompt="请选择语言"
        items={['TypeScript', 'Python', 'Go']}
        interactive={true}
      />,
    );

    expect(screen.getByText('请选择语言')).toBeDefined();
    expect(screen.getByText('TypeScript')).toBeDefined();
    expect(screen.getByText('Python')).toBeDefined();
    expect(screen.getByText('Go')).toBeDefined();
  });

  test('渲染富选项 — label + description', () => {
    render(
      <InteractiveOptions
        prompt="选择方案"
        items={['方案A', '方案B']}
        richItems={[
          { label: '方案A', description: '快速但简陋' },
          { label: '方案B', description: '完善但耗时' },
        ]}
        interactive={true}
      />,
    );

    expect(screen.getByText('方案A')).toBeDefined();
    expect(screen.getByText('快速但简陋')).toBeDefined();
    expect(screen.getByText('方案B')).toBeDefined();
    expect(screen.getByText('完善但耗时')).toBeDefined();
  });

  test('点击选项 — 发送消息 + 更新 metadata', () => {
    render(
      <InteractiveOptions
        prompt="选择"
        items={['选项A', '选项B']}
        interactive={true}
        messageId="msg-1"
        conversationId="conv-1"
      />,
    );

    fireEvent.click(screen.getByText('选项A'));

    expect(mockSendMessage).toHaveBeenCalledWith('选项A');
    expect(mockEmit).toHaveBeenCalledWith('message:update-metadata', {
      messageId: 'msg-1',
      conversationId: 'conv-1',
      metadataUpdate: { choices: { selectedIndex: 0 } },
    });
  });

  test('已选状态 — 不可再点击', () => {
    render(
      <InteractiveOptions
        prompt="选择"
        items={['选项A', '选项B']}
        selectedIndex={0}
        interactive={true}
        messageId="msg-1"
        conversationId="conv-1"
      />,
    );

    fireEvent.click(screen.getByText('选项B'));
    // 已选状态下点击无效
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('非交互模式 — 无法点击', () => {
    render(
      <InteractiveOptions
        prompt="选择"
        items={['选项A']}
        interactive={false}
      />,
    );

    fireEvent.click(screen.getByText('选项A'));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('空选项列表 — 不渲染', () => {
    const { container } = render(
      <InteractiveOptions
        prompt="选择"
        items={[]}
        interactive={true}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
