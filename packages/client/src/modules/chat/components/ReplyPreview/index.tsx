/**
 * 引用回复预览条
 *
 * 在输入区域上方展示当前正在引用回复的消息摘要，可关闭取消引用。
 */
import React from 'react';
import { CloseOutlined } from '@ant-design/icons';
import type { Message } from '@chat/shared';
import styles from './index.module.less';

interface ReplyPreviewProps {
  /** 正在回复的消息 */
  message: Message;
  /** 发送者用户名 */
  senderName: string;
  /** 关闭（取消引用）回调 */
  onClose: () => void;
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, senderName, onClose }) => {
  /** 截断内容摘要（最多 80 字符） */
  const summary = message.content.length > 80
    ? message.content.slice(0, 80) + '...'
    : message.content;

  return (
    <div className={styles.container}>
      <div className={styles.indicator} />
      <div className={styles.content}>
        <span className={styles.sender}>回复 {senderName}</span>
        <span className={styles.summary}>{summary}</span>
      </div>
      <button type="button" className={styles.closeBtn} onClick={onClose}>
        <CloseOutlined />
      </button>
    </div>
  );
};

export default ReplyPreview;
