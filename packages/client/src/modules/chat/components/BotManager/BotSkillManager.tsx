/**
 * Bot Skill 管理组件
 *
 * 每个 Bot 拥有独立的 Skill 列表，支持：
 *   - Tab 1「已安装」：列表 + 卸载 + 从本地目录安装
 *   - Tab 2「在线搜索」：搜索 claude-plugins.dev + 安装
 *   - 点击 Skill 可查看 SKILL.md 内容
 *
 * 仅 Electron 桌面端可用。
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, Tabs, Input, Button, Tag, Popconfirm, Typography,
  message as antMessage, Spin, Empty, Space,
} from 'antd';
import {
  DownloadOutlined, DeleteOutlined, FolderOpenOutlined,
  CloudDownloadOutlined, CheckCircleOutlined, StarOutlined,
} from '@ant-design/icons';
import styles from './SkillMarketplace.module.less';

const { Text } = Typography;
const { Search } = Input;

/** 已安装的 Skill 元数据 */
interface SkillMeta {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  source?: 'local' | 'online';
}

/** 已安装 Skill 完整内容 */
interface SkillContent extends SkillMeta {
  instructions: string;
}

/** 在线搜索结果条目 */
interface PluginEntry {
  id: string;
  name: string;
  namespace: string;
  description: string;
  sourceUrl: string;
  author: string;
  stars: number;
  installs: number;
  metadata: {
    repoOwner: string;
    repoName: string;
    directoryPath: string;
    rawFileUrl: string;
  };
}

/** electronAPI 类型 */
interface BotSkillAPI {
  isElectron: boolean;
  listBotSkills: (botId: string) => Promise<SkillMeta[]>;
  installBotSkill: (botId: string, sourcePath: string) => Promise<SkillMeta>;
  installBotSkillFromUrl: (botId: string, entry: PluginEntry) => Promise<SkillMeta>;
  uninstallBotSkill: (botId: string, skillName: string) => Promise<boolean>;
  getBotSkillContent: (botId: string, skillName: string) => Promise<SkillContent>;
  selectSkillDir: () => Promise<string | null>;
  searchPlugins: (query: string, limit?: number, offset?: number) => Promise<{
    skills: PluginEntry[];
    total: number;
  }>;
}

function getBotSkillAPI(): BotSkillAPI | null {
  const api = (window as any).electronAPI;
  if (api && api.isElectron && api.listBotSkills) return api as BotSkillAPI;
  return null;
}

interface BotSkillManagerProps {
  visible: boolean;
  onClose: () => void;
  botId: string;
  onSkillChanged?: () => void;
}

