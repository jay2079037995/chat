/**
 * 会话右键菜单组件
 *
 * 在会话列表项上右键弹出，支持置顶/免打扰/标签/归档/删除。
 * 移动端以底部 ActionSheet 形式弹出。
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Input, Tag, Popconfirm } from 'antd';
import { PushpinOutlined, BellOutlined, TagOutlined, InboxOutlined, DeleteOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/useChatStore';
import styles from './index.module.less';

interface ConversationContextMenuProps {
  conversationId: string;
  position: { x: number; y: number };
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  tags: string[];
  isMobile?: boolean;
  onClose: () => void;
}

const ConversationContextMenu: React.FC<ConversationContextMenuProps> = ({
  conversationId,
  position,
  isPinned,
  isMuted,
  isArchived,
  tags,
  isMobile,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagValue, setTagValue] = useState('');

  const togglePinConversation = useChatStore((s) => s.togglePinConversation);
  const toggleMuteConversation = useChatStore((s) => s.toggleMuteConversation);
  const toggleArchiveConversation = useChatStore((s) => s.toggleArchiveConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const setConversationTags = useChatStore((s) => s.setConversationTags);

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

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handlePin = useCallback(() => {
    void togglePinConversation(conversationId);
    onClose();
  }, [conversationId, togglePinConversation, onClose]);

  const handleMute = useCallback(() => {
    void toggleMuteConversation(conversationId);
    onClose();
  }, [conversationId, toggleMuteConversation, onClose]);

  const handleArchive = useCallback(() => {
    void toggleArchiveConversation(conversationId);
    onClose();
  }, [conversationId, toggleArchiveConversation, onClose]);

  const handleDelete = useCallback(() => {
    void deleteConversation(conversationId);
    onClose();
  }, [conversationId, deleteConversation, onClose]);

  const handleAddTag = useCallback(() => {
    const trimmed = tagValue.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setTagValue('');
      return;
    }
    void setConversationTags(conversationId, [...tags, trimmed]);
    setTagValue('');
    setShowTagInput(false);
  }, [tagValue, tags, conversationId, setConversationTags]);

  const handleRemoveTag = useCallback((removedTag: string) => {
    void setConversationTags(conversationId, tags.filter((t) => t !== removedTag));
  }, [tags, conversationId, setConversationTags]);

  const itemClass = `${styles.menuItem} ${isMobile ? styles.menuItemMobile : ''}`;

  const renderMenuContent = () => (
    <>
      <button type="button" className={itemClass} onClick={handlePin}>
        <PushpinOutlined /> {isPinned ? '取消置顶' : '置顶'}
      </button>
      <button type="button" className={itemClass} onClick={handleMute}>
        <BellOutlined /> {isMuted ? '取消免打扰' : '免打扰'}
      </button>

      {/* 标签管理 */}
      <div className={itemClass} onClick={() => setShowTagInput(!showTagInput)}>
        <TagOutlined /> 标签
      </div>
      {showTagInput && (
        <div className={styles.tagSection} onClick={(e) => e.stopPropagation()}>
          <div className={styles.tagList}>
            {tags.map((tag) => (
              <Tag key={tag} closable onClose={() => handleRemoveTag(tag)}>{tag}</Tag>
            ))}
          </div>
          {tags.length < 5 && (
            <Input
              size="small"
              placeholder="添加标签"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              onPressEnter={handleAddTag}
              maxLength={20}
              className={styles.tagInput}
              autoFocus
            />
          )}
        </div>
      )}

      <div className={styles.divider} />

      <button type="button" className={itemClass} onClick={handleArchive}>
        <InboxOutlined /> {isArchived ? '取消归档' : '归档'}
      </button>

      <Popconfirm
        title="确定删除此会话？"
        description="删除后将从你的会话列表中移除"
        onConfirm={handleDelete}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <button type="button" className={`${itemClass} ${styles.danger}`}>
          <DeleteOutlined /> 删除
        </button>
      </Popconfirm>
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
            className={`${itemClass} ${styles.cancelBtn}`}
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  // 桌面端
  return (
    <div ref={menuRef} className={styles.menu} style={{ left: position.x, top: position.y }}>
      {renderMenuContent()}
    </div>
  );
};

export default ConversationContextMenu;
