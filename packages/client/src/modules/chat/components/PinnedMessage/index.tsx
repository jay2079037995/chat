/**
 * 置顶消息条组件
 *
 * 显示在 ChatWindow header 下方，展示当前会话的置顶消息。
 * 多条时支持左右切换。
 */
import React, { useState } from 'react';
import { PushpinOutlined, CloseOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { Message } from '@chat/shared';
import styles from './index.module.less';

interface PinnedMessageProps {
  messages: Message[];
  participantNames: Record<string, string>;
  onUnpin?: (messageId: string) => void;
}

const PinnedMessage: React.FC<PinnedMessageProps> = ({ messages, participantNames, onUnpin }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (messages.length === 0) return null;

  const safeIndex = Math.min(currentIndex, messages.length - 1);
  const msg = messages[safeIndex];
  const senderName = participantNames[msg.senderId] || msg.senderId;
  const preview = msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content;

  return (
    <div className={styles.container}>
      <PushpinOutlined className={styles.icon} />
      <div className={styles.content}>
        <span className={styles.sender}>{senderName}</span>
        <span className={styles.text}>{preview}</span>
      </div>
      {messages.length > 1 && (
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navBtn}
            disabled={safeIndex === 0}
            onClick={() => setCurrentIndex(safeIndex - 1)}
          >
            <LeftOutlined />
          </button>
          <span className={styles.count}>{safeIndex + 1}/{messages.length}</span>
          <button
            type="button"
            className={styles.navBtn}
            disabled={safeIndex === messages.length - 1}
            onClick={() => setCurrentIndex(safeIndex + 1)}
          >
            <RightOutlined />
          </button>
        </div>
      )}
      {onUnpin && (
        <button
          type="button"
          className={styles.unpinBtn}
          onClick={() => onUnpin(msg.id)}
          title="取消置顶"
        >
          <CloseOutlined />
        </button>
      )}
    </div>
  );
};

export default PinnedMessage;
