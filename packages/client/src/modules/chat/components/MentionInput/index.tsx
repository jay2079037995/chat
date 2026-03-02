/**
 * @提及 输入组件
 *
 * 基于 Ant Design Mentions，输入 @ 时弹出群成员下拉列表。
 * 仅在群聊中使用，私聊场景使用普通 TextArea。
 */
import React from 'react';
import { Mentions } from 'antd';
import styles from './index.module.less';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  /** 可 @提及 的成员列表 */
  members: Array<{ id: string; username: string }>;
  placeholder?: string;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onKeyDown,
  members,
  placeholder = '输入消息，@ 提及成员...',
}) => {
  return (
    <Mentions
      className={styles.mentionInput}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoSize={{ minRows: 1, maxRows: 4 }}
      options={members.map((m) => ({
        value: m.username,
        label: m.username,
      }))}
    />
  );
};

export default MentionInput;
