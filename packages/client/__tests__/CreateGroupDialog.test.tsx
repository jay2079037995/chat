import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import CreateGroupDialog from '../src/modules/chat/components/CreateGroupDialog';

const mockCreateGroup = jest.fn();

jest.mock('../src/modules/chat/stores/useChatStore', () => ({
  useChatStore: (selector: (s: any) => any) =>
    selector({
      createGroup: mockCreateGroup,
    }),
}));

jest.mock('../src/modules/home/services/userService', () => ({
  userService: {
    search: jest.fn().mockResolvedValue([
      { id: 'u2', username: 'alice' },
      { id: 'u3', username: 'bob' },
    ]),
  },
}));

const mockOnClose = jest.fn();

const renderDialog = (visible = true) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <CreateGroupDialog visible={visible} onClose={mockOnClose} />
    </ConfigProvider>,
  );
};

describe('CreateGroupDialog (v0.5.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render dialog with title', async () => {
    await act(async () => {
      renderDialog();
    });

    expect(screen.getByText('创建群组')).toBeDefined();
  });

  it('should render group name input', async () => {
    await act(async () => {
      renderDialog();
    });

    expect(screen.getByPlaceholderText('请输入群名称')).toBeDefined();
  });

  it('should render search input for members', async () => {
    await act(async () => {
      renderDialog();
    });

    expect(screen.getByPlaceholderText('搜索用户')).toBeDefined();
  });

  it('should not render when not visible', async () => {
    await act(async () => {
      renderDialog(false);
    });

    expect(screen.queryByText('创建群组')).toBeNull();
  });
});
