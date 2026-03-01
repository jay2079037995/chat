import React from 'react';
import { render, screen, act } from '@testing-library/react';
import AudioMessage from '../src/modules/chat/components/AudioMessage';

describe('AudioMessage (v0.4.0)', () => {
  const message = {
    id: 'm1',
    conversationId: 'conv1',
    senderId: 'user1',
    type: 'audio' as const,
    content: '/uploads/audio/test.webm',
    fileName: 'recording.webm',
    fileSize: 54321,
    mimeType: 'audio/webm',
    createdAt: Date.now(),
  };

  it('should render audio element with correct src', async () => {
    let container: HTMLElement;
    await act(async () => {
      const result = render(<AudioMessage message={message} />);
      container = result.container;
    });
    const audio = container!.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio!.getAttribute('src')).toBe('/uploads/audio/test.webm');
  });

  it('should render play button', async () => {
    await act(async () => {
      render(<AudioMessage message={message} />);
    });
    // Play button should be present
    const btn = screen.getByRole('button');
    expect(btn).toBeDefined();
  });

  it('should display time as 0:00 / 0:00 initially', async () => {
    await act(async () => {
      render(<AudioMessage message={message} />);
    });
    expect(screen.getByText('0:00 / 0:00')).toBeDefined();
  });
});
