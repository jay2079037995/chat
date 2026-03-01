import React from 'react';
import { Image, Spin } from 'antd';
import type { Message } from '@chat/shared';
import styles from './index.module.less';

interface ImageMessageProps {
  message: Message;
}

const ImageMessage: React.FC<ImageMessageProps> = ({ message }) => {
  return (
    <div className={styles.imageMessage}>
      <Image
        src={message.content}
        width={200}
        placeholder={<Spin size="small" />}
        fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij7lm77niYfliqDovb3lpLHotKU8L3RleHQ+PC9zdmc+"
      />
    </div>
  );
};

export default ImageMessage;
