import React from 'react';
import { render, screen } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import UserAvatar from '../src/modules/chat/components/UserAvatar';

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      participantAvatars: { user2: 'https://example.com/avatar.png' },
      participantNames: { user1: 'alice', user2: 'bob' },
    }),
}));

const renderAvatar = (props: any) =>
  render(
    <ConfigProvider locale={zhCN}>
      <UserAvatar {...props} />
    </ConfigProvider>,
  );

describe('UserAvatar', () => {
  it('renders image avatar when avatarUrl is provided', () => {
    renderAvatar({ userId: 'user2' });
    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.src).toContain('avatar.png');
  });

  it('renders first letter fallback when no avatar', () => {
    renderAvatar({ userId: 'user1' });
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('renders group icon when isGroup is true', () => {
    renderAvatar({ userId: 'group1', isGroup: true });
    // TeamOutlined icon should render (not a letter)
    expect(document.querySelector('.anticon-team')).toBeTruthy();
  });

  it('uses direct avatarUrl prop over store', () => {
    renderAvatar({ userId: 'user1', avatarUrl: 'https://example.com/direct.png' });
    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.src).toContain('direct.png');
  });

  it('uses direct username prop for fallback', () => {
    renderAvatar({ userId: 'unknown', username: 'Zara' });
    expect(screen.getByText('Z')).toBeTruthy();
  });
});
