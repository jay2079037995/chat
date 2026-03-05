/**
 * BotLogViewer 组件测试
 *
 * 测试日志查看器的渲染、LLM 日志 Tab、Agent 日志 Tab、空状态、工具栏。
 * v1.24.0: 新增 Agent 日志 Tab + 步骤时间线测试。
 */
import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import BotLogViewer from '../src/modules/chat/components/BotManager/BotLogViewer';
import type { LLMCallLog, AgentGenerationLog } from '@chat/shared';

const mockGetBotLogs = jest.fn();
const mockClearBotLogs = jest.fn();
const mockGetGenerationLogs = jest.fn();
const mockClearGenerationLogs = jest.fn();

jest.mock('../src/modules/chat/services/botService', () => ({
  botService: {
    getBotLogs: (...args: any[]) => mockGetBotLogs(...args),
    clearBotLogs: (...args: any[]) => mockClearBotLogs(...args),
    getGenerationLogs: (...args: any[]) => mockGetGenerationLogs(...args),
    clearGenerationLogs: (...args: any[]) => mockClearGenerationLogs(...args),
  },
}));

const mockLlmLog: LLMCallLog = {
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

const mockGenLog: AgentGenerationLog = {
  generationId: 'gen-1',
  botId: 'bot-1',
  conversationId: 'conv-1',
  startTime: Date.now(),
  totalDurationMs: 2000,
  stepCount: 2,
  success: true,
  steps: [
    {
      id: 'step-1',
      botId: 'bot-1',
      conversationId: 'conv-1',
      generationId: 'gen-1',
      stepIndex: 1,
      type: 'llm_call',
      timestamp: Date.now(),
      durationMs: 1500,
      llmInfo: { provider: 'deepseek', model: 'deepseek-chat', finishReason: 'stop' },
    },
    {
      id: 'step-2',
      botId: 'bot-1',
      conversationId: 'conv-1',
      generationId: 'gen-1',
      stepIndex: 2,
      type: 'tool_call',
      timestamp: Date.now(),
      toolName: 'bash_exec',
      toolInput: { command: 'ls' },
      toolOutput: 'file1.txt',
      durationMs: 500,
    },
  ],
};

const mockErrorGenLog: AgentGenerationLog = {
  generationId: 'gen-2',
  botId: 'bot-1',
  conversationId: 'conv-1',
  startTime: Date.now() - 1000,
  totalDurationMs: 300,
  stepCount: 1,
  success: false,
  error: 'LLM call failed',
  steps: [
    {
      id: 'step-3',
      botId: 'bot-1',
      conversationId: 'conv-1',
      generationId: 'gen-2',
      stepIndex: 1,
      type: 'error',
      timestamp: Date.now() - 1000,
      durationMs: 300,
      error: 'LLM call failed',
    },
  ],
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
    // 默认 Agent tab 先加载
    mockGetGenerationLogs.mockResolvedValue({ logs: [], total: 0 });
    mockGetBotLogs.mockResolvedValue({ logs: [], total: 0 });
  });

  test('渲染时显示标题', async () => {
    await act(async () => {
      renderViewer();
    });

    expect(screen.getByText('Bot 日志 — testbot')).toBeDefined();
  });

  test('默认显示 Agent 日志 Tab', async () => {
    await act(async () => {
      renderViewer();
    });

    expect(screen.getByText('Agent 日志')).toBeDefined();
    expect(screen.getByText('LLM 日志')).toBeDefined();
  });

  test('Agent 空状态显示 "暂无日志"', async () => {
    await act(async () => {
      renderViewer();
    });

    await waitFor(() => {
      expect(screen.getByText('暂无日志')).toBeDefined();
    });
  });

  test('Agent 日志显示生成批次信息', async () => {
    mockGetGenerationLogs.mockResolvedValue({ logs: [mockGenLog], total: 1 });

    await act(async () => {
      renderViewer();
    });

    await waitFor(() => {
      expect(screen.getByText('2000ms')).toBeDefined();
      expect(screen.getByText('2 步')).toBeDefined();
      expect(screen.getByText('成功')).toBeDefined();
    });
  });

  test('Agent 失败日志显示失败 tag', async () => {
    mockGetGenerationLogs.mockResolvedValue({ logs: [mockErrorGenLog], total: 1 });

    await act(async () => {
      renderViewer();
    });

    await waitFor(() => {
      expect(screen.getByText('失败')).toBeDefined();
    });
  });

  test('切换到 LLM 日志 Tab', async () => {
    mockGetGenerationLogs.mockResolvedValue({ logs: [], total: 0 });
    mockGetBotLogs.mockResolvedValue({ logs: [mockLlmLog], total: 1 });

    await act(async () => {
      renderViewer();
    });

    // 点击 LLM 日志 Tab
    await act(async () => {
      fireEvent.click(screen.getByText('LLM 日志'));
    });

    await waitFor(() => {
      expect(screen.getByText('deepseek/deepseek-chat')).toBeDefined();
      expect(screen.getByText('350ms')).toBeDefined();
    });
  });

  test('显示清空和刷新按钮', async () => {
    await act(async () => {
      renderViewer();
    });

    await waitFor(() => {
      expect(screen.getByText('清空')).toBeDefined();
      expect(screen.getByText('刷新')).toBeDefined();
    });
  });

  test('不可见时不显示内容', async () => {
    await act(async () => {
      renderViewer(false);
    });

    expect(screen.queryByText('Bot 日志')).toBeNull();
  });

  test('展开 Agent 日志显示步骤时间线', async () => {
    mockGetGenerationLogs.mockResolvedValue({ logs: [mockGenLog], total: 1 });

    await act(async () => {
      renderViewer();
    });

    // 点击日志条目展开
    await act(async () => {
      fireEvent.click(screen.getByText('2000ms'));
    });

    await waitFor(() => {
      // 时间线显示步骤信息
      expect(screen.getByText('#1')).toBeDefined();
      expect(screen.getByText('#2')).toBeDefined();
      expect(screen.getByText('LLM 调用')).toBeDefined();
      expect(screen.getByText('工具调用')).toBeDefined();
      expect(screen.getByText('bash_exec')).toBeDefined();
      expect(screen.getByText('1500ms')).toBeDefined();
      expect(screen.getByText('500ms')).toBeDefined();
    });
  });

  test('展开步骤显示 input/output JSON', async () => {
    mockGetGenerationLogs.mockResolvedValue({ logs: [mockGenLog], total: 1 });

    await act(async () => {
      renderViewer();
    });

    // 展开日志
    await act(async () => {
      fireEvent.click(screen.getByText('2000ms'));
    });

    // 展开工具调用步骤
    await act(async () => {
      fireEvent.click(screen.getByText('#2'));
    });

    await waitFor(() => {
      expect(screen.getByText('Input')).toBeDefined();
      expect(screen.getByText('Output')).toBeDefined();
    });
  });

  test('刷新按钮重新加载日志', async () => {
    mockGetGenerationLogs.mockResolvedValue({ logs: [], total: 0 });

    await act(async () => {
      renderViewer();
    });

    expect(mockGetGenerationLogs).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByText('刷新'));
    });

    expect(mockGetGenerationLogs).toHaveBeenCalledTimes(2);
  });

  test('LLM Tab 展开显示请求详情', async () => {
    mockGetBotLogs.mockResolvedValue({ logs: [mockLlmLog], total: 1 });

    await act(async () => {
      renderViewer();
    });

    // 切换到 LLM Tab
    await act(async () => {
      fireEvent.click(screen.getByText('LLM 日志'));
    });

    await waitFor(() => {
      expect(screen.getByText('350ms')).toBeDefined();
    });

    // 展开日志条目
    await act(async () => {
      fireEvent.click(screen.getByText('350ms'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Request Messages/)).toBeDefined();
    });
  });
});
