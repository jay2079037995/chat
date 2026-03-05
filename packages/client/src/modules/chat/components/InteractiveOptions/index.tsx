/**
 * 交互式选项组件 — 内联决策卡片
 *
 * 渲染 AI 提供的可点击选项，支持富选项（label + description）。
 * 当 interactive=true 且未选择时用户可点击选项，自动作为消息发送。
 * 选择后标记 selectedIndex 并持久化到服务端。
 */
import React from 'react';
import { CheckOutlined, RobotOutlined } from '@ant-design/icons';
import type { RichChoiceItem } from '@chat/shared';
import { useChatStore } from '../../stores/useChatStore';
import { useSocketStore } from '../../stores/useSocketStore';
import styles from './index.module.less';

interface InteractiveOptionsProps {
  /** 提示文字 */
  prompt?: string;
  /** 选项列表（纯字符串） */
  items: string[];
  /** 富选项列表（带描述） */
  richItems?: RichChoiceItem[];
  /** 用户已选择的索引 */
  selectedIndex?: number;
  /** 是否可交互（仅最后一条 bot 消息可交互） */
  interactive: boolean;
  /** 消息 ID（用于更新 metadata） */
  messageId?: string;
  /** 会话 ID */
  conversationId?: string;
}

const InteractiveOptions: React.FC<InteractiveOptionsProps> = ({
  prompt, items, richItems, selectedIndex, interactive, messageId, conversationId,
}) => {
  if (!items || items.length === 0) return null;

  /** 是否已选择（不可再交互） */
  const hasSelected = selectedIndex !== undefined && selectedIndex >= 0;
  /** 是否允许点击 */
  const canInteract = interactive && !hasSelected;

  const handleClick = (idx: number) => {
    if (!canInteract) return;
    const label = richItems?.[idx]?.label || items[idx];
    // 发送选中的选项文字作为用户消息
    useChatStore.getState().sendMessage(label);
    // 更新 metadata 持久化已选状态
    if (messageId && conversationId) {
      const { socket } = useSocketStore.getState();
      socket?.emit('message:update-metadata', {
        messageId,
        conversationId,
        metadataUpdate: { choices: { selectedIndex: idx } },
      });
    }
  };

  return (
    <div className={styles.card}>
      {/* 卡片头部 */}
      <div className={styles.header}>
        <RobotOutlined className={styles.headerIcon} />
        <span className={styles.headerText}>{prompt || '请选择一个选项'}</span>
      </div>
      <div className={styles.divider} />
      {/* 选项列表 */}
      <div className={styles.optionList}>
        {items.map((item, idx) => {
          const rich = richItems?.[idx];
          const isSelected = hasSelected && selectedIndex === idx;
          const isDisabled = hasSelected && selectedIndex !== idx;

          return (
            <button
              key={idx}
              type="button"
              className={`${styles.optionItem} ${isSelected ? styles.optionSelected : ''} ${isDisabled ? styles.optionDisabled : ''} ${canInteract ? styles.optionHoverable : ''}`}
              onClick={() => handleClick(idx)}
              disabled={!canInteract}
            >
              <div className={styles.optionContent}>
                <span className={styles.optionLabel}>{rich?.label || item}</span>
                {rich?.description && (
                  <span className={styles.optionDesc}>{rich.description}</span>
                )}
              </div>
              {isSelected && <CheckOutlined className={styles.checkIcon} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default InteractiveOptions;
