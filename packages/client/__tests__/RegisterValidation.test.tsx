import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Register from '../src/modules/auth/pages/Register';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock useAuthStore
const mockRegister = jest.fn();
jest.mock('../src/modules/auth/stores/useAuthStore', () => ({
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

describe('Register - Validation & Error (v0.2.0)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1.2.2: shows validation error when username is empty', async () => {
    await act(async () => {
      renderRegister();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /注.*册/ }));
    });

    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeDefined();
    });
  });

  it('1.2.3: shows validation error when password is empty', async () => {
    await act(async () => {
      renderRegister();
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'testuser' } });
      fireEvent.click(screen.getByRole('button', { name: /注.*册/ }));
    });

    await waitFor(() => {
      expect(screen.getByText('请输入密码')).toBeDefined();
    });
  });

  it('1.2.5: shows error message when username is taken', async () => {
    mockRegister.mockRejectedValueOnce({
      response: { data: { error: '用户名已被占用' } },
    });

    await act(async () => {
      renderRegister();
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'existinguser' } });
      fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByPlaceholderText('确认密码'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /注.*册/ }));
    });

    await waitFor(() => {
      expect(document.querySelector('.ant-message-error')).not.toBeNull();
    });
  });
});
