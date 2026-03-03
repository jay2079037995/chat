/**
 * BotLogViewer 组件测试（v1.14.0）
 *
 * 测试 LLM 调用日志查看器的渲染、日志列表、空状态、工具栏。
 */
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import BotLogViewer from '../src/modules/chat/components/BotManager/BotLogViewer';
import type { LLMCallLog } from '@chat/shared';

const mockGetBotLogs = jest.fn();
const mockClearBotLogs = jest.fn();

jest.mock('../src/modules/chat/services/botService', () => ({
  botService: {
    getBotLogs: (...args: any[]) => mockGetBotLogs(...args),
    clearBotLogs: (...args: any[]) => mockClearBotLogs(...args),
  },
}));

const mockLog: LLMCallLog = {
  id: 'log-1',
  botId: 'bot-1',
  timestamp: Date.now(),
  conversationId: 'conv-1',
  request: {
    provider: 'deepseek',
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'Hello' }],
  },
  response: { content: 'Hi there', finishReason: 'stop' },
  durationMs: 350,
};

const mockErrorLog: LLMCallLog = {
  id: 'log-2',
  botId: 'bot-1',
  timestamp: Date.now() - 1000,
  conversationId: 'conv-1',
  request: {
    provider: 'deepseek',
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'Test' }],
  },
  error: 'API key invalid',
  durationMs: 100,
};

const renderViewer = (visible = true) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <BotLogViewer
        visible={visible}
        onClose={jest.fn()}
        botId="bot-1"
        botName="testbot"
      />
    </ConfigProvider>,
  );
};

describe('BotLogViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('渲染时显示标题', async () => {
    mockGetBotLogs.mockResolvedValue({ logs: [], total: 0 });

    await act(async () => {
      renderViewer();
    });

    expect(screen.getByText('LLM 调用日志 — testbot')).toBeDefined();
  });

  test('空状态显示 "暂无日志"', async () => {
    mockGetBotLogs.mockResolvedValue({ logs: [], total: 0 });

    await act(async () => {
      renderViewer();
    });

    await waitFor(() => {
      expect(screen.getByText('暂无日志')).toBeDefined();
    });
  });

  test('有日志时显示日志条目', async () => {
    mockGetBotLogs.mockResolvedValue({ logs: [mockLog], total: 1 });

    await act(async () => {
      renderViewer();
    });

    await waitFor(() => {
      expect(screen.getByText('deepseek/deepseek-chat')).toBeDefined();
      expect(screen.getByText('350ms')).toBeDefined();
    });
  });

  test('成功日志显示成功 tag', async () => {
    mockGetBotLogs.mockResolvedValue({ logs: [mockLog], total: 1 });

    await act(async () => {
      renderViewer();
    });

    await waitFor(() => {
      expect(screen.getByText('成功')).toBeDefined();
    });
  });

  test('错误日志显示失败 tag', async () => {
    mockGetBotLogs.mockResolvedValue({ logs: [mockErrorLog], total: 1 });

    await act(async () => {
      renderViewer();
    });

    await waitFor(() => {
      expect(screen.getByText('失败')).toBeDefined();
    });
  });

  test('显示清空和刷新按钮', async () => {
    mockGetBotLogs.mockResolvedValue({ logs: [mockLog], total: 1 });

    await act(async () => {
      renderViewer();
    });

    await waitFor(() => {
      expect(screen.getByText('清空')).toBeDefined();
      expect(screen.getByText('刷新')).toBeDefined();
    });
  });

  test('不可见时不显示内容', async () => {
    mockGetBotLogs.mockResolvedValue({ logs: [], total: 0 });

    await act(async () => {
      renderViewer(false);
    });

    expect(screen.queryByText('LLM 调用日志')).toBeNull();
  });
});
