/**
 * 消息气泡组件
 *
 * 根据消息类型渲染不同的消息内容，支持撤回显示、编辑标记、
 * 引用快照、表情回应（reactions）。
 */
import React from 'react';
import type { Message } from '@chat/shared';
import ImageMessage from '../ImageMessage';
import AudioMessage from '../AudioMessage';
import CodeMessage from '../CodeMessage';
import MarkdownMessage from '../MarkdownMessage';
import FileMessage from '../FileMessage';
import { useSocketStore } from '../../stores/useSocketStore';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
import styles from './index.module.less';

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  participantNames?: Record<string, string>;
}

/** 将文本中的 @username 高亮渲染 */
function renderTextWithMentions(
  content: string,
  mentions: string[],
  participantNames: Record<string, string>,
  isSelf: boolean,
): React.ReactNode {
  // 构建 username → userId 反查表
  const usernameToId: Record<string, string> = {};
  for (const [uid, name] of Object.entries(participantNames)) {
    usernameToId[name] = uid;
  }

  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const uname = part.slice(1);
      if (usernameToId[uname] && mentions.includes(usernameToId[uname])) {
        return (
          <span key={i} className={isSelf ? styles.mentionSelf : styles.mention}>
            {part}
          </span>
        );
      }
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** 渲染引用快照（消息气泡内的引用块） */
const ReplySnapshotBlock: React.FC<{
  message: Message;
  participantNames?: Record<string, string>;
  isSelf: boolean;
}> = ({ message, participantNames, isSelf }) => {
  if (!message.replySnapshot) return null;
  const senderName = participantNames?.[message.replySnapshot.senderId]
    || message.replySnapshot.senderId;
  const summary = message.replySnapshot.content.length > 100
    ? message.replySnapshot.content.slice(0, 100) + '...'
    : message.replySnapshot.content;

  return (
    <div className={isSelf ? styles.replySnapshotSelf : styles.replySnapshot}>
      <span className={styles.replySnapshotSender}>{senderName}</span>
      <span className={styles.replySnapshotContent}>{summary}</span>
    </div>
  );
};

/** 渲染 Reactions（消息下方的 emoji pills） */
const ReactionsBar: React.FC<{
  message: Message;
}> = ({ message }) => {
  if (!message.reactions || Object.keys(message.reactions).length === 0) return null;

  const currentUser = useAuthStore.getState().user;

  /** 点击 reaction pill 切换自己的回应 */
  const handleToggle = (emoji: string) => {
    const { socket } = useSocketStore.getState();
    socket?.emit('message:react', {
      messageId: message.id,
      conversationId: message.conversationId,
      emoji,
    });
  };

  return (
    <div className={styles.reactionsBar}>
      {Object.entries(message.reactions).map(([emoji, userIds]) => {
        const isActive = currentUser ? userIds.includes(currentUser.id) : false;
        return (
          <button
            key={emoji}
            type="button"
            className={`${styles.reactionPill} ${isActive ? styles.reactionActive : ''}`}
            onClick={() => handleToggle(emoji)}
          >
            <span className={styles.reactionEmoji}>{emoji}</span>
            <span className={styles.reactionCount}>{userIds.length}</span>
          </button>
        );
      })}
    </div>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isSelf, participantNames }) => {
  // 已撤回的消息显示撤回提示
  if (message.recalled) {
    const senderName = isSelf
      ? '你'
      : (participantNames?.[message.senderId] || message.senderId);
    return (
      <div className={styles.recalled}>
        {senderName}撤回了一条消息
      </div>
    );
  }

  /** 渲染消息主体内容 */
  const renderContent = () => {
    switch (message.type) {
      case 'image':
        return <ImageMessage message={message} />;
      case 'audio':
        return <AudioMessage message={message} />;
      case 'code':
        return <CodeMessage message={message} />;
      case 'markdown':
        return <MarkdownMessage message={message} isSelf={isSelf} />;
      case 'file':
        return <FileMessage message={message} />;
      case 'text':
      default:
        if (message.mentions?.length && participantNames) {
          return <span>{renderTextWithMentions(message.content, message.mentions, participantNames, isSelf)}</span>;
        }
        return <span>{message.content}</span>;
    }
  };

  return (
    <div>
      {/* 转发标记 */}
      {message.forwardedFrom && (
        <div className={isSelf ? styles.forwardedTagSelf : styles.forwardedTag}>
          ↗ 转发自 {message.forwardedFrom.senderName}
        </div>
      )}
      {/* 引用快照 */}
      <ReplySnapshotBlock message={message} participantNames={participantNames} isSelf={isSelf} />
      {/* 消息内容 */}
      {renderContent()}
      {/* 已编辑标记 */}
      {message.edited && (
        <span className={isSelf ? styles.editedTagSelf : styles.editedTag}>(已编辑)</span>
      )}
      {/* Reactions */}
      <ReactionsBar message={message} />
    </div>
  );
};

export default MessageBubble;
