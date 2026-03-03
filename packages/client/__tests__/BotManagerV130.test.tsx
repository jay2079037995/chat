/**
 * BotManager v1.13.0 集成测试 — Skill 选择 UI
 *
 * 验证编辑 server bot 时的 Skill 选择区域和推理模型禁用提示。
 */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import BotManager from '../src/modules/chat/components/BotManager';

jest.mock('../src/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

const mockListBots = jest.fn();
const mockGetProviders = jest.fn();
const mockUpdateBotConfig = jest.fn();
const mockGetAvailableSkills = jest.fn();
const mockSetBotSkills = jest.fn();

jest.mock('../src/modules/chat/services/botService', () => ({
  botService: {
    createBot: jest.fn(),
    listBots: () => mockListBots(),
    deleteBot: jest.fn(),
    updateBotConfig: (...args: any[]) => mockUpdateBotConfig(...args),
    startBot: jest.fn(),
    stopBot: jest.fn(),
    getProviders: () => mockGetProviders(),
    getAvailableSkills: () => mockGetAvailableSkills(),
    setBotSkills: (...args: any[]) => mockSetBotSkills(...args),
    getBotLogs: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
    clearBotLogs: jest.fn(),
  },
}));

const renderBotManager = (visible = true) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <BotManager visible={visible} onClose={jest.fn()} />
    </ConfigProvider>,
  );
};

describe('BotManager v1.13.0 — Skill 选择', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProviders.mockResolvedValue({
      deepseek: { baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
    });
    mockGetAvailableSkills.mockResolvedValue([
      { name: 'skill:web', displayName: 'Web 搜索', description: '搜索网页' },
      { name: 'skill:file', displayName: '文件操作', description: '读写文件' },
    ]);
    mockSetBotSkills.mockResolvedValue({ allowedSkills: ['*'] });
  });

  test('server bot 列表显示日志按钮', async () => {
    mockListBots.mockResolvedValue([
      {
        id: 'bot-1',
        username: 'mybot',
        ownerId: 'user-1',
        createdAt: Date.now(),
        runMode: 'server',
        status: 'running',
        llmConfig: { provider: 'deepseek', model: 'deepseek-chat', apiKey: '****1234' },
        allowedSkills: ['*'],
      },
    ]);

    await act(async () => {
      renderBotManager();
    });

    await waitFor(() => {
      expect(screen.getByText('mybot')).toBeDefined();
    });

    // server bot 应有编辑按钮
    const buttons = screen.getAllByRole('button');
    const editBtn = buttons.find((b) => b.getAttribute('title') === '编辑配置');
    expect(editBtn).toBeDefined();
  });

  test('编辑 server bot 时显示 Skill 选择区域', async () => {
    mockListBots.mockResolvedValue([
      {
        id: 'bot-1',
        username: 'mybot',
        ownerId: 'user-1',
        createdAt: Date.now(),
        runMode: 'server',
        status: 'running',
        llmConfig: { provider: 'deepseek', model: 'deepseek-chat', apiKey: '****1234' },
        allowedSkills: ['*'],
      },
    ]);

    await act(async () => {
      renderBotManager();
    });

    await waitFor(() => {
      expect(screen.getByText('mybot')).toBeDefined();
    });

    // 点击编辑按钮
    const buttons = screen.getAllByRole('button');
    const editBtn = buttons.find((b) => b.getAttribute('title') === '编辑配置');
    if (editBtn) {
      await act(async () => {
        fireEvent.click(editBtn);
      });
    }

    // 应显示 "Skill 配置" 标题
    await waitFor(() => {
      expect(screen.getByText('Skill 配置')).toBeDefined();
    });
  });

  test('deepseek-reasoner 模型显示 Skill 不可用提示', async () => {
    mockListBots.mockResolvedValue([
      {
        id: 'bot-1',
        username: 'reasonerbot',
        ownerId: 'user-1',
        createdAt: Date.now(),
        runMode: 'server',
        status: 'running',
        llmConfig: { provider: 'deepseek', model: 'deepseek-reasoner', apiKey: '****5678' },
        allowedSkills: ['*'],
      },
    ]);

    await act(async () => {
      renderBotManager();
    });

    await waitFor(() => {
      expect(screen.getByText('reasonerbot')).toBeDefined();
    });

    // 点击编辑按钮
    const buttons = screen.getAllByRole('button');
    const editBtn = buttons.find((b) => b.getAttribute('title') === '编辑配置');
    if (editBtn) {
      await act(async () => {
        fireEvent.click(editBtn);
      });
    }

    // 应显示推理模型不支持 Skill 的提示
    await waitFor(() => {
      expect(screen.getByText('该模型不支持 Skill 调用')).toBeDefined();
    });
  });
});
