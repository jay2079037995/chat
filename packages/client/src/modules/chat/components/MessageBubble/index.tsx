import React from 'react';
import type { Message } from '@chat/shared';
import ImageMessage from '../ImageMessage';
import AudioMessage from '../AudioMessage';
import CodeMessage from '../CodeMessage';
import MarkdownMessage from '../MarkdownMessage';
import FileMessage from '../FileMessage';
import styles from './index.module.less';

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  participantNames?: Record<string, string>;
}

/** 将文本中的 @username 高亮渲染 */
function renderTextWithMentions(
  content: string,
  mentions: string[],
  participantNames: Record<string, string>,
  isSelf: boolean,
): React.ReactNode {
  // 构建 username → userId 反查表
  const usernameToId: Record<string, string> = {};
  for (const [uid, name] of Object.entries(participantNames)) {
    usernameToId[name] = uid;
  }

  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const uname = part.slice(1);
      if (usernameToId[uname] && mentions.includes(usernameToId[uname])) {
        return (
          <span key={i} className={isSelf ? styles.mentionSelf : styles.mention}>
            {part}
          </span>
        );
      }
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isSelf, participantNames }) => {
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
      if (message.mentions?.length && participantNames) {
        return <span>{renderTextWithMentions(message.content, message.mentions, participantNames, isSelf)}</span>;
      }
      return <span>{message.content}</span>;
  }
};

export default MessageBubble;
