/**
 * BotStepIndicator 组件测试（v1.24.0）
 *
 * 测试步骤进度指示器的渲染、各步骤类型显示、计时器。
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import BotStepIndicator from '../src/modules/chat/components/BotStepIndicator';

describe('BotStepIndicator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('显示 generating 步骤', () => {
    render(
      <BotStepIndicator
        step="generating"
        status="start"
        timestamp={Date.now()}
      />,
    );

    expect(screen.getByText('正在生成回复')).toBeDefined();
  });

  test('显示 bash_exec 步骤及详情', () => {
    render(
      <BotStepIndicator
        step="bash_exec"
        status="start"
        detail="ls -la /home/user"
        timestamp={Date.now()}
      />,
    );

    expect(screen.getByText('正在执行命令')).toBeDefined();
    expect(screen.getByText('ls -la /home/user')).toBeDefined();
  });

  test('显示 read_file 步骤', () => {
    render(
      <BotStepIndicator
        step="read_file"
        status="start"
        detail="/path/to/file.txt"
        timestamp={Date.now()}
      />,
    );

    expect(screen.getByText('正在读取文件')).toBeDefined();
    expect(screen.getByText('/path/to/file.txt')).toBeDefined();
  });

  test('显示未知工具名称', () => {
    render(
      <BotStepIndicator
        step="custom_tool"
        status="start"
        timestamp={Date.now()}
      />,
    );

    expect(screen.getByText('正在执行 custom_tool')).toBeDefined();
  });

  test('start 状态显示计时器', () => {
    const now = Date.now();
    jest.setSystemTime(now);

    render(
      <BotStepIndicator
        step="generating"
        status="start"
        timestamp={now}
      />,
    );

    expect(screen.getByText('0s')).toBeDefined();

    // 模拟 3 秒过后
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByText('3s')).toBeDefined();
  });

  test('complete 状态不显示计时器', () => {
    render(
      <BotStepIndicator
        step="bash_exec"
        status="complete"
        timestamp={Date.now()}
      />,
    );

    expect(screen.queryByText(/\ds$/)).toBeNull();
  });

  test('error 状态不显示计时器', () => {
    render(
      <BotStepIndicator
        step="bash_exec"
        status="error"
        detail="command failed"
        timestamp={Date.now()}
      />,
    );

    expect(screen.queryByText(/\ds$/)).toBeNull();
  });

  test('长详情被截断到 60 字符', () => {
    const longDetail = 'a'.repeat(80);
    render(
      <BotStepIndicator
        step="bash_exec"
        status="start"
        detail={longDetail}
        timestamp={Date.now()}
      />,
    );

    expect(screen.getByText('a'.repeat(60) + '...')).toBeDefined();
  });
});
