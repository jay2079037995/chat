/**
 * 机器人管理抽屉组件
 *
 * 列表展示用户的机器人（用户名、token 复制、删除），
 * 创建新机器人并展示 token（仅显示一次）。
 */
import React, { useEffect, useState } from 'react';
import { Drawer, Button, Input, List, Typography, Popconfirm, message as antMessage, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, CopyOutlined, RobotOutlined } from '@ant-design/icons';
import type { Bot } from '@chat/shared';
import { botService } from '../../services/botService';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import styles from './index.module.less';

const { Text, Paragraph } = Typography;

interface BotManagerProps {
  visible: boolean;
  onClose: () => void;
}

const BotManager: React.FC<BotManagerProps> = ({ visible, onClose }) => {
  const isMobile = useIsMobile();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);

  const loadBots = async () => {
    setLoading(true);
    try {
      const list = await botService.listBots();
      setBots(list);
    } catch {
      void antMessage.error('加载机器人列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      void loadBots();
      setNewToken(null);
      setNewBotName('');
    }
  }, [visible]);

  const handleCreate = async () => {
    const name = newBotName.trim();
    if (!name) {
      void antMessage.warning('请输入机器人用户名');
      return;
    }
    if (!name.toLowerCase().endsWith('bot')) {
      void antMessage.warning('机器人用户名必须以 bot 结尾');
      return;
    }

    setCreating(true);
    try {
      const { bot, token } = await botService.createBot(name);
      setBots((prev) => [...prev, bot]);
      setNewToken(token);
      setNewBotName('');
      void antMessage.success('机器人创建成功');
    } catch (err: any) {
      const msg = err?.response?.data?.error || '创建失败';
      void antMessage.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await botService.deleteBot(id);
      setBots((prev) => prev.filter((b) => b.id !== id));
      void antMessage.success('机器人已删除');
    } catch {
      void antMessage.error('删除失败');
    }
  };

  const handleCopyToken = (token: string) => {
    void navigator.clipboard.writeText(token);
    void antMessage.success('Token 已复制到剪贴板');
  };

  return (
    <Drawer
      title="机器人管理"
      open={visible}
      onClose={onClose}
      width={isMobile ? '100%' : 420}
    >
      {/* 创建区域 */}
      <div className={styles.createArea}>
        <Input
          placeholder="输入机器人用户名（须以 bot 结尾）"
          value={newBotName}
          onChange={(e) => setNewBotName(e.target.value)}
          onPressEnter={handleCreate}
          disabled={creating}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          loading={creating}
          className={styles.createBtn}
        >
          创建
        </Button>
      </div>

      {/* 新创建的 token 提示 */}
      {newToken && (
        <Alert
          className={styles.tokenAlert}
          type="success"
          message="机器人创建成功"
          description={
            <div>
              <Text type="secondary">请保存以下 Token（仅显示一次）：</Text>
              <div className={styles.tokenRow}>
                <Paragraph
                  className={styles.tokenText}
                  copyable={{ text: newToken }}
                  ellipsis={{ rows: 1 }}
                >
                  {newToken}
                </Paragraph>
              </div>
            </div>
          }
          closable
          onClose={() => setNewToken(null)}
        />
      )}

      {/* 机器人列表 */}
      <List
        loading={loading}
        dataSource={bots}
        locale={{ emptyText: '暂无机器人' }}
        renderItem={(bot) => (
          <List.Item
            actions={[
              <Popconfirm
                key="delete"
                title="确定删除该机器人？"
                onConfirm={() => handleDelete(bot.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              avatar={<RobotOutlined className={styles.botIcon} />}
              title={bot.username}
              description={`创建于 ${new Date(bot.createdAt).toLocaleDateString('zh-CN')}`}
            />
          </List.Item>
        )}
      />
    </Drawer>
  );
};

export default BotManager;
