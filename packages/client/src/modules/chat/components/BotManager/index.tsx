/**
 * 机器人管理抽屉组件
 *
 * 支持两种运行模式：
 * - 客户端模式：创建后获取 token，通过 agent-app 运行
 * - 服务端模式：创建时配置 LLM，服务器自动运行
 */
import React, { useEffect, useState } from 'react';
import {
  Drawer, Button, Input, List, Typography, Popconfirm,
  message as antMessage, Alert, Radio, Tag, Badge, Modal, Form, Space,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, RobotOutlined,
  EditOutlined, PlayCircleOutlined, PauseCircleOutlined,
} from '@ant-design/icons';
import type { Bot, LLMConfig, BotRunMode } from '@chat/shared';
import { botService } from '../../services/botService';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import ServerBotConfigForm from './ServerBotConfigForm';
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
  const [runMode, setRunMode] = useState<BotRunMode>('client');

  // 编辑配置 Modal
  const [editingBot, setEditingBot] = useState<Bot | null>(null);

  // LLM 配置表单
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

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
      setRunMode('client');
      createForm.resetFields();
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

    let llmConfig: LLMConfig | undefined;
    if (runMode === 'server') {
      try {
        llmConfig = await createForm.validateFields();
      } catch {
        return;
      }
    }

    setCreating(true);
    try {
      const { bot, token } = await botService.createBot(name, runMode, llmConfig);
      setBots((prev) => [...prev, bot]);
      if (token) {
        setNewToken(token);
      }
      setNewBotName('');
      createForm.resetFields();
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

  const handleStartStop = async (bot: Bot) => {
    try {
      if (bot.status === 'running') {
        await botService.stopBot(bot.id);
        setBots((prev) => prev.map((b) => b.id === bot.id ? { ...b, status: 'stopped' } : b));
        void antMessage.success('机器人已暂停');
      } else {
        await botService.startBot(bot.id);
        setBots((prev) => prev.map((b) => b.id === bot.id ? { ...b, status: 'running' } : b));
        void antMessage.success('机器人已启动');
      }
    } catch {
      void antMessage.error('操作失败');
    }
  };

  const handleEditConfig = (bot: Bot) => {
    setEditingBot(bot);
    editForm.resetFields();
  };

  const handleSaveConfig = async () => {
    if (!editingBot) return;
    try {
      const values = await editForm.validateFields();
      const { llmConfig: updated } = await botService.updateBotConfig(editingBot.id, values);
      setBots((prev) => prev.map((b) =>
        b.id === editingBot.id ? { ...b, llmConfig: updated } : b,
      ));
      setEditingBot(null);
      void antMessage.success('配置已更新');
    } catch {
      void antMessage.error('更新配置失败');
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'running': return <Badge status="success" text="运行中" />;
      case 'error': return <Badge status="error" text="异常" />;
      default: return <Badge status="default" text="已停止" />;
    }
  };

  const renderBotActions = (bot: Bot) => {
    const actions = [];

    if (bot.runMode === 'server') {
      actions.push(
        <Button
          key="edit"
          type="text"
          icon={<EditOutlined />}
          size="small"
          onClick={() => handleEditConfig(bot)}
          title="编辑配置"
        />,
      );
      actions.push(
        <Button
          key="toggle"
          type="text"
          icon={bot.status === 'running' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          size="small"
          onClick={() => handleStartStop(bot)}
          title={bot.status === 'running' ? '暂停' : '启动'}
        />,
      );
    }

    actions.push(
      <Popconfirm
        key="delete"
        title="确定删除该机器人？"
        onConfirm={() => handleDelete(bot.id)}
        okText="确定"
        cancelText="取消"
      >
        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
      </Popconfirm>,
    );

    return actions;
  };

  const renderBotDescription = (bot: Bot) => {
    const date = new Date(bot.createdAt).toLocaleDateString('zh-CN');
    if (bot.runMode === 'server') {
      const provider = bot.llmConfig?.provider || '';
      const model = bot.llmConfig?.model || '';
      return (
        <div>
          <div>{getStatusBadge(bot.status)}</div>
          <Text type="secondary" className={styles.botMeta}>
            {provider} / {model} · {date}
          </Text>
        </div>
      );
    }
    return `创建于 ${date}`;
  };

  return (
    <Drawer
      title="机器人管理"
      open={visible}
      onClose={onClose}
      width={isMobile ? '100%' : 480}
    >
      {/* 创建区域 */}
      <div className={styles.createArea}>
        <Input
          placeholder="输入机器人用户名（须以 bot 结尾）"
          value={newBotName}
          onChange={(e) => setNewBotName(e.target.value)}
          onPressEnter={runMode === 'client' ? handleCreate : undefined}
          disabled={creating}
        />
      </div>

      <div className={styles.runModeArea}>
        <Radio.Group
          value={runMode}
          onChange={(e) => setRunMode(e.target.value)}
          size="small"
        >
          <Radio.Button value="client">客户端运行</Radio.Button>
          <Radio.Button value="server">服务端运行</Radio.Button>
        </Radio.Group>
      </div>

      {/* 服务端模式 LLM 配置 */}
      {runMode === 'server' && (
        <div className={styles.configArea}>
          <ServerBotConfigForm form={createForm} />
        </div>
      )}

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleCreate}
        loading={creating}
        block
        className={styles.createBtn}
      >
        创建机器人
      </Button>

      {/* 新创建的 token 提示（仅客户端模式） */}
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
          <List.Item actions={renderBotActions(bot)}>
            <List.Item.Meta
              avatar={<RobotOutlined className={styles.botIcon} />}
              title={
                <Space size={4}>
                  {bot.username}
                  <Tag
                    color={bot.runMode === 'server' ? 'green' : 'blue'}
                    className={styles.modeTag}
                  >
                    {bot.runMode === 'server' ? '服务端' : '客户端'}
                  </Tag>
                </Space>
              }
              description={renderBotDescription(bot)}
            />
          </List.Item>
        )}
      />

      {/* 编辑配置 Modal */}
      <Modal
        title="编辑 LLM 配置"
        open={!!editingBot}
        onOk={handleSaveConfig}
        onCancel={() => setEditingBot(null)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        {editingBot && (
          <ServerBotConfigForm
            form={editForm}
            initialValues={editingBot.llmConfig}
          />
        )}
      </Modal>
    </Drawer>
  );
};

export default BotManager;
