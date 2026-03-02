/**
 * 会话列表组件
 *
 * 展示用户所有聊天会话，包含对方用户名、最后消息预览、时间、
 * 在线状态指示器和未读消息数 badge。
 */
import React from 'react';
import { Avatar, Badge } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/useChatStore';
import { useSocketStore } from '../../stores/useSocketStore';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
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

const ConversationList: React.FC = () => {
  const conversations = useChatStore((s) => s.conversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const participantNames = useChatStore((s) => s.participantNames);
  const groupNames = useChatStore((s) => s.groupNames);
  const onlineUsers = useSocketStore((s) => s.onlineUsers);
  const currentUser = useAuthStore((s) => s.user);

  if (conversations.length === 0) {
    return <div className={styles.empty}>暂无会话，搜索用户开始聊天</div>;
  }

  return (
    <div className={styles.container}>
      {conversations.map((conv) => {
        const isActive = conv.id === currentConversationId;
        const isGroup = conv.type === 'group';

        // 群聊：显示群名；私聊：显示对方用户名
        let displayName: string;
        let isOnline = false;

        if (isGroup) {
          displayName = groupNames[conv.id] || '群聊';
        } else {
          const otherParticipantId = conv.participants.find((p) => p !== currentUser?.id) || '';
          displayName = participantNames[otherParticipantId] || otherParticipantId;
          isOnline = onlineUsers.has(otherParticipantId);
        }

        // 群聊 lastMessage 预览加上发送者名称
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
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
            onClick={() => selectConversation(conv.id)}
          >
            <div className={styles.avatarWrapper}>
              <Avatar
                icon={isGroup ? <TeamOutlined /> : <UserOutlined />}
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              />
              {!isGroup && isOnline && <span className={styles.onlineIndicator} />}
            </div>
            <div className={styles.info}>
              <div className={styles.nameRow}>
                <span className={styles.name}>{displayName}</span>
                {conv.lastMessage && (
                  <span className={styles.time}>{formatTime(conv.lastMessage.createdAt)}</span>
                )}
              </div>
              <div className={styles.lastMessage}>
                {lastMessagePreview}
              </div>
            </div>
            {conv.unreadCount > 0 && (
              <Badge count={conv.unreadCount} className={styles.badge} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ConversationList;
