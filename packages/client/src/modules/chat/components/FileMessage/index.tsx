import React from 'react';
import { Button } from 'antd';
import { FileOutlined, DownloadOutlined } from '@ant-design/icons';
import { formatFileSize } from '@chat/shared';
import type { Message } from '@chat/shared';
import styles from './index.module.less';

interface FileMessageProps {
  message: Message;
}

const FileMessage: React.FC<FileMessageProps> = ({ message }) => {
  return (
    <div className={styles.fileMessage}>
      <FileOutlined className={styles.icon} />
      <div className={styles.info}>
        <div className={styles.fileName}>{message.fileName || '未知文件'}</div>
        <div className={styles.fileSize}>
          {message.fileSize ? formatFileSize(message.fileSize) : '未知大小'}
        </div>
      </div>
      <Button
        type="text"
        size="small"
        icon={<DownloadOutlined />}
        href={message.content}
        target="_blank"
        download={message.fileName}
        className={styles.downloadBtn}
      />
    </div>
  );
};

export default FileMessage;
