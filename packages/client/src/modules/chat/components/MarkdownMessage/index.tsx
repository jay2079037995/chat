import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import type { Message } from '@chat/shared';
import styles from './index.module.less';

interface MarkdownMessageProps {
  message: Message;
  isSelf: boolean;
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ message, isSelf }) => {
  return (
    <div className={`${styles.markdownMessage} ${isSelf ? styles.self : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {message.content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownMessage;
