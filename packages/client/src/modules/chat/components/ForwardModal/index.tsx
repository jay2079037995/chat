/**
 * 消息转发弹窗组件
 *
 * 选择目标会话后转发消息。
 */
import React, { useState, useMemo } from 'react';
import { Modal, Input, List, message as antMsg } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { Message } from '@chat/shared';
import { useChatStore } from '../../stores/useChatStore';
import UserAvatar from '../UserAvatar';
import styles from './index.module.less';

interface ForwardModalProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
}

const ForwardModal: React.FC<ForwardModalProps> = ({ visible, message, onClose }) => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const conversations = useChatStore((s) => s.conversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const participantNames = useChatStore((s) => s.participantNames);
  const groupNames = useChatStore((s) => s.groupNames);
  const forwardMessage = useChatStore((s) => s.forwardMessage);

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((c) => c.id !== currentConversationId)
      .filter((c) => {
        if (!search.trim()) return true;
        const name = c.type === 'group'
          ? groupNames[c.id] || ''
          : c.participants.map((p) => participantNames[p] || '').join(' ');
        return name.toLowerCase().includes(search.toLowerCase());
      });
  }, [conversations, currentConversationId, search, participantNames, groupNames]);

  const getConversationName = (conv: typeof conversations[0]) => {
    if (conv.type === 'group') return groupNames[conv.id] || '群聊';
    const otherId = conv.participants.find((p) => p !== useChatStore.getState().currentConversationId);
    // For private chats, find the other participant
    for (const pid of conv.participants) {
      if (participantNames[pid]) return participantNames[pid];
    }
    return '未知';
  };

  const handleForward = async (targetConversationId: string) => {
    if (!message) return;
    setLoading(true);
    try {
      await forwardMessage(message.id, targetConversationId);
      void antMsg.success('转发成功');
      onClose();
    } catch {
      void antMsg.error('转发失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="转发消息"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={400}
      destroyOnClose
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder="搜索会话..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={styles.search}
        allowClear
      />
      <div className={styles.list}>
        <List
          dataSource={filteredConversations}
          loading={loading}
          renderItem={(conv) => (
            <div
              key={conv.id}
              className={styles.item}
              onClick={() => void handleForward(conv.id)}
            >
              <UserAvatar
                userId={conv.type === 'group' ? conv.id : conv.participants[0]}
                isGroup={conv.type === 'group'}
                size={36}
              />
              <span className={styles.name}>{getConversationName(conv)}</span>
            </div>
          )}
        />
      </div>
    </Modal>
  );
};

export default ForwardModal;
