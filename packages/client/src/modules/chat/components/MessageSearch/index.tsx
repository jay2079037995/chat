/**
 * 聊天记录搜索组件
 *
 * Modal 弹窗形式，输入关键词后展示匹配的消息列表，
 * 支持关键词高亮，点击结果可跳转到对应会话。
 */
import React, { useState, useRef, useCallback } from 'react';
import { Modal, Input, List, Typography, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { Message } from '@chat/shared';
import { chatService } from '../../services/chatService';
import { useChatStore } from '../../stores/useChatStore';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import styles from './index.module.less';

const { Text } = Typography;

interface MessageSearchProps {
  visible: boolean;
  onClose: () => void;
}

/** 高亮文本中的关键词 */
function highlightText(text: string, keyword: string): React.ReactNode {
  if (!keyword) return text;
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className={styles.highlight}>{text.slice(index, index + keyword.length)}</mark>
      {text.slice(index + keyword.length)}
    </>
  );
}

/** 格式化消息时间 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) +
    ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

const MessageSearch: React.FC<MessageSearchProps> = ({ visible, onClose }) => {
  const isMobile = useIsMobile();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const participantNames = useChatStore((s) => s.participantNames);
  const groupNames = useChatStore((s) => s.groupNames);
  const conversations = useChatStore((s) => s.conversations);
  const selectConversation = useChatStore((s) => s.selectConversation);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 获取会话显示名称 */
  const getConversationName = useCallback((conversationId: string): string => {
    if (groupNames[conversationId]) return groupNames[conversationId];
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv?.type === 'private') {
      const otherParticipant = conv.participants.find((p) => p !== conv.participants[0]) || conv.participants[0];
      return participantNames[otherParticipant] || otherParticipant;
    }
    return conversationId;
  }, [groupNames, conversations, participantNames]);

  /** 防抖搜索 */
  const handleSearch = useCallback((value: string) => {
    setKeyword(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const messages = await chatService.searchMessages(trimmed);
        setResults(messages);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  /** 点击结果 → 跳转会话 */
  const handleClickResult = (msg: Message) => {
    void selectConversation(msg.conversationId);
    handleClose();
  };

  /** 关闭弹窗并重置状态 */
  const handleClose = () => {
    setKeyword('');
    setResults([]);
    setSearched(false);
    onClose();
  };

  return (
    <Modal
      title="搜索聊天记录"
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={isMobile ? '95vw' : 520}
      style={isMobile ? { top: 20 } : undefined}
      destroyOnHidden
    >
      <Input
        placeholder="输入关键词搜索"
        prefix={<SearchOutlined />}
        value={keyword}
        onChange={(e) => handleSearch(e.target.value)}
        allowClear
        autoFocus
      />

      <div className={styles.resultArea}>
        {searching && (
          <div className={styles.searchingHint}>搜索中...</div>
        )}

        {!searching && searched && results.length === 0 && (
          <Empty description="未找到相关消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {!searching && results.length > 0 && (
          <List
            dataSource={results}
            renderItem={(msg) => {
              const convName = getConversationName(msg.conversationId);
              const senderName = participantNames[msg.senderId] || msg.senderId;

              return (
                <List.Item
                  className={styles.resultItem}
                  onClick={() => handleClickResult(msg)}
                >
                  <div className={styles.resultContent}>
                    <div className={styles.resultMeta}>
                      <Text strong className={styles.convName}>{convName}</Text>
                      <Text type="secondary" className={styles.resultTime}>
                        {formatTime(msg.createdAt)}
                      </Text>
                    </div>
                    <div className={styles.resultMessage}>
                      <Text type="secondary" className={styles.senderName}>{senderName}: </Text>
                      <span>{highlightText(msg.content, keyword.trim())}</span>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </Modal>
  );
};

export default MessageSearch;
