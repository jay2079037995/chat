/**
 * 通用头像组件
 *
 * 有 avatar URL 时显示图片，否则显示用户名首字母 + 渐变背景。
 * 支持私聊和群聊两种图标模式。
 */
import React from 'react';
import { Avatar } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/useChatStore';

/** 根据字符串生成稳定的渐变颜色 */
function getGradient(str: string): string {
  const gradients = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    'linear-gradient(135deg, #fccb90, #d57eeb)',
    'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

interface UserAvatarProps {
  /** 用户 ID（用于从 store 获取头像 + 生成 fallback 颜色） */
  userId: string;
  /** 头像大小 */
  size?: number;
  /** 是否为群聊头像 */
  isGroup?: boolean;
  /** 直接传入的头像 URL（优先于 store） */
  avatarUrl?: string;
  /** 直接传入的用户名（用于 fallback 首字母） */
  username?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  size = 40,
  isGroup = false,
  avatarUrl,
  username,
}) => {
  const participantAvatars = useChatStore((s) => s.participantAvatars);
  const participantNames = useChatStore((s) => s.participantNames);

  const avatar = avatarUrl || participantAvatars?.[userId];
  const name = username || participantNames?.[userId] || userId;

  if (isGroup) {
    return (
      <Avatar
        size={size}
        icon={<TeamOutlined />}
        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
      />
    );
  }

  if (avatar) {
    return <Avatar size={size} src={avatar} />;
  }

  // Fallback: 首字母 + 渐变背景
  const initial = name.charAt(0).toUpperCase();
  return (
    <Avatar
      size={size}
      style={{
        background: getGradient(userId),
        fontSize: size * 0.4,
        fontWeight: 600,
      }}
    >
      {initial}
    </Avatar>
  );
};

export default UserAvatar;
