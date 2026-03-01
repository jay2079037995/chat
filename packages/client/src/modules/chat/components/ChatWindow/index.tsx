/**
 * 聊天窗口组件
 *
 * 显示与某用户的聊天历史，提供消息输入和发送功能。
 * 自己的消息靠右蓝色气泡，对方的消息靠左灰色气泡。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button, Input } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/useChatStore';
import { useSocketStore } from '../../stores/useSocketStore';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
import styles from './index.module.less';

const { TextArea } = Input;

/** 格式化消息时间戳 */
function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ChatWindow: React.FC = () => {
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const messages = useChatStore((s) => s.messages);
  const conversations = useChatStore((s) => s.conversations);
  const participantNames = useChatStore((s) => s.participantNames);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const onlineUsers = useSocketStore((s) => s.onlineUsers);
  const currentUser = useAuthStore((s) => s.user);
  const [inputValue, setInputValue] = useState('');
  const messageEndRef = useRef<HTMLDivElement>(null);

  const currentMessages = currentConversationId ? messages[currentConversationId] || [] : [];

  // 找到当前会话和对方信息
  const currentConv = conversations.find((c) => c.id === currentConversationId);
  const otherParticipantId = currentConv?.participants.find((p) => p !== currentUser?.id) || '';
  const otherName = participantNames[otherParticipantId] || otherParticipantId;
  const isOnline = onlineUsers.has(otherParticipantId);

  // 新消息自动滚动到底部
  useEffect(() => {
    if (typeof messageEndRef.current?.scrollIntoView === 'function') {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages.length]);

  /** 发送消息 */
  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
    setInputValue('');
  };

  /** 键盘事件：Enter 发送，Shift+Enter 换行 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!currentConversationId) {
    return null;
  }

  return (
    <div className={styles.container}>
      {/* 顶部：对方用户名 + 在线状态 */}
      <div className={styles.header}>
        <span className={styles.headerName}>{otherName}</span>
        <span className={isOnline ? styles.onlineDot : styles.offlineDot} />
        <span className={styles.statusText}>{isOnline ? '在线' : '离线'}</span>
      </div>

      {/* 消息区域 */}
      <div className={styles.messageArea}>
        {currentMessages.map((msg) => {
          const isSelf = msg.senderId === currentUser?.id;
          return (
            <div key={msg.id}>
              <div
                className={`${styles.messageItem} ${
                  isSelf ? styles.messageItemSelf : styles.messageItemOther
                }`}
              >
                <div
                  className={`${styles.bubble} ${
                    isSelf ? styles.bubbleSelf : styles.bubbleOther
                  }`}
                >
                  {msg.content}
                </div>
              </div>
              <div
                className={`${styles.messageTime} ${
                  isSelf ? styles.messageTimeSelf : styles.messageTimeOther
                }`}
              >
                {formatMessageTime(msg.createdAt)}
              </div>
            </div>
          );
        })}
        <div ref={messageEndRef} />
      </div>

      {/* 输入区域 */}
      <div className={styles.inputArea}>
        <TextArea
          className={styles.textInput}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          autoSize={{ minRows: 1, maxRows: 4 }}
        />
        <Button
          className={styles.sendButton}
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={!inputValue.trim()}
        >
          发送
        </Button>
      </div>
    </div>
  );
};

export default ChatWindow;
