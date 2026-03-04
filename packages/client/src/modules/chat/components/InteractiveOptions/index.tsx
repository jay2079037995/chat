/**
 * 交互式选项组件
 *
 * 渲染 AI 提供的可点击选项按钮。
 * 当 interactive=true 时用户可点击选项，自动作为消息发送。
 * 当 interactive=false 时为静态展示（历史消息）。
 */
import React from 'react';
import { useChatStore } from '../../stores/useChatStore';
import styles from './index.module.less';

interface InteractiveOptionsProps {
  /** 提示文字 */
  prompt?: string;
  /** 选项列表 */
  items: string[];
  /** 是否可交互（仅最后一条 bot 消息可交互） */
  interactive: boolean;
}

const InteractiveOptions: React.FC<InteractiveOptionsProps> = ({ prompt, items, interactive }) => {
  if (!items || items.length === 0) return null;

  const handleClick = (item: string) => {
    if (!interactive) return;
    useChatStore.getState().sendMessage(item);
  };

  return (
    <div className={styles.container}>
      {prompt && <div className={styles.prompt}>{prompt}</div>}
      <div className={styles.optionList}>
        {items.map((item, idx) => (
          <button
            key={idx}
            type="button"
            className={`${styles.optionBtn} ${interactive ? styles.optionInteractive : styles.optionStatic}`}
            onClick={() => handleClick(item)}
            disabled={!interactive}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InteractiveOptions;
