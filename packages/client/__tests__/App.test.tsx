import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App', () => {
  it('renders Chat App heading', () => {
    render(<App />);
    expect(screen.getByText('Chat App')).toBeDefined();
  });
});
