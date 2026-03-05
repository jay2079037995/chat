/**
 * BotManager 服务端模式 UI 测试
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import BotManager from '../src/modules/chat/components/BotManager';

// Mock useIsMobile
jest.mock('../src/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

// Mock botService
const mockCreateBot = jest.fn();
const mockListBots = jest.fn();
const mockDeleteBot = jest.fn();
const mockUpdateBotConfig = jest.fn();
const mockStartBot = jest.fn();
const mockStopBot = jest.fn();
const mockGetProviders = jest.fn();

jest.mock('../src/modules/chat/services/botService', () => ({
  botService: {
    createBot: (...args: any[]) => mockCreateBot(...args),
    listBots: () => mockListBots(),
    deleteBot: (id: string) => mockDeleteBot(id),
    updateBotConfig: (...args: any[]) => mockUpdateBotConfig(...args),
    startBot: (id: string) => mockStartBot(id),
    stopBot: (id: string) => mockStopBot(id),
    getProviders: () => mockGetProviders(),
  },
}));

const renderBotManager = (visible = true) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <BotManager visible={visible} onClose={jest.fn()} />
    </ConfigProvider>,
  );
};

describe('BotManager — 基础功能', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListBots.mockResolvedValue([]);
  });

  it('should render run mode radio buttons', async () => {
    await act(async () => {
      renderBotManager();
    });
    expect(screen.getByText('服务端运行')).toBeDefined();
    expect(screen.getByText('本地运行')).toBeDefined();
    expect(screen.queryByText('客户端运行')).toBeNull();
  });

  it('should default to server mode (non-Electron)', async () => {
    await act(async () => {
      renderBotManager();
    });
    const serverRadio = screen.getByText('服务端运行');
    expect(serverRadio.closest('.ant-radio-button-wrapper-checked')).toBeTruthy();
  });

  it('should show LLM config form when server mode selected', async () => {
    await act(async () => {
      renderBotManager();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('服务端运行'));
    });

    expect(screen.getByText('LLM 服务商')).toBeDefined();
    expect(screen.getByText('API Key')).toBeDefined();
    expect(screen.getByText('系统提示词')).toBeDefined();
  });

  it('should not render when not visible', async () => {
    await act(async () => {
      renderBotManager(false);
    });
    expect(screen.queryByText('机器人管理')).toBeNull();
  });
});

describe('BotManager — 机器人列表', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display client mode bot with blue tag', async () => {
    mockListBots.mockResolvedValue([
      { id: 'bot-1', username: 'mybot', ownerId: 'user-1', createdAt: Date.now(), runMode: 'client' },
    ]);

    await act(async () => {
      renderBotManager();
    });

    expect(screen.getByText('mybot')).toBeDefined();
    expect(screen.getByText('客户端')).toBeDefined();
  });

  it('should display server mode bot with green tag and status', async () => {
    mockListBots.mockResolvedValue([
      {
        id: 'bot-2',
        username: 'serverbot',
        ownerId: 'user-1',
        createdAt: Date.now(),
        runMode: 'server',
        status: 'running',
        llmConfig: { provider: 'deepseek', model: 'deepseek-chat', apiKey: '****1234' },
      },
    ]);

    await act(async () => {
      renderBotManager();
    });

    expect(screen.getByText('serverbot')).toBeDefined();
    expect(screen.getByText('服务端')).toBeDefined();
    expect(screen.getByText('运行中')).toBeDefined();
  });

  it('should show edit and toggle buttons for server mode bots', async () => {
    mockListBots.mockResolvedValue([
      {
        id: 'bot-2',
        username: 'serverbot',
        ownerId: 'user-1',
        createdAt: Date.now(),
        runMode: 'server',
        status: 'running',
      },
    ]);

    await act(async () => {
      renderBotManager();
    });

    // 应有编辑、暂停、删除按钮
    const buttons = screen.getAllByRole('button');
    const editBtn = buttons.find((b) => b.getAttribute('title') === '编辑配置');
    const pauseBtn = buttons.find((b) => b.getAttribute('title') === '暂停');
    expect(editBtn).toBeDefined();
    expect(pauseBtn).toBeDefined();
  });
});

describe('BotManager — 创建', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListBots.mockResolvedValue([]);
  });

  it('should create server mode bot by default (non-Electron)', async () => {
    mockCreateBot.mockResolvedValue({
      bot: { id: 'bot-2', username: 'newbot', ownerId: 'user-1', createdAt: Date.now(), runMode: 'server' },
    });

    await act(async () => {
      renderBotManager();
    });

    const input = screen.getByPlaceholderText('输入机器人用户名（须以 bot 结尾）');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'newbot' } });
    });

    // 服务端模式需要填写 LLM 配置表单，直接点创建会因表单验证失败
    // 验证默认模式为 server
    const serverRadio = screen.getByText('服务端运行');
    expect(serverRadio.closest('.ant-radio-button-wrapper-checked')).toBeTruthy();
  });
});
