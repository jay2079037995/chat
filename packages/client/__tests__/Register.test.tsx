import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Register from '../src/pages/Register';

// Mock useAuthStore
const mockRegister = jest.fn();
jest.mock('../src/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ register: mockRegister, user: null, loading: false, initialized: true, initAuth: jest.fn() }),
}));

const renderRegister = () => {
  return render(
    <ConfigProvider locale={zhCN}>
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    </ConfigProvider>,
  );
};

describe('Register Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders register form', async () => {
    await act(async () => {
      renderRegister();
    });
    expect(screen.getByPlaceholderText('用户名')).toBeDefined();
    expect(screen.getByPlaceholderText('密码')).toBeDefined();
    expect(screen.getByPlaceholderText('确认密码')).toBeDefined();
    expect(screen.getByRole('button', { name: /注.*册/ })).toBeDefined();
  });

  it('shows link to login page', async () => {
    await act(async () => {
      renderRegister();
    });
    expect(screen.getByText('立即登录')).toBeDefined();
  });

  it('calls register on valid submit', async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    await act(async () => {
      renderRegister();
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'newuser' } });
      fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByPlaceholderText('确认密码'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /注.*册/ }));
    });

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('newuser', 'password123');
    });
  });
});
