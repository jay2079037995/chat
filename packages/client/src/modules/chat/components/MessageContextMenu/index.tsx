/**
 * 消息右键菜单组件
 *
 * 消息气泡上右键弹出的上下文菜单，支持回复、撤回、编辑和快捷表情回应。
 * 移动端以底部 ActionSheet 形式弹出，桌面端保持固定定位右键菜单。
 */
import React, { useEffect, useRef, useCallback } from 'react';
import type { Message } from '@chat/shared';
import { useSocketStore } from '../../stores/useSocketStore';
import { useChatStore } from '../../stores/useChatStore';
import styles from './index.module.less';

/** 快捷 Reaction Emoji 列表 */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '😢'];

interface MessageContextMenuProps {
  /** 目标消息 */
  message: Message;
  /** 是否为自己发送的消息 */
  isSelf: boolean;
  /** 菜单位置（桌面端使用） */
  position: { x: number; y: number };
  /** 该消息是否已被置顶 */
  isPinned?: boolean;
  /** 是否为移动端模式 */
  isMobile?: boolean;
  /** 关闭菜单回调 */
  onClose: () => void;
  /** 回复消息回调 */
  onReply: (message: Message) => void;
  /** 编辑消息回调 */
  onEdit: (message: Message) => void;
  /** 转发消息回调 */
  onForward?: (message: Message) => void;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  isSelf,
  position,
  isPinned,
  isMobile,
  onClose,
  onReply,
  onEdit,
  onForward,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  /** 点击菜单外部关闭 */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
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
      if (result.success) {
        useChatStore.getState().handleRecalled(message.id, message.conversationId);
      } else {
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

  /** 置顶/取消置顶消息 */
  const handlePin = useCallback(() => {
    const { socket } = useSocketStore.getState();
    socket?.emit('message:pin', {
      messageId: message.id,
      conversationId: message.conversationId,
    }, (result) => {
      if (!result.success) {
        import('antd').then(({ message: antMsg }) => {
          void antMsg.error(result.error || '操作失败');
        });
      }
    });
    onClose();
  }, [message, onClose]);

  /** 转发消息 */
  const handleForward = useCallback(() => {
    onForward?.(message);
    onClose();
  }, [message, onForward, onClose]);

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

  /** 菜单内容（桌面端和移动端共用） */
  const renderMenuContent = () => (
    <>
      {/* 快捷 Reaction 行 */}
      <div className={`${styles.reactionRow} ${isMobile ? styles.reactionRowMobile : ''}`}>
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={`${styles.reactionBtn} ${isMobile ? styles.reactionBtnMobile : ''}`}
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
        className={`${styles.menuItem} ${isMobile ? styles.menuItemMobile : ''}`}
        onClick={() => { onReply(message); onClose(); }}
      >
        💬 回复
      </button>

      {/* 转发 */}
      {onForward && (
        <button
          type="button"
          className={`${styles.menuItem} ${isMobile ? styles.menuItemMobile : ''}`}
          onClick={handleForward}
        >
          ↗️ 转发
        </button>
      )}

      {/* 置顶/取消置顶 */}
      <button
        type="button"
        className={`${styles.menuItem} ${isMobile ? styles.menuItemMobile : ''}`}
        onClick={handlePin}
      >
        📌 {isPinned ? '取消置顶' : '置顶'}
      </button>

      {/* 编辑（仅自己 + 文本类型 + 5 分钟内） */}
      {canEdit && (
        <button
          type="button"
          className={`${styles.menuItem} ${isMobile ? styles.menuItemMobile : ''}`}
          onClick={() => { onEdit(message); onClose(); }}
        >
          ✏️ 编辑
        </button>
      )}

      {/* 撤回（仅自己 + 2 分钟内） */}
      {canRecall && (
        <button
          type="button"
          className={`${styles.menuItem} ${styles.danger} ${isMobile ? styles.menuItemMobile : ''}`}
          onClick={handleRecall}
        >
          ↩️ 撤回
        </button>
      )}
    </>
  );

  // 移动端：底部 ActionSheet
  if (isMobile) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div
          ref={menuRef}
          className={styles.sheet}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.sheetHandle} />
          {renderMenuContent()}
          <div className={styles.divider} />
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemMobile} ${styles.cancelBtn}`}
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  // 桌面端：固定定位右键菜单
  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: position.x, top: position.y }}
    >
      {renderMenuContent()}
    </div>
  );
};

export default MessageContextMenu;
