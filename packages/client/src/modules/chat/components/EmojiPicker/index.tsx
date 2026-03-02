/**
 * Emoji 选择器组件
 *
 * 基于 emoji-mart 的 Emoji 选择浮层。
 * 点击 toolbar 按钮弹出，选中 emoji 后通过回调插入输入框。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import { SmileOutlined } from '@ant-design/icons';
import styles from './index.module.less';

interface EmojiPickerProps {
  /** 选择 emoji 后的回调 */
  onSelect: (emoji: string) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  /** 点击外部关闭 Picker */
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible]);

  /** 动态加载 emoji-mart Picker（避免首屏加载过大） */
  useEffect(() => {
    if (!visible || !pickerRef.current) return;

    // 清空旧内容
    pickerRef.current.innerHTML = '';

    // 动态导入 emoji-mart
    Promise.all([
      import('@emoji-mart/data'),
      import('emoji-mart'),
    ]).then(([dataModule, emojiMart]) => {
      if (!pickerRef.current) return;
      const picker = new emojiMart.Picker({
        data: dataModule.default,
        onEmojiSelect: (emoji: { native: string }) => {
          onSelect(emoji.native);
          setVisible(false);
        },
        locale: 'zh',
        theme: 'light',
        previewPosition: 'none',
        skinTonePosition: 'none',
      });
      pickerRef.current.appendChild(picker as unknown as Node);
    });
  }, [visible, onSelect]);

  return (
    <div className={styles.container} ref={containerRef}>
      <Tooltip title="Emoji">
        <button
          type="button"
          className={styles.triggerBtn}
          onClick={() => setVisible(!visible)}
        >
          <SmileOutlined />
        </button>
      </Tooltip>
      {visible && (
        <div className={styles.pickerPopover}>
          <div ref={pickerRef} />
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;
