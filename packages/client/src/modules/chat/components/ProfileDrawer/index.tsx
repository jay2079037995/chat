/**
 * 个人资料编辑 Drawer
 *
 * 支持编辑昵称、简介，上传头像。
 */
import React, { useState, useEffect } from 'react';
import { Drawer, Input, Button, Upload, message as antMessage, Spin } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
import { MAX_NICKNAME_LENGTH, MAX_BIO_LENGTH, MAX_AVATAR_SIZE } from '@chat/shared';
import UserAvatar from '../UserAvatar';
import styles from './index.module.less';

const { TextArea } = Input;

interface ProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ visible, onClose }) => {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const updateAvatar = useAuthStore((s) => s.updateAvatar);

  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Drawer 打开时重置表单
  useEffect(() => {
    if (visible && user) {
      setNickname(user.nickname || '');
      setBio(user.bio || '');
    }
  }, [visible, user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ nickname: nickname.trim() || undefined, bio: bio.trim() || undefined });
      void antMessage.success('资料已更新');
      onClose();
    } catch {
      void antMessage.error('更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (file.size > MAX_AVATAR_SIZE) {
      void antMessage.error('头像文件不能超过 2MB');
      return false;
    }
    setUploadingAvatar(true);
    try {
      await updateAvatar(file);
      void antMessage.success('头像已更新');
    } catch {
      void antMessage.error('头像上传失败');
    } finally {
      setUploadingAvatar(false);
    }
    return false;
  };

  if (!user) return null;

  return (
    <Drawer
      title="个人资料"
      placement="right"
      onClose={onClose}
      open={visible}
      width={360}
    >
      <div className={styles.avatarSection}>
        <Upload
          accept="image/jpeg,image/png,image/gif,image/webp"
          showUploadList={false}
          beforeUpload={handleAvatarUpload}
        >
          <div className={styles.avatarUpload}>
            {uploadingAvatar ? (
              <Spin />
            ) : (
              <>
                <UserAvatar
                  userId={user.id}
                  size={80}
                  avatarUrl={user.avatar}
                  username={user.username}
                />
                <div className={styles.avatarOverlay}>
                  <CameraOutlined />
                </div>
              </>
            )}
          </div>
        </Upload>
        <div className={styles.username}>{user.username}</div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formItem}>
          <label className={styles.label}>昵称</label>
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="设置昵称"
            maxLength={MAX_NICKNAME_LENGTH}
            showCount
          />
        </div>

        <div className={styles.formItem}>
          <label className={styles.label}>简介</label>
          <TextArea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="介绍一下自己..."
            maxLength={MAX_BIO_LENGTH}
            showCount
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </div>

        <Button
          type="primary"
          block
          loading={saving}
          onClick={handleSave}
          className={styles.saveBtn}
        >
          保存
        </Button>
      </div>
    </Drawer>
  );
};

export default ProfileDrawer;
