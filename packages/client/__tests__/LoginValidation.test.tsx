import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Login from '../src/modules/auth/pages/Login';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

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

describe('Login - Validation & Error (v0.2.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1.2.2: shows validation error when username is empty', async () => {
    await act(async () => {
      renderLogin();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /登.*录/ }));
    });

    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeDefined();
    });
  });

  it('1.2.3: shows validation error when password is empty', async () => {
    await act(async () => {
      renderLogin();
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'testuser' } });
      fireEvent.click(screen.getByRole('button', { name: /登.*录/ }));
    });

    await waitFor(() => {
      expect(screen.getByText('请输入密码')).toBeDefined();
    });
  });

  it('2.2.3: shows error message when credentials are wrong', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { error: '用户名或密码错误' } },
    });

    await act(async () => {
      renderLogin();
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'wrongpass' } });
      fireEvent.click(screen.getByRole('button', { name: /登.*录/ }));
    });

    await waitFor(() => {
      expect(document.querySelector('.ant-message-error')).not.toBeNull();
    });
  });
});
