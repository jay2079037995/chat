import React from 'react';
import { render, screen, act } from '@testing-library/react';
import CodeMessage from '../src/modules/chat/components/CodeMessage';

// Mock clipboard
Object.assign(navigator, {
  clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
});

describe('CodeMessage (v0.4.0)', () => {
  const message = {
    id: 'm1',
    conversationId: 'conv1',
    senderId: 'user1',
    type: 'code' as const,
    content: 'const x = 1;',
    codeLanguage: 'javascript',
    createdAt: Date.now(),
  };

  it('should render code content in a pre/code block', async () => {
    let container: HTMLElement;
    await act(async () => {
      const result = render(<CodeMessage message={message} />);
      container = result.container;
    });
    const codeEl = container!.querySelector('pre code');
    expect(codeEl).not.toBeNull();
    expect(codeEl!.textContent).toContain('const');
    expect(codeEl!.textContent).toContain('x');
    expect(codeEl!.textContent).toContain('1');
  });

  it('should display language label', async () => {
    await act(async () => {
      render(<CodeMessage message={message} />);
    });
    expect(screen.getByText('javascript')).toBeDefined();
  });

  it('should render copy button', async () => {
    await act(async () => {
      render(<CodeMessage message={message} />);
    });
    expect(screen.getByText('复制')).toBeDefined();
  });
});
