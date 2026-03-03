/**
 * 会话列表组件
 *
 * 展示用户所有聊天会话，包含对方用户名、最后消息预览、时间、
 * 在线状态指示器和未读消息数 badge。
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Badge } from 'antd';
import { PushpinFilled, BellFilled, InboxOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/useChatStore';
import { useSocketStore } from '../../stores/useSocketStore';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { useLongPress } from '../../../../hooks/useLongPress';
import UserAvatar from '../UserAvatar';
import ConversationContextMenu from '../ConversationContextMenu';
import styles from './index.module.less';

/** 格式化时间戳为可读文本 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天';
  }

  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

/** 右键菜单状态 */
interface ContextMenuState {
  visible: boolean;
  conversationId: string;
  position: { x: number; y: number };
}

const ConversationList: React.FC = () => {
  const isMobile = useIsMobile();
  const conversations = useChatStore((s) => s.conversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const participantNames = useChatStore((s) => s.participantNames);
  const groupNames = useChatStore((s) => s.groupNames);
  const onlineUsers = useSocketStore((s) => s.onlineUsers);
  const currentUser = useAuthStore((s) => s.user);
  const botUserIds = useChatStore((s) => s.botUserIds);
  const pinnedIds = useChatStore((s) => s.pinnedIds);
  const mutedIds = useChatStore((s) => s.mutedIds);
  const archivedIds = useChatStore((s) => s.archivedIds);
  const convTags = useChatStore((s) => s.convTags);
  const tagFilter = useChatStore((s) => s.tagFilter);
  const showArchived = useChatStore((s) => s.showArchived);
  const setShowArchived = useChatStore((s) => s.setShowArchived);
  const setTagFilter = useChatStore((s) => s.setTagFilter);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    conversationId: '',
    position: { x: 0, y: 0 },
  });

  /** 长按触发上下文菜单（移动端用） */
  const longPressConvIdRef = useRef('');
  const longPress = useLongPress({
    onLongPress: () => {
      const convId = longPressConvIdRef.current;
      if (!convId) return;
      setContextMenu({
        visible: true,
        conversationId: convId,
        position: { x: 0, y: 0 },
      });
    },
  });

  /** 收集所有标签用于筛选栏 */
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const tags of Object.values(convTags)) {
      tags.forEach((t) => tagSet.add(t));
    }
    return Array.from(tagSet);
  }, [convTags]);

  /** 排序 + 筛选会话列表 */
  const sortedConversations = useMemo(() => {
    let list = conversations;
    // 归档筛选：默认隐藏归档
    if (!showArchived) {
      list = list.filter((c) => !archivedIds.has(c.id));
    } else {
      list = list.filter((c) => archivedIds.has(c.id));
    }
    // 标签筛选
    if (tagFilter) {
      list = list.filter((c) => convTags[c.id]?.includes(tagFilter));
    }
    // 排序：置顶优先 → updatedAt 降序
    return [...list].sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedIds.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return b.updatedAt - a.updatedAt;
    });
  }, [conversations, showArchived, archivedIds, tagFilter, convTags, pinnedIds]);

  const handleContextMenu = useCallback((e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    setContextMenu({ visible: true, conversationId: convId, position: { x: e.clientX, y: e.clientY } });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, conversationId: '', position: { x: 0, y: 0 } });
  }, []);

  if (conversations.length === 0) {
    return <div className={styles.empty}>暂无会话，搜索用户开始聊天</div>;
  }

  return (
    <div className={styles.container}>
      {/* 标签筛选栏 */}
      {allTags.length > 0 && (
        <div className={styles.filterBar}>
          <span
            className={`${styles.filterTag} ${!tagFilter ? styles.filterTagActive : ''}`}
            onClick={() => setTagFilter('')}
          >
            全部
          </span>
          {allTags.map((tag) => (
            <span
              key={tag}
              className={`${styles.filterTag} ${tagFilter === tag ? styles.filterTagActive : ''}`}
              onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 会话列表 */}
      {sortedConversations.map((conv) => {
        const isActive = conv.id === currentConversationId;
        const isGroup = conv.type === 'group';
        const isPinned = pinnedIds.has(conv.id);
        const isMuted = mutedIds.has(conv.id);
        const tags = convTags[conv.id] || [];

        let displayName: string;
        let isOnline = false;

        if (isGroup) {
          displayName = groupNames[conv.id] || '群聊';
        } else {
          const otherParticipantId = conv.participants.find((p) => p !== currentUser?.id) || '';
          displayName = participantNames[otherParticipantId] || otherParticipantId;
          isOnline = botUserIds.has(otherParticipantId) || onlineUsers.has(otherParticipantId);
        }

        let lastMessagePreview = conv.lastMessage?.content || '暂无消息';
        if (isGroup && conv.lastMessage) {
          const senderName = participantNames[conv.lastMessage.senderId] || '';
          if (senderName) {
            lastMessagePreview = `${senderName}: ${conv.lastMessage.content}`;
          }
        }

        return (
          <div
            key={conv.id}
            className={`${styles.item} ${isActive ? styles.itemActive : ''} ${isPinned ? styles.itemPinned : ''}`}
            onClick={() => selectConversation(conv.id)}
            onContextMenu={(e) => handleContextMenu(e, conv.id)}
            onTouchStart={(e) => { longPressConvIdRef.current = conv.id; longPress.onTouchStart(e); }}
            onTouchEnd={longPress.onTouchEnd}
            onTouchMove={longPress.onTouchMove}
          >
            <div className={styles.avatarWrapper}>
              <UserAvatar
                userId={isGroup ? conv.id : (conv.participants.find((p) => p !== currentUser?.id) || '')}
                isGroup={isGroup}
              />
              {!isGroup && isOnline && <span className={styles.onlineIndicator} />}
            </div>
            <div className={styles.info}>
              <div className={styles.nameRow}>
                <span className={styles.name}>
                  {displayName}
                  {isPinned && <PushpinFilled className={styles.pinIcon} />}
                  {isMuted && <BellFilled className={styles.muteIcon} />}
                </span>
                {conv.lastMessage && (
                  <span className={styles.time}>{formatTime(conv.lastMessage.createdAt)}</span>
                )}
              </div>
              <div className={styles.lastMessage}>
                {lastMessagePreview}
              </div>
              {tags.length > 0 && (
                <div className={styles.tagRow}>
                  {tags.map((tag) => (
                    <span key={tag} className={styles.tagPill}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            {conv.unreadCount > 0 && (
              <Badge count={isMuted ? 0 : conv.unreadCount} dot={isMuted} className={styles.badge} />
            )}
          </div>
        );
      })}

      {/* 归档入口 */}
      <div
        className={styles.archiveToggle}
        onClick={() => setShowArchived(!showArchived)}
      >
        <InboxOutlined /> {showArchived ? '返回会话' : '归档会话'}
      </div>

      {/* 右键菜单 */}
      {contextMenu.visible && (() => {
        const conv = conversations.find((c) => c.id === contextMenu.conversationId);
        if (!conv) return null;
        return (
          <ConversationContextMenu
            conversationId={contextMenu.conversationId}
            position={contextMenu.position}
            isPinned={pinnedIds.has(contextMenu.conversationId)}
            isMuted={mutedIds.has(contextMenu.conversationId)}
            isArchived={archivedIds.has(contextMenu.conversationId)}
            tags={convTags[contextMenu.conversationId] || []}
            isMobile={isMobile}
            onClose={closeContextMenu}
          />
        );
      })()}
    </div>
  );
};

export default ConversationList;
