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
import styles from './index.module.less';

interface MessageToolbarProps {
  activeType: MessageType;
  onTypeChange: (type: MessageType) => void;
}

const TOOLBAR_ITEMS: { type: MessageType; icon: React.ReactNode; label: string }[] = [
  { type: 'text', icon: <FontSizeOutlined />, label: '文字' },
  { type: 'image', icon: <PictureOutlined />, label: '图片' },
  { type: 'audio', icon: <AudioOutlined />, label: '录音' },
  { type: 'code', icon: <CodeOutlined />, label: '代码' },
  { type: 'markdown', icon: <FileMarkdownOutlined />, label: 'Markdown' },
  { type: 'file', icon: <PaperClipOutlined />, label: '文件' },
];

const MessageToolbar: React.FC<MessageToolbarProps> = ({ activeType, onTypeChange }) => {
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
    </div>
  );
};

export default MessageToolbar;
