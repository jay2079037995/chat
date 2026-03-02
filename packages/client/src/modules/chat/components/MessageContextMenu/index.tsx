/**
 * 消息右键菜单组件
 *
 * 消息气泡上右键弹出的上下文菜单，支持回复、撤回、编辑和快捷表情回应。
 */
import React, { useEffect, useRef, useCallback } from 'react';
import type { Message } from '@chat/shared';
import { useSocketStore } from '../../stores/useSocketStore';
import styles from './index.module.less';

/** 快捷 Reaction Emoji 列表 */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '😢'];

interface MessageContextMenuProps {
  /** 目标消息 */
  message: Message;
  /** 是否为自己发送的消息 */
  isSelf: boolean;
  /** 菜单位置 */
  position: { x: number; y: number };
  /** 关闭菜单回调 */
  onClose: () => void;
  /** 回复消息回调 */
  onReply: (message: Message) => void;
  /** 编辑消息回调 */
  onEdit: (message: Message) => void;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  isSelf,
  position,
  onClose,
  onReply,
  onEdit,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  /** 点击菜单外部关闭 */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  /** 按 ESC 关闭 */
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  /** 撤回消息 */
  const handleRecall = useCallback(() => {
    const { socket } = useSocketStore.getState();
    socket?.emit('message:recall', {
      messageId: message.id,
      conversationId: message.conversationId,
    }, (result) => {
      if (!result.success) {
        import('antd').then(({ message: antMsg }) => {
          const errorMap: Record<string, string> = {
            RECALL_TIMEOUT: '已超过 2 分钟，无法撤回',
            FORBIDDEN: '只能撤回自己的消息',
            ALREADY_RECALLED: '消息已撤回',
            MESSAGE_NOT_FOUND: '消息不存在',
          };
          void antMsg.error(errorMap[result.error || ''] || '撤回失败');
        });
      }
    });
    onClose();
  }, [message, onClose]);

  /** 添加快捷 Reaction */
  const handleReaction = useCallback((emoji: string) => {
    const { socket } = useSocketStore.getState();
    socket?.emit('message:react', {
      messageId: message.id,
      conversationId: message.conversationId,
      emoji,
    });
    onClose();
  }, [message, onClose]);

  // 已撤回消息不显示菜单
  if (message.recalled) return null;

  // 判断是否可撤回（发送者 + 2 分钟内）
  const canRecall = isSelf && (Date.now() - message.createdAt) < 2 * 60 * 1000;
  // 判断是否可编辑（发送者 + 5 分钟内 + 文本/markdown 类型）
  const canEdit = isSelf
    && (Date.now() - message.createdAt) < 5 * 60 * 1000
    && (message.type === 'text' || message.type === 'markdown');

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: position.x, top: position.y }}
    >
      {/* 快捷 Reaction 行 */}
      <div className={styles.reactionRow}>
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={styles.reactionBtn}
            onClick={() => handleReaction(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      {/* 回复 */}
      <button
        type="button"
        className={styles.menuItem}
        onClick={() => { onReply(message); onClose(); }}
      >
        💬 回复
      </button>

      {/* 编辑（仅自己 + 文本类型 + 5 分钟内） */}
      {canEdit && (
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => { onEdit(message); onClose(); }}
        >
          ✏️ 编辑
        </button>
      )}

      {/* 撤回（仅自己 + 2 分钟内） */}
      {canRecall && (
        <button
          type="button"
          className={`${styles.menuItem} ${styles.danger}`}
          onClick={handleRecall}
        >
          ↩️ 撤回
        </button>
      )}
    </div>
  );
};

export default MessageContextMenu;
