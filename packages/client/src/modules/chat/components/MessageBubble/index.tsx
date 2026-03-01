import React from 'react';
import type { Message } from '@chat/shared';
import ImageMessage from '../ImageMessage';
import AudioMessage from '../AudioMessage';
import CodeMessage from '../CodeMessage';
import MarkdownMessage from '../MarkdownMessage';
import FileMessage from '../FileMessage';

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isSelf }) => {
  switch (message.type) {
    case 'image':
      return <ImageMessage message={message} />;
    case 'audio':
      return <AudioMessage message={message} />;
    case 'code':
      return <CodeMessage message={message} />;
    case 'markdown':
      return <MarkdownMessage message={message} isSelf={isSelf} />;
    case 'file':
      return <FileMessage message={message} />;
    case 'text':
    default:
      return <span>{message.content}</span>;
  }
};

export default MessageBubble;
