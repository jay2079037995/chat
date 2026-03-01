import React from 'react';
import { render, screen, act } from '@testing-library/react';
import FileMessage from '../src/modules/chat/components/FileMessage';

describe('FileMessage (v0.4.0)', () => {
  const message = {
    id: 'm1',
    conversationId: 'conv1',
    senderId: 'user1',
    type: 'file' as const,
    content: '/uploads/files/test.pdf',
    fileName: 'report.pdf',
    fileSize: 2048576,
    mimeType: 'application/pdf',
    createdAt: Date.now(),
  };

  it('should display file name', async () => {
    await act(async () => {
      render(<FileMessage message={message} />);
    });
    expect(screen.getByText('report.pdf')).toBeDefined();
  });

  it('should display formatted file size', async () => {
    await act(async () => {
      render(<FileMessage message={message} />);
    });
    // 2048576 bytes ≈ 2.0 MB (formatFileSize from shared)
    expect(screen.getByText(/MB/)).toBeDefined();
  });

  it('should render download button', async () => {
    await act(async () => {
      render(<FileMessage message={message} />);
    });
    const downloadBtn = screen.getByRole('link');
    expect(downloadBtn.getAttribute('href')).toBe('/uploads/files/test.pdf');
  });

  it('should show fallback for missing file name', async () => {
    const noNameMsg = { ...message, fileName: undefined };
    await act(async () => {
      render(<FileMessage message={noNameMsg} />);
    });
    expect(screen.getByText('未知文件')).toBeDefined();
  });
});
