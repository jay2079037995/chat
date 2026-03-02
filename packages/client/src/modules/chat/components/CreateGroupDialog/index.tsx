/**
 * 创建群组弹窗组件
 *
 * 输入群名 + 搜索并选择成员 → 创建群组。
 */
import React, { useState } from 'react';
import { Modal, Input, Button, List, Avatar, Tag, message as antMessage } from 'antd';
import { SearchOutlined, UserOutlined, CloseOutlined } from '@ant-design/icons';
import { MIN_GROUP_NAME_LENGTH, MAX_GROUP_NAME_LENGTH } from '@chat/shared';
import { useChatStore } from '../../stores/useChatStore';
import { userService } from '../../../home/services/userService';
import type { User } from '@chat/shared';
import styles from './index.module.less';

interface CreateGroupDialogProps {
  visible: boolean;
  onClose: () => void;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ visible, onClose }) => {
  const createGroup = useChatStore((s) => s.createGroup);

  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleSearch = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setSearching(true);
    try {
      const users = await userService.search(trimmed);
      // 过滤掉已选择的成员
      setSearchResults(users.filter((u) => !selectedMembers.some((m) => m.id === u.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMember = (user: User) => {
    setSelectedMembers((prev) => [...prev, user]);
    setSearchResults((prev) => prev.filter((u) => u.id !== user.id));
  };

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleCreate = async () => {
    const name = groupName.trim();
    if (name.length < MIN_GROUP_NAME_LENGTH || name.length > MAX_GROUP_NAME_LENGTH) {
      void antMessage.warning(`群名长度需要 ${MIN_GROUP_NAME_LENGTH}-${MAX_GROUP_NAME_LENGTH} 个字符`);
      return;
    }
    if (selectedMembers.length === 0) {
      void antMessage.warning('请至少选择一名成员');
      return;
    }

    setCreating(true);
    try {
      await createGroup(name, selectedMembers.map((u) => u.id));
      void antMessage.success('群组创建成功');
      handleClose();
    } catch {
      void antMessage.error('创建群组失败');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedMembers([]);
    onClose();
  };

  return (
    <Modal
      title="创建群组"
      open={visible}
      onCancel={handleClose}
      onOk={handleCreate}
      confirmLoading={creating}
      okText="创建"
      cancelText="取消"
    >
      <div className={styles.field}>
        <div className={styles.label}>群名称</div>
        <Input
          placeholder="请输入群名称"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          maxLength={MAX_GROUP_NAME_LENGTH}
        />
      </div>

      <div className={styles.field}>
        <div className={styles.label}>添加成员</div>
        <Input.Search
          placeholder="搜索用户"
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={handleSearch}
          loading={searching}
          allowClear
        />
      </div>

      {searchResults.length > 0 && (
        <List
          className={styles.searchResults}
          size="small"
          dataSource={searchResults}
          renderItem={(user) => (
            <List.Item className={styles.searchItem} onClick={() => handleSelectMember(user)}>
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} size="small" />}
                title={user.username}
              />
              <Button type="link" size="small">添加</Button>
            </List.Item>
          )}
        />
      )}

      {selectedMembers.length > 0 && (
        <div className={styles.selectedArea}>
          <div className={styles.label}>已选成员 ({selectedMembers.length})</div>
          <div className={styles.tags}>
            {selectedMembers.map((user) => (
              <Tag
                key={user.id}
                closable
                onClose={() => handleRemoveMember(user.id)}
                closeIcon={<CloseOutlined />}
              >
                {user.username}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default CreateGroupDialog;
