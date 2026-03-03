/**
 * InstallPrompt 组件测试 (v1.9.0)
 *
 * 验证 PWA 安装提示的显示、安装触发和关闭逻辑。
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InstallPrompt from '../src/components/InstallPrompt';

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('默认不渲染（无 beforeinstallprompt 事件）', () => {
    render(<InstallPrompt />);
    expect(screen.queryByTestId('install-prompt')).toBeNull();
  });

  it('beforeinstallprompt 事件触发后显示提示条', async () => {
    render(<InstallPrompt />);

    const mockEvent = new Event('beforeinstallprompt');
    Object.defineProperty(mockEvent, 'prompt', {
      value: jest.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(mockEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'dismissed' }),
    });

    await act(async () => {
      window.dispatchEvent(mockEvent);
    });

    expect(screen.getByTestId('install-prompt')).toBeDefined();
    expect(screen.getByText(/添加到主屏幕/)).toBeDefined();
  });

  it('点击安装按钮调用 prompt()', async () => {
    render(<InstallPrompt />);

    const mockPrompt = jest.fn().mockResolvedValue(undefined);
    const mockEvent = new Event('beforeinstallprompt');
    Object.defineProperty(mockEvent, 'prompt', { value: mockPrompt });
    Object.defineProperty(mockEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted' }),
    });

    await act(async () => {
      window.dispatchEvent(mockEvent);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('install-button'));
    });

    expect(mockPrompt).toHaveBeenCalled();
  });

  it('点击关闭按钮隐藏提示并记录', async () => {
    render(<InstallPrompt />);

    const mockEvent = new Event('beforeinstallprompt');
    Object.defineProperty(mockEvent, 'prompt', {
      value: jest.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(mockEvent, 'userChoice', {
      value: Promise.resolve({ outcome: 'dismissed' }),
    });

    await act(async () => {
      window.dispatchEvent(mockEvent);
    });

    expect(screen.getByTestId('install-prompt')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dismiss-button'));
    });

    expect(screen.queryByTestId('install-prompt')).toBeNull();
    expect(localStorage.getItem('pwa_install_dismissed')).not.toBeNull();
  });

  it('24 小时内关闭过则不显示', () => {
    localStorage.setItem('pwa_install_dismissed', String(Date.now()));
    render(<InstallPrompt />);
    expect(screen.queryByTestId('install-prompt')).toBeNull();
  });
});