const BotSkillManager: React.FC<BotSkillManagerProps> = ({ visible, onClose, botId, onSkillChanged }) => {
  const api = getBotSkillAPI();

  // 已安装 Tab
  const [installed, setInstalled] = useState<SkillMeta[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);

  // 在线搜索 Tab
  const [searchResults, setSearchResults] = useState<PluginEntry[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);

  // Skill 详情弹窗
  const [detailSkill, setDetailSkill] = useState<SkillContent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const installedNames = new Set(installed.map((s) => s.name));

  const loadInstalled = useCallback(async () => {
    if (!api || !botId) return;
    setInstalledLoading(true);
    try {
      const list = await api.listBotSkills(botId);
      setInstalled(list);
    } catch {
      void antMessage.error('加载已安装 Skill 失败');
    } finally {
      setInstalledLoading(false);
    }
  }, [api, botId]);

  useEffect(() => {
    if (visible && api && botId) {
      void loadInstalled();
      setSearchText('');
      setSearchResults([]);
    }
  }, [visible, api, botId, loadInstalled]);

  /** 从本地目录安装 */
  const handleLocalInstall = async () => {
    if (!api) return;
    try {
      const dir = await api.selectSkillDir();
      if (!dir) return;
      await api.installBotSkill(botId, dir);
      void antMessage.success('Skill 安装成功');
      void loadInstalled();
      onSkillChanged?.();
    } catch (err: any) {
      void antMessage.error(err?.message || '安装失败');
    }
  };

  /** 卸载 Skill */
  const handleUninstall = async (name: string) => {
    if (!api) return;
    try {
      await api.uninstallBotSkill(botId, name);
      void antMessage.success('Skill 已卸载');
      void loadInstalled();
      onSkillChanged?.();
    } catch {
      void antMessage.error('卸载失败');
    }
  };

  /** 在线搜索 */
  const handleSearch = async (query: string) => {
    if (!api || !query.trim()) return;
    setSearchLoading(true);
    try {
      const result = await api.searchPlugins(query.trim());
      setSearchResults(result.skills || []);
    } catch {
      void antMessage.error('搜索失败');
    } finally {
      setSearchLoading(false);
    }
  };

  /** 从在线安装 */
  const handleOnlineInstall = async (entry: PluginEntry) => {
    if (!api) return;
    setInstalling(entry.id);
    try {
      await api.installBotSkillFromUrl(botId, entry);
      void antMessage.success(`${entry.name} 安装成功`);
      void loadInstalled();
      onSkillChanged?.();
    } catch (err: any) {
      void antMessage.error(err?.message || '下载安装失败');
    } finally {
      setInstalling(null);
    }
  };

  /** 查看 Skill 详情 */
  const handleViewDetail = async (skillName: string) => {
    if (!api) return;
    setDetailLoading(true);
    try {
      const content = await api.getBotSkillContent(botId, skillName);
      setDetailSkill(content);
    } catch {
      void antMessage.error('加载 Skill 详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // 非 Electron 环境
  if (!api) {
    return (
      <Modal
        title="Skill 管理"
        open={visible}
        onCancel={onClose}
        footer={null}
        destroyOnClose
      >
        <div className={styles.notAvailable}>
          <Text type="secondary">Skill 管理仅在桌面端可用，请使用 Electron 客户端。</Text>
        </div>
      </Modal>
    );
  }

  const installedTab = (
    <div className={styles.tabContent}>
      <div className={styles.localActions}>
        <Space>
          <Button icon={<FolderOpenOutlined />} onClick={handleLocalInstall}>
            从本地目录安装
          </Button>
        </Space>
      </div>

      <Spin spinning={installedLoading}>
        {installed.length === 0 ? (
          <Empty description="暂无已安装的 Skill" className={styles.emptyState} />
        ) : (
          installed.map((skill) => (
            <div key={skill.name} className={styles.skillItem}>
              <div className={styles.skillInfo} onClick={() => handleViewDetail(skill.name)} style={{ cursor: 'pointer' }}>
                <span className={styles.skillName}>{skill.name}</span>
                {skill.source === 'online' && <Tag color="blue">online</Tag>}
                <div><Text type="secondary">{skill.description}</Text></div>
                <div className={styles.skillMeta}>
                  <Text type="secondary">
                    {skill.version && `v${skill.version}`}
                    {skill.author && ` · ${skill.author}`}
                  </Text>
                </div>
                {skill.tags && skill.tags.length > 0 && (
                  <div className={styles.skillTags}>
                    {skill.tags.map((tag) => (
                      <Tag key={tag} color="default">{tag}</Tag>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.skillActions}>
                <Popconfirm
                  title={`确定卸载 ${skill.name}？`}
                  onConfirm={() => handleUninstall(skill.name)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button type="text" danger icon={<DeleteOutlined />} size="small">卸载</Button>
                </Popconfirm>
              </div>
            </div>
          ))
        )}
      </Spin>
    </div>
  );

  const onlineTab = (
    <div className={styles.tabContent}>
      <div className={styles.searchRow}>
        <Search
          placeholder="搜索 Skill（关键词）"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={handleSearch}
          allowClear
          enterButton
        />
      </div>
      <Spin spinning={searchLoading}>
        {searchResults.length === 0 ? (
          <Empty description={searchText ? '没有匹配的 Skill' : '输入关键词搜索 claude-plugins.dev'} className={styles.emptyState} />
        ) : (
          searchResults.map((entry) => {
            const isInstalled = installedNames.has(entry.name);
            return (
              <div key={entry.id} className={styles.skillItem}>
                <div className={styles.skillInfo}>
                  <span className={styles.skillName}>{entry.name}</span>
                  {entry.namespace && <Tag>{entry.namespace}</Tag>}
                  {isInstalled && <Tag icon={<CheckCircleOutlined />} color="success">已安装</Tag>}
                  <div><Text type="secondary">{entry.description}</Text></div>
                  <div className={styles.skillMeta}>
                    <Text type="secondary">
                      {entry.author}
                      {entry.stars > 0 && <> · <StarOutlined /> {entry.stars}</>}
                    </Text>
                  </div>
                </div>
                <div className={styles.skillActions}>
                  <Button
                    type={isInstalled ? 'default' : 'primary'}
                    icon={isInstalled ? <DownloadOutlined /> : <CloudDownloadOutlined />}
                    size="small"
                    loading={installing === entry.id}
                    onClick={() => handleOnlineInstall(entry)}
                  >
                    {isInstalled ? '重新安装' : '安装'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </Spin>
    </div>
  );

  return (
    <>
      <Modal
        title="Skill 管理"
        open={visible}
        onCancel={onClose}
        footer={null}
        width={640}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        destroyOnClose
      >
        <Tabs
          defaultActiveKey="installed"
          items={[
            { key: 'installed', label: '已安装', children: installedTab },
            { key: 'online', label: '在线搜索', children: onlineTab },
          ]}
        />
      </Modal>

      {/* Skill 详情弹窗 */}
      <Modal
        title={detailSkill?.name || 'Skill 详情'}
        open={!!detailSkill}
        onCancel={() => setDetailSkill(null)}
        footer={null}
        width={560}
        loading={detailLoading}
      >
        {detailSkill && (
          <div className={styles.skillDetail}>
            <div className={styles.skillDetailHeader}>
              <Tag color="blue">{detailSkill.name}</Tag>
              {detailSkill.version && <Tag>v{detailSkill.version}</Tag>}
              {detailSkill.author && <Text type="secondary"> by {detailSkill.author}</Text>}
            </div>
            <p>{detailSkill.description}</p>
            {detailSkill.tags && detailSkill.tags.length > 0 && (
              <div className={styles.skillTags}>
                {detailSkill.tags.map((tag) => (
                  <Tag key={tag} color="default">{tag}</Tag>
                ))}
              </div>
            )}
            {detailSkill.instructions && (
              <div className={styles.skillInstructions}>
                <Text strong>SKILL.md 指令</Text>
                <pre className={styles.markdownContent}>{detailSkill.instructions}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default BotSkillManager;
