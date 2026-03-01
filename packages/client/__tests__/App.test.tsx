import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';

// Mock axios to prevent real API calls
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn().mockRejectedValue(new Error('no session')),
    post: jest.fn().mockRejectedValue(new Error('no session')),
  })),
}));

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('redirects to login when not authenticated', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('登录')).toBeDefined();
    });
  });
});
