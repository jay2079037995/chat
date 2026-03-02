import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ProfileDrawer from '../src/modules/chat/components/ProfileDrawer';

const mockUpdateProfile = jest.fn().mockResolvedValue(undefined);
const mockUpdateAvatar = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/modules/auth/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({
      user: { id: 'user1', username: 'testuser', nickname: '旧昵称', bio: '旧简介', avatar: '' },
      updateProfile: mockUpdateProfile,
      updateAvatar: mockUpdateAvatar,
    }),
}));

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      participantAvatars: {},
      participantNames: { user1: 'testuser' },
    }),
}));

const renderDrawer = (visible = true) =>
  render(
    <ConfigProvider locale={zhCN}>
      <ProfileDrawer visible={visible} onClose={jest.fn()} />
    </ConfigProvider>,
  );

describe('ProfileDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible', () => {
    renderDrawer();
    expect(screen.getByText('个人资料')).toBeTruthy();
    expect(screen.getByText('testuser')).toBeTruthy();
  });

  it('does not render content when not visible', () => {
    renderDrawer(false);
    expect(screen.queryByText('个人资料')).toBeNull();
  });

  it('shows existing nickname and bio', () => {
    renderDrawer();
    const nicknameInput = screen.getByPlaceholderText('设置昵称') as HTMLInputElement;
    const bioInput = screen.getByPlaceholderText('介绍一下自己...') as HTMLTextAreaElement;
    expect(nicknameInput.value).toBe('旧昵称');
    expect(bioInput.value).toBe('旧简介');
  });

  it('renders form labels', () => {
    renderDrawer();
    expect(screen.getByText('昵称')).toBeTruthy();
    expect(screen.getByText('简介')).toBeTruthy();
  });
});
