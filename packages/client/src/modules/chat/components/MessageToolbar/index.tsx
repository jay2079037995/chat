/**
 * 消息工具栏组件
 *
 * 提供消息类型切换按钮（文字/图片/录音/代码/Markdown/文件）和 Emoji 选择器。
 */
import React from 'react';
import { Tooltip } from 'antd';
import {
  FontSizeOutlined,
  PictureOutlined,
  AudioOutlined,
  CodeOutlined,
  FileMarkdownOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import type { MessageType } from '@chat/shared';
import EmojiPicker from '../EmojiPicker';
import styles from './index.module.less';

interface MessageToolbarProps {
  activeType: MessageType;
  onTypeChange: (type: MessageType) => void;
  /** 选择 emoji 后插入输入框的回调 */
  onEmojiSelect?: (emoji: string) => void;
}

const TOOLBAR_ITEMS: { type: MessageType; icon: React.ReactNode; label: string }[] = [
  { type: 'text', icon: <FontSizeOutlined />, label: '文字' },
  { type: 'image', icon: <PictureOutlined />, label: '图片' },
  { type: 'audio', icon: <AudioOutlined />, label: '录音' },
  { type: 'code', icon: <CodeOutlined />, label: '代码' },
  { type: 'markdown', icon: <FileMarkdownOutlined />, label: 'Markdown' },
  { type: 'file', icon: <PaperClipOutlined />, label: '文件' },
];

const MessageToolbar: React.FC<MessageToolbarProps> = ({ activeType, onTypeChange, onEmojiSelect }) => {
  return (
    <div className={styles.toolbar}>
      {TOOLBAR_ITEMS.map((item) => (
        <Tooltip key={item.type} title={item.label}>
          <button
            type="button"
            className={`${styles.toolbarBtn} ${activeType === item.type ? styles.active : ''}`}
            onClick={() => onTypeChange(item.type)}
          >
            {item.icon}
          </button>
        </Tooltip>
      ))}
      {/* Emoji 选择器 */}
      {onEmojiSelect && <EmojiPicker onSelect={onEmojiSelect} />}
    </div>
  );
};

export default MessageToolbar;
