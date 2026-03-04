/**
 * 流式消息气泡组件
 *
 * 展示 Local Bot 正在生成的流式回复，带打字机闪烁光标效果。
 */
import React from 'react';
import { RobotOutlined } from '@ant-design/icons';
import styles from './index.module.less';

interface StreamingMessageProps {
  content: string;
}

const StreamingMessage: React.FC<StreamingMessageProps> = ({ content }) => {
  if (!content) return null;

  return (
    <div className={styles.streamingRow}>
      <RobotOutlined className={styles.avatar} />
      <div className={styles.streamingBubble}>
        {content}
        <span className={styles.cursor} />
      </div>
    </div>
  );
};

export default StreamingMessage;
