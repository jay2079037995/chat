import React from 'react';
import { render, screen, act } from '@testing-library/react';
import MarkdownMessage from '../src/modules/chat/components/MarkdownMessage';

// react-markdown, remark-gfm, rehype-highlight are mocked globally via jest.config moduleNameMapper

describe('MarkdownMessage (v0.4.0)', () => {
  it('should render heading', async () => {
    const message = {
      id: 'm1',
      conversationId: 'conv1',
      senderId: 'user1',
      type: 'markdown' as const,
      content: '# 标题一',
      createdAt: Date.now(),
    };
    await act(async () => {
      render(<MarkdownMessage message={message} isSelf={false} />);
    });
    expect(screen.getByText('标题一')).toBeDefined();
  });

  it('should render bold text', async () => {
    const message = {
      id: 'm2',
      conversationId: 'conv1',
      senderId: 'user1',
      type: 'markdown' as const,
      content: '这是 **粗体** 文字',
      createdAt: Date.now(),
    };
    await act(async () => {
      render(<MarkdownMessage message={message} isSelf={false} />);
    });
    const bold = screen.getByText('粗体');
    expect(bold.tagName).toBe('STRONG');
  });

  it('should render links with target _blank', async () => {
    const message = {
      id: 'm3',
      conversationId: 'conv1',
      senderId: 'user1',
      type: 'markdown' as const,
      content: '[链接](https://example.com)',
      createdAt: Date.now(),
    };
    await act(async () => {
      render(<MarkdownMessage message={message} isSelf={false} />);
    });
    const link = screen.getByText('链接');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('should render list items', async () => {
    const message = {
      id: 'm4',
      conversationId: 'conv1',
      senderId: 'user1',
      type: 'markdown' as const,
      content: '- 项目一\n- 项目二',
      createdAt: Date.now(),
    };
    await act(async () => {
      render(<MarkdownMessage message={message} isSelf={false} />);
    });
    expect(screen.getByText('项目一')).toBeDefined();
    expect(screen.getByText('项目二')).toBeDefined();
  });
});
