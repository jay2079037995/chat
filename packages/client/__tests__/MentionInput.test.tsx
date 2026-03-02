import React from 'react';
import { render, screen } from '@testing-library/react';
import MentionInput from '../src/modules/chat/components/MentionInput';

describe('MentionInput', () => {
  const members = [
    { id: 'user-1', username: 'alice' },
    { id: 'user-2', username: 'bob' },
    { id: 'user-3', username: 'charlie' },
  ];

  it('should render with placeholder', () => {
    render(
      <MentionInput
        value=""
        onChange={() => {}}
        onKeyDown={() => {}}
        members={members}
        placeholder="输入消息，@ 提及成员..."
      />,
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDefined();
  });

  it('should display current value', () => {
    render(
      <MentionInput
        value="hello @alice"
        onChange={() => {}}
        onKeyDown={() => {}}
        members={members}
      />,
    );

    const textarea = screen.getByRole('textbox');
    expect((textarea as HTMLTextAreaElement).value).toBe('hello @alice');
  });

  it('should render with empty members list', () => {
    render(
      <MentionInput
        value=""
        onChange={() => {}}
        onKeyDown={() => {}}
        members={[]}
      />,
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDefined();
  });
});
