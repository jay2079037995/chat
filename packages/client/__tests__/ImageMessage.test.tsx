import React from 'react';
import { render, act } from '@testing-library/react';
import ImageMessage from '../src/modules/chat/components/ImageMessage';

describe('ImageMessage (v0.4.0)', () => {
  const message = {
    id: 'm1',
    conversationId: 'conv1',
    senderId: 'user1',
    type: 'image' as const,
    content: '/uploads/images/test.png',
    fileName: 'test.png',
    fileSize: 12345,
    mimeType: 'image/png',
    createdAt: Date.now(),
  };

  it('should render an img element with correct src', async () => {
    let container: HTMLElement;
    await act(async () => {
      const result = render(<ImageMessage message={message} />);
      container = result.container;
    });
    const img = container!.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/uploads/images/test.png');
  });

  it('should set image width to 200', async () => {
    let container: HTMLElement;
    await act(async () => {
      const result = render(<ImageMessage message={message} />);
      container = result.container;
    });
    const img = container!.querySelector('img');
    expect(img!.getAttribute('width')).toBe('200');
  });
});
