/**
 * 交互式文本输入组件 — 内联决策卡片
 *
 * 渲染 AI 请求的文本输入框，包裹在决策卡片中。
 * 当 interactive=true 且未提交时用户可输入并提交。
 * 提交后标记 submitted 并持久化到服务端。
 */
import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { SendOutlined, CheckCircleOutlined, EditOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/useChatStore';
import { useSocketStore } from '../../stores/useSocketStore';
import styles from './index.module.less';

interface InteractiveInputProps {
  /** 标签/提示文字 */
  label: string;
  /** 输入框占位符 */
  placeholder?: string;
  /** 是否可交互 */
  interactive: boolean;
  /** 是否已提交 */
  submitted?: boolean;
  /** 消息 ID */
  messageId?: string;
  /** 会话 ID */
  conversationId?: string;
}

const InteractiveInput: React.FC<InteractiveInputProps> = ({
  label, placeholder, interactive, submitted, messageId, conversationId,
}) => {
  const [value, setValue] = useState('');
  const canInteract = interactive && !submitted;

  const handleSubmit = () => {
    if (!value.trim() || !canInteract) return;
    useChatStore.getState().sendMessage(value.trim());
    setValue('');
    // 更新 metadata 持久化已提交状态
    if (messageId && conversationId) {
      const { socket } = useSocketStore.getState();
      socket?.emit('message:update-metadata', {
        messageId,
        conversationId,
        metadataUpdate: { inputRequest: { submitted: true } },
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={styles.card}>
      {/* 卡片头部 */}
      <div className={styles.header}>
        <EditOutlined className={styles.headerIcon} />
        <span className={styles.headerText}>{label}</span>
        {submitted && <CheckCircleOutlined className={styles.submittedIcon} />}
      </div>
      <div className={styles.divider} />
      {/* 输入区域 */}
      <div className={styles.inputArea}>
        {submitted ? (
          <div className={styles.submittedText}>已提交</div>
        ) : (
          <div className={styles.inputRow}>
            <Input
              className={styles.input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || '请输入...'}
              disabled={!canInteract}
              size="small"
            />
            {canInteract && (
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                onClick={handleSubmit}
                disabled={!value.trim()}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveInput;
