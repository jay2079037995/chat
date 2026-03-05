/**
 * 机器人管理抽屉组件
 *
 * 仅支持本地模式（Electron/Mastra）。
 * 每个 Bot 拥有独立的 Skill 列表，通过 BotSkillManager 管理。
 */
import React, { useEffect, useState } from 'react';
import {
  Drawer, Button, Input, List, Typography, Popconfirm,
  message as antMessage, Modal, Form, Space,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, RobotOutlined,
  EditOutlined, FileTextOutlined, AppstoreOutlined, FolderOpenOutlined,
} from '@ant-design/icons';
import type { Bot, BotModelConfig } from '@chat/shared';
import { botService } from '../../services/botService';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import LocalBotConfigForm from './LocalBotConfigForm';
import BotLogViewer from './BotLogViewer';
import BotSkillManager from './BotSkillManager';
import styles from './index.module.less';

/** 检测是否在 Electron 环境 */
const isElectron = !!(window as any).electronAPI?.isElectron;

const { Text } = Typography;

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

  // 编辑配置 Modal
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string>('');

  // 日志查看器
  const [logBot, setLogBot] = useState<Bot | null>(null);

  // Skill 管理（per-bot）
  const [skillBotId, setSkillBotId] = useState<string | null>(null);

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
      setNewBotName('');
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

    let modelConfig: BotModelConfig | undefined;
    try {
      modelConfig = await createForm.validateFields();
    } catch {
      return;
    }

    setCreating(true);
    try {
      const { bot } = await botService.createBot(name, 'local', undefined, undefined, modelConfig);
      setBots((prev) => [...prev, bot]);
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

  const handleEditConfig = async (bot: Bot) => {
    setEditingBot(bot);
    editForm.resetFields();
    // 加载完整配置
    try {
      const { modelConfig } = await botService.getBotConfig(bot.id);
      if (modelConfig) {
        editForm.setFieldsValue(modelConfig);
      }
    } catch { /* ignore */ }
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.getWorkspacePath) {
      const path = await electronAPI.getWorkspacePath(bot.id);
      setWorkspacePath(path || '');
    }
  };

  const handleSaveConfig = async () => {
    if (!editingBot) return;
    try {
      const values = await editForm.validateFields();
      const { modelConfig: updated } = await botService.updateModelConfig(editingBot.id, values);
      setBots((prev) => prev.map((b) =>
        b.id === editingBot.id ? { ...b, modelConfig: updated } : b,
      ));
      setEditingBot(null);
      void antMessage.success('配置已更新');
    } catch {
      void antMessage.error('更新配置失败');
    }
  };

  const renderBotActions = (bot: Bot) => {
    const actions = [];

    // Skill 管理（仅 Electron）
    if (isElectron) {
      actions.push(
        <Button
          key="skills"
          type="text"
          icon={<AppstoreOutlined />}
          size="small"
          onClick={() => setSkillBotId(bot.id)}
          title="管理 Skill"
        />,
      );
    }

    // 日志按钮
    actions.push(
      <Button
        key="logs"
        type="text"
        icon={<FileTextOutlined />}
        size="small"
        onClick={() => setLogBot(bot)}
        title="调用日志"
      />,
    );

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
    const idTag = (
      <Text type="secondary" copyable={{ text: bot.id }} style={{ fontSize: 11 }}>
        ID: {bot.id.slice(0, 8)}
      </Text>
    );
    const modelStr = bot.modelConfig?.model || bot.mastraConfig?.model || '';
    return (
      <div>
        <Text type="secondary" className={styles.botMeta}>
          {modelStr} · {date}
        </Text>
        <div>{idTag}</div>
      </div>
    );
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
          onPressEnter={handleCreate}
          disabled={creating}
        />
      </div>

      {/* 模型配置 */}
      <div className={styles.configArea}>
        <LocalBotConfigForm form={createForm} />
      </div>

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
                </Space>
              }
              description={renderBotDescription(bot)}
            />
          </List.Item>
        )}
      />

      {/* 编辑配置 Modal */}
      <Modal
        title="编辑 Bot 配置"
        open={!!editingBot}
        onOk={handleSaveConfig}
        onCancel={() => setEditingBot(null)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        {editingBot && (
          <>
            <LocalBotConfigForm
              form={editForm}
              initialValues={editingBot.modelConfig}
            />
            {isElectron && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>工作目录</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Text ellipsis style={{ flex: 1, fontSize: 13 }}>{workspacePath || '加载中...'}</Text>
                  <Button
                    size="small"
                    onClick={async () => {
                      const electronAPI = (window as any).electronAPI;
                      const selected = await electronAPI?.selectWorkspaceDir();
                      if (selected) {
                        const effectivePath = await electronAPI.setCustomWorkspace(editingBot.id, selected);
                        setWorkspacePath(effectivePath);
                      }
                    }}
                    title="选择自定义工作目录"
                  >
                    选择
                  </Button>
                  <Button
                    size="small"
                    onClick={async () => {
                      const electronAPI = (window as any).electronAPI;
                      const effectivePath = await electronAPI?.setCustomWorkspace(editingBot.id, null);
                      setWorkspacePath(effectivePath);
                    }}
                    title="恢复默认工作目录"
                  >
                    默认
                  </Button>
                  <Button
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={() => (window as any).electronAPI?.openWorkspace(editingBot.id)}
                    title="在文件管理器中打开"
                  >
                    打开
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* 日志查看器 */}
      <BotLogViewer
        visible={!!logBot}
        onClose={() => setLogBot(null)}
        botId={logBot?.id || ''}
        botName={logBot?.username || ''}
      />

      {/* Per-Bot Skill 管理 */}
      <BotSkillManager
        visible={!!skillBotId}
        onClose={() => setSkillBotId(null)}
        botId={skillBotId || ''}
      />
    </Drawer>
  );
};

export default BotManager;
