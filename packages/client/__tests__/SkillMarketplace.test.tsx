/**
 * SkillMarketplace 组件测试（v1.14.0）
 *
 * 测试 Skill 市场 UI：非 Electron 环境提示、Tab 展示、空状态。
 */
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import SkillMarketplace from '../src/modules/chat/components/BotManager/SkillMarketplace';

describe('SkillMarketplace', () => {
  const renderMarketplace = (visible = true) => {
    return render(
      <ConfigProvider locale={zhCN}>
        <SkillMarketplace visible={visible} onClose={jest.fn()} />
      </ConfigProvider>,
    );
  };

  beforeEach(() => {
    // 确保清除 electronAPI mock
    delete (window as any).electronAPI;
  });

  test('非 Electron 环境显示 "仅在桌面端可用" 提示', async () => {
    await act(async () => {
      renderMarketplace();
    });

    expect(screen.getByText(/Skill 市场仅在桌面端可用/)).toBeDefined();
  });

  test('标题显示 "Skill 市场"', async () => {
    await act(async () => {
      renderMarketplace();
    });

    expect(screen.getByText('Skill 市场')).toBeDefined();
  });

  test('Electron 环境显示已安装和在线市场 Tab', async () => {
    // mock electronAPI
    (window as any).electronAPI = {
      isElectron: true,
      listCustomSkills: jest.fn().mockResolvedValue([]),
      installSkill: jest.fn(),
      uninstallSkill: jest.fn(),
      selectSkillDir: jest.fn(),
      getSkillRegistries: jest.fn().mockResolvedValue([]),
      setSkillRegistries: jest.fn(),
      fetchMarketplaceSkills: jest.fn().mockResolvedValue([]),
      downloadAndInstallSkill: jest.fn(),
      installSkillFromGit: jest.fn(),
    };

    await act(async () => {
      renderMarketplace();
    });

    await waitFor(() => {
      expect(screen.getByText('已安装')).toBeDefined();
      expect(screen.getByText('在线市场')).toBeDefined();
    });
  });

  test('已安装 Tab 空状态显示提示', async () => {
    (window as any).electronAPI = {
      isElectron: true,
      listCustomSkills: jest.fn().mockResolvedValue([]),
      installSkill: jest.fn(),
      uninstallSkill: jest.fn(),
      selectSkillDir: jest.fn(),
      getSkillRegistries: jest.fn().mockResolvedValue([]),
      setSkillRegistries: jest.fn(),
      fetchMarketplaceSkills: jest.fn().mockResolvedValue([]),
      downloadAndInstallSkill: jest.fn(),
      installSkillFromGit: jest.fn(),
    };

    await act(async () => {
      renderMarketplace();
    });

    await waitFor(() => {
      expect(screen.getByText('暂无已安装的自定义 Skill')).toBeDefined();
    });
  });

  test('不可见时不渲染', async () => {
    await act(async () => {
      renderMarketplace(false);
    });

    expect(screen.queryByText('Skill 市场')).toBeNull();
  });
});
