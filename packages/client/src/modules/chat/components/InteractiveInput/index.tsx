/**
 * 交互式文本输入组件
 *
 * 渲染 AI 请求的文本输入框。
 * 当 interactive=true 时用户可输入并提交，自动作为消息发送。
 * 当 interactive=false 时为静态展示（历史消息）。
 */
import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/useChatStore';
import styles from './index.module.less';

interface InteractiveInputProps {
  /** 标签/提示文字 */
  label: string;
  /** 输入框占位符 */
  placeholder?: string;
  /** 是否可交互 */
  interactive: boolean;
}

const InteractiveInput: React.FC<InteractiveInputProps> = ({ label, placeholder, interactive }) => {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (!value.trim() || !interactive) return;
    useChatStore.getState().sendMessage(value.trim());
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.label}>{label}</div>
      <div className={styles.inputRow}>
        <Input
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '请输入...'}
          disabled={!interactive}
          size="small"
        />
        {interactive && (
          <Button
            type="primary"
            size="small"
            icon={<SendOutlined />}
            onClick={handleSubmit}
            disabled={!value.trim()}
          />
        )}
      </div>
    </div>
  );
};

export default InteractiveInput;
