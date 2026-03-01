import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import UserSearch from '../src/modules/home/components/UserSearch';

// Mock userService
const mockSearch = jest.fn();
jest.mock('../src/modules/home/services/userService', () => ({
  userService: {
    search: (...args: unknown[]) => mockSearch(...args),
  },
}));

const renderUserSearch = (onSelectUser?: (user: unknown) => void) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <UserSearch onSelectUser={onSelectUser} />
    </ConfigProvider>,
  );
};

describe('UserSearch (v0.2.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('6.2.1: shows search results when users found', async () => {
    mockSearch.mockResolvedValueOnce([
      { id: '1', username: 'alice' },
      { id: '2', username: 'alice_wang' },
    ]);

    await act(async () => {
      renderUserSearch();
    });

    const input = screen.getByPlaceholderText('搜索用户');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'alice' } });
    });

    // Trigger search by pressing Enter on the search input
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('alice');
    });

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeDefined();
      expect(screen.getByText('alice_wang')).toBeDefined();
    });
  });

  it('6.2.2: shows "未找到用户" when no results', async () => {
    mockSearch.mockResolvedValueOnce([]);

    await act(async () => {
      renderUserSearch();
    });

    const input = screen.getByPlaceholderText('搜索用户');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'nonexistent' } });
    });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('nonexistent');
    });

    await waitFor(() => {
      expect(screen.getByText('未找到用户')).toBeDefined();
    });
  });
});
