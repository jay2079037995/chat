import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Login from '../src/modules/auth/pages/Login';

// Mock useAuthStore
const mockLogin = jest.fn();
jest.mock('../src/modules/auth/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ login: mockLogin, user: null, loading: false, initialized: true, initAuth: jest.fn() }),
}));

const renderLogin = () => {
  return render(
    <ConfigProvider locale={zhCN}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </ConfigProvider>,
  );
};

describe('Login Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form', async () => {
    await act(async () => {
      renderLogin();
    });
    expect(screen.getByPlaceholderText('用户名')).toBeDefined();
    expect(screen.getByPlaceholderText('密码')).toBeDefined();
    expect(screen.getByRole('button', { name: /登.*录/ })).toBeDefined();
  });

  it('shows link to register page', async () => {
    await act(async () => {
      renderLogin();
    });
    expect(screen.getByText('立即注册')).toBeDefined();
  });

  it('calls login on valid submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    await act(async () => {
      renderLogin();
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /登.*录/ }));
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123');
    });
  });
});
