/**
 * 群成员面板组件
 *
 * Drawer 形式展示群成员列表，群主可邀请/移除成员。
 */
import React, { useEffect, useState } from 'react';
import { Drawer, List, Avatar, Button, Tag, Input, Modal, message as antMessage } from 'antd';
import { UserOutlined, CrownOutlined, SearchOutlined, DeleteOutlined, UserAddOutlined, LogoutOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/useChatStore';
import { useSocketStore } from '../../stores/useSocketStore';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
import { groupService } from '../../services/groupService';
import { userService } from '../../../home/services/userService';
import type { User } from '@chat/shared';
import styles from './index.module.less';

interface GroupMemberPanelProps {
  groupId: string;
  visible: boolean;
  onClose: () => void;
}

const GroupMemberPanel: React.FC<GroupMemberPanelProps> = ({ groupId, visible, onClose }) => {
  const participantNames = useChatStore((s) => s.participantNames);
  const conversations = useChatStore((s) => s.conversations);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const onlineUsers = useSocketStore((s) => s.onlineUsers);
  const currentUser = useAuthStore((s) => s.user);

  const [groupOwnerId, setGroupOwnerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const currentConv = conversations.find((c) => c.id === groupId);
  const members = currentConv?.participants || [];
  const isOwner = currentUser?.id === groupOwnerId;

  useEffect(() => {
    if (visible && groupId) {
      groupService.getGroup(groupId).then((data) => {
        setGroupOwnerId(data.group.ownerId);
      }).catch(() => {});
    }
  }, [visible, groupId]);

  const handleSearchUser = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setSearching(true);
    try {
      const users = await userService.search(trimmed);
      // 过滤掉已在群内的用户
      setSearchResults(users.filter((u) => !members.includes(u.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      await groupService.addMember(groupId, userId);
      void antMessage.success('已邀请');
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
      void loadConversations();
    } catch {
      void antMessage.error('邀请失败');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await groupService.removeMember(groupId, userId);
      void antMessage.success('已移除');
      void loadConversations();
    } catch {
      void antMessage.error('移除失败');
    }
  };

  const handleLeaveGroup = () => {
    Modal.confirm({
      title: '退出群聊',
      icon: <ExclamationCircleOutlined />,
      content: '确定要退出该群聊吗？退出后将不再接收群消息。',
      okText: '退出',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await groupService.leaveGroup(groupId);
          void antMessage.success('已退出群聊');
          onClose();
          void loadConversations();
        } catch {
          void antMessage.error('退出失败');
        }
      },
    });
  };

  const handleDissolveGroup = () => {
    Modal.confirm({
      title: '解散群组',
      icon: <ExclamationCircleOutlined />,
      content: '确定要解散该群组吗？解散后所有成员将被移出，且无法恢复。',
      okText: '解散',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await groupService.dissolveGroup(groupId);
          void antMessage.success('群组已解散');
          onClose();
          void loadConversations();
        } catch {
          void antMessage.error('解散失败');
        }
      },
    });
  };

  return (
    <Drawer
      title="群成员"
      placement="right"
      onClose={onClose}
      open={visible}
      width={320}
    >
      <List
        dataSource={members}
        renderItem={(memberId) => {
          const name = participantNames[memberId] || memberId;
          const isOnline = onlineUsers.has(memberId);
          const isMemberOwner = memberId === groupOwnerId;

          return (
            <List.Item
              actions={
                isOwner && memberId !== currentUser?.id
                  ? [
                      <Button
                        key="remove"
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveMember(memberId)}
                      />,
                    ]
                  : undefined
              }
            >
              <List.Item.Meta
                avatar={
                  <div className={styles.avatarWrapper}>
                    <Avatar icon={<UserOutlined />} />
                    {isOnline && <span className={styles.onlineIndicator} />}
                  </div>
                }
                title={
                  <span>
                    {name}
                    {isMemberOwner && (
                      <Tag color="gold" className={styles.ownerTag}>
                        <CrownOutlined /> 群主
                      </Tag>
                    )}
                  </span>
                }
              />
            </List.Item>
          );
        }}
      />

      {isOwner && (
        <div className={styles.inviteSection}>
          <div className={styles.inviteTitle}>邀请成员</div>
          <Input.Search
            placeholder="搜索用户"
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearchUser}
            loading={searching}
            allowClear
          />
          {searchResults.length > 0 && (
            <List
              className={styles.searchResults}
              dataSource={searchResults}
              renderItem={(user) => (
                <List.Item
                  actions={[
                    <Button
                      key="add"
                      type="link"
                      size="small"
                      icon={<UserAddOutlined />}
                      onClick={() => handleAddMember(user.id)}
                    >
                      邀请
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} size="small" />}
                    title={user.username}
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      )}

      <div className={styles.actionSection}>
        {isOwner ? (
          <Button danger block icon={<ExclamationCircleOutlined />} onClick={handleDissolveGroup}>
            解散群组
          </Button>
        ) : (
          <Button danger block icon={<LogoutOutlined />} onClick={handleLeaveGroup}>
            退出群聊
          </Button>
        )}
      </div>
    </Drawer>
  );
};

export default GroupMemberPanel;
