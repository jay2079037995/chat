import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import BotManager from '../src/modules/chat/components/BotManager';

// Mock useIsMobile
jest.mock('../src/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

// Mock botService
const mockListBots = jest.fn();
const mockCreateBot = jest.fn();
const mockDeleteBot = jest.fn();

jest.mock('../src/modules/chat/services/botService', () => ({
  botService: {
    listBots: (...args: any[]) => mockListBots(...args),
    createBot: (...args: any[]) => mockCreateBot(...args),
    deleteBot: (...args: any[]) => mockDeleteBot(...args),
    updateBotConfig: jest.fn(),
    startBot: jest.fn(),
    stopBot: jest.fn(),
    getProviders: jest.fn(),
  },
}));

const renderBotManager = (visible = true) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <BotManager visible={visible} onClose={jest.fn()} />
    </ConfigProvider>,
  );
};

describe('BotManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListBots.mockResolvedValue([]);
  });

  it('should render drawer with title when visible', async () => {
    await act(async () => {
      renderBotManager();
    });

    expect(screen.getByText('机器人管理')).toBeDefined();
  });

  it('should render create input and button', async () => {
    await act(async () => {
      renderBotManager();
    });

    expect(screen.getByPlaceholderText('输入机器人用户名（须以 bot 结尾）')).toBeDefined();
    expect(screen.getByText('创建机器人')).toBeDefined();
  });

  it('should display bot list from API', async () => {
    mockListBots.mockResolvedValue([
      { id: 'bot-1', username: 'testbot', ownerId: 'owner-1', createdAt: Date.now() },
    ]);

    await act(async () => {
      renderBotManager();
    });

    await waitFor(() => {
      expect(screen.getByText('testbot')).toBeDefined();
    });
  });

  it('should show empty state when no bots', async () => {
    mockListBots.mockResolvedValue([]);

    await act(async () => {
      renderBotManager();
    });

    await waitFor(() => {
      expect(screen.getByText('暂无机器人')).toBeDefined();
    });
  });
});
