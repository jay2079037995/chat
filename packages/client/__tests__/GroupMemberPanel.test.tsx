import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import GroupMemberPanel from '../src/modules/chat/components/GroupMemberPanel';

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      participantNames: { user1: 'owner', user2: 'alice', user3: 'bob' },
      conversations: [
        {
          id: 'group:test1',
          type: 'group',
          participants: ['user1', 'user2', 'user3'],
          updatedAt: Date.now(),
          unreadCount: 0,
        },
      ],
      loadConversations: jest.fn(),
      botUserIds: new Set(),
    }),
}));

jest.mock('../src/modules/chat/stores/useSocketStore', () => ({
  useSocketStore: (selector: (s: any) => any) =>
    selector({
      onlineUsers: new Set(['user1', 'user2']),
    }),
}));

jest.mock('../src/modules/auth/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({
      user: { id: 'user1', username: 'owner' },
    }),
}));

jest.mock('../src/modules/chat/services/groupService', () => ({
  groupService: {
    getGroup: jest.fn().mockResolvedValue({
      group: { id: 'group:test1', name: '测试群', ownerId: 'user1', members: ['user1', 'user2', 'user3'] },
      memberNames: { user1: 'owner', user2: 'alice', user3: 'bob' },
    }),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    leaveGroup: jest.fn().mockResolvedValue({ group: {} }),
    dissolveGroup: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../src/modules/home/services/userService', () => ({
  userService: {
    search: jest.fn().mockResolvedValue([]),
  },
}));

const mockOnClose = jest.fn();

const renderPanel = (visible = true) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <GroupMemberPanel groupId="group:test1" visible={visible} onClose={mockOnClose} />
    </ConfigProvider>,
  );
};

describe('GroupMemberPanel (v0.5.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render drawer with title', async () => {
    await act(async () => {
      renderPanel();
    });

    expect(screen.getByText('群成员')).toBeDefined();
  });

  it('should render member names', async () => {
    await act(async () => {
      renderPanel();
    });

    expect(screen.getByText('owner')).toBeDefined();
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('bob')).toBeDefined();
  });

  it('should show owner tag for group owner', async () => {
    await act(async () => {
      renderPanel();
    });

    // Wait for getGroup to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Owner tag should be visible (contains "群主" text)
    const ownerTags = screen.queryAllByText(/群主/);
    expect(ownerTags.length).toBeGreaterThan(0);
  });

  it('should show invite section for owner', async () => {
    await act(async () => {
      renderPanel();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByText('邀请成员')).toBeDefined();
  });

  it('should show dissolve button for owner', async () => {
    await act(async () => {
      renderPanel();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByText('解散群组')).toBeDefined();
  });
});
