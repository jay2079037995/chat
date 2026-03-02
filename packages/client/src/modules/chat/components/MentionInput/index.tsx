/**
 * @提及 输入组件
 *
 * 基于 Ant Design Mentions，输入 @ 时弹出群成员下拉列表。
 * 仅在群聊中使用，私聊场景使用普通 TextArea。
 *
 * 注意：当 @ 下拉菜单打开时，Enter 键用于选择成员，不能触发消息发送。
 * 通过 onSearch/onSelect/onChange 追踪下拉菜单状态来实现。
 */
import React, { useRef } from 'react';
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
  // 追踪 @ 下拉菜单是否处于打开状态
  const mentionOpenRef = useRef(false);

  const handleChange = (newValue: string) => {
    // onChange 先于 onSearch 触发，先重置为 false；
    // 如果下拉菜单仍然打开，紧随其后的 onSearch 会重新设为 true。
    mentionOpenRef.current = false;
    onChange(newValue);
  };

  const handleSearch = () => {
    mentionOpenRef.current = true;
  };

  const handleSelect = () => {
    // 延迟重置，确保当前 Enter 事件处理完毕后再允许发送
    setTimeout(() => { mentionOpenRef.current = false; }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      mentionOpenRef.current = false;
    }
    // 下拉菜单打开时，Enter 用于选中成员，不传递给父组件（不触发发送）
    if (e.key === 'Enter' && !e.shiftKey && mentionOpenRef.current) {
      return;
    }
    onKeyDown(e);
  };

  return (
    <Mentions
      className={styles.mentionInput}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onSearch={handleSearch}
      onSelect={handleSelect}
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
