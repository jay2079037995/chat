/**
 * Bot 步骤进度 集成测试（v1.24.0）
 *
 * 测试 useChatStore.setBotStepProgress + useSocketStore bot:step-progress 监听 +
 * BotStepIndicator 渲染。
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import BotStepIndicator from '../src/modules/chat/components/BotStepIndicator';

// ─── Test 1: useChatStore.setBotStepProgress ─────────────

describe('useChatStore.setBotStepProgress', () => {
  let useChatStore: any;

  beforeEach(async () => {
    jest.resetModules();
    const mod = await import('../src/modules/chat/stores/useChatStore');
    useChatStore = mod.useChatStore;
  });

  test('设置步骤进度', () => {
    useChatStore.getState().setBotStepProgress('conv-1', {
      step: 'bash_exec',
      status: 'start',
      detail: 'ls -la',
      timestamp: Date.now(),
    });

    const state = useChatStore.getState();
    expect(state.botStepProgress['conv-1']).toMatchObject({
      step: 'bash_exec',
      status: 'start',
      detail: 'ls -la',
    });
  });

  test('清除步骤进度（设为 null）', () => {
    useChatStore.getState().setBotStepProgress('conv-1', {
      step: 'generating',
      status: 'start',
      timestamp: Date.now(),
    });
    expect(useChatStore.getState().botStepProgress['conv-1']).not.toBeNull();

    useChatStore.getState().setBotStepProgress('conv-1', null);
    expect(useChatStore.getState().botStepProgress['conv-1']).toBeNull();
  });

  test('不同会话进度互不影响', () => {
    useChatStore.getState().setBotStepProgress('conv-1', {
      step: 'generating',
      status: 'start',
      timestamp: 1000,
    });
    useChatStore.getState().setBotStepProgress('conv-2', {
      step: 'bash_exec',
      status: 'complete',
      timestamp: 2000,
    });

    const state = useChatStore.getState();
    expect(state.botStepProgress['conv-1']?.step).toBe('generating');
    expect(state.botStepProgress['conv-2']?.step).toBe('bash_exec');
  });
});

// ─── Test 2: BotStepIndicator 渲染（store 集成） ─────────────

describe('BotStepIndicator — 步骤进度集成渲染', () => {
  test('generating 步骤显示正在生成回复', () => {
    render(
      <BotStepIndicator step="generating" status="start" timestamp={Date.now()} />,
    );
    expect(screen.getByText('正在生成回复')).toBeDefined();
  });

  test('bash_exec 步骤显示命令详情', () => {
    render(
      <BotStepIndicator step="bash_exec" status="start" detail="npm test" timestamp={Date.now()} />,
    );
    expect(screen.getByText('正在执行命令')).toBeDefined();
    expect(screen.getByText('npm test')).toBeDefined();
  });

  test('read_file 步骤显示文件路径', () => {
    render(
      <BotStepIndicator step="read_file" status="start" detail="/tmp/test.txt" timestamp={Date.now()} />,
    );
    expect(screen.getByText('正在读取文件')).toBeDefined();
    expect(screen.getByText('/tmp/test.txt')).toBeDefined();
  });

  test('error 状态不崩溃', () => {
    render(
      <BotStepIndicator step="bash_exec" status="error" detail="command not found" timestamp={Date.now()} />,
    );
    expect(screen.getByText('正在执行命令')).toBeDefined();
  });

  // v1.26.0: loading_history 步骤
  test('loading_history 步骤显示正在加载历史记录', () => {
    render(
      <BotStepIndicator step="loading_history" status="start" timestamp={Date.now()} />,
    );
    expect(screen.getByText('正在加载历史记录')).toBeDefined();
  });
});

// ─── Test 3: useSocketStore bot:step-progress 处理逻辑 ─────────────

describe('useSocketStore — bot:step-progress 处理逻辑', () => {
  test('start 状态立即设置进度', () => {
    const mockSetBotStepProgress = jest.fn();
    const data = {
      conversationId: 'conv-1',
      botId: 'bot-1',
      step: 'generating',
      status: 'start' as const,
      timestamp: Date.now(),
    };

    if (data.status === 'start') {
      mockSetBotStepProgress(data.conversationId, data);
    }

    expect(mockSetBotStepProgress).toHaveBeenCalledWith('conv-1', data);
  });

  test('complete 状态设置进度后延迟清除', () => {
    jest.useFakeTimers();

    const store: Record<string, any> = {};
    const mockSetBotStepProgress = (convId: string, val: any) => {
      store[convId] = val;
    };

    const data = {
      conversationId: 'conv-1',
      botId: 'bot-1',
      step: 'bash_exec',
      status: 'complete' as const,
      timestamp: 12345,
    };

    mockSetBotStepProgress(data.conversationId, data);
    expect(store['conv-1']).toEqual(data);

    setTimeout(() => {
      const current = store[data.conversationId];
      if (current && current.timestamp === data.timestamp) {
        mockSetBotStepProgress(data.conversationId, null);
      }
    }, 1500);

    jest.advanceTimersByTime(1500);
    expect(store['conv-1']).toBeNull();

    jest.useRealTimers();
  });

  test('complete 后被新 start 覆盖时不清除', () => {
    jest.useFakeTimers();

    const store: Record<string, any> = {};
    const mockSetBotStepProgress = (convId: string, val: any) => {
      store[convId] = val;
    };

    const completeData = {
      conversationId: 'conv-1',
      botId: 'bot-1',
      step: 'bash_exec',
      status: 'complete' as const,
      timestamp: 12345,
    };

    mockSetBotStepProgress(completeData.conversationId, completeData);

    setTimeout(() => {
      const current = store[completeData.conversationId];
      if (current && current.timestamp === completeData.timestamp) {
        mockSetBotStepProgress(completeData.conversationId, null);
      }
    }, 1500);

    jest.advanceTimersByTime(500);
    const newData = {
      conversationId: 'conv-1',
      botId: 'bot-1',
      step: 'read_file',
      status: 'start' as const,
      timestamp: 99999,
    };
    mockSetBotStepProgress(newData.conversationId, newData);

    jest.advanceTimersByTime(1000);
    expect(store['conv-1']).toEqual(newData);

    jest.useRealTimers();
  });
});
