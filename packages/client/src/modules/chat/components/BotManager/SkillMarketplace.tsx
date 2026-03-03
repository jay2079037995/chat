/**
 * Skill 市场组件
 *
 * Modal 组件，包含两个 Tab：
 *   - 已安装：显示本地自定义 Skill，支持卸载和本地安装
 *   - 在线市场：浏览注册表中的 Skill，支持搜索、安装
 *
 * 仅 Electron 桌面端可用。
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, Tabs, Input, Button, Tag, Popconfirm, Typography,
  message as antMessage, Spin, Empty, Space, Collapse,
} from 'antd';
import {
  DownloadOutlined, DeleteOutlined, FolderOpenOutlined,
  PlusOutlined, CloseOutlined, CloudDownloadOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import type { SkillRegistryEntry } from '@chat/shared';
import styles from './SkillMarketplace.module.less';

const { Text } = Typography;
const { Search } = Input;

/** 本地已安装的 Skill */
interface InstalledSkill {
  name: string;
  displayName: string;
  description: string;
  version?: string;
  author?: string;
}

/** electronAPI 市场相关方法 */
interface MarketplaceAPI {
  isElectron: boolean;
  listCustomSkills: () => Promise<InstalledSkill[]>;
  installSkill: (sourcePath: string) => Promise<unknown>;
  uninstallSkill: (skillName: string) => Promise<boolean>;
  selectSkillDir: () => Promise<string | null>;
  getSkillRegistries: () => Promise<string[]>;
  setSkillRegistries: (urls: string[]) => Promise<void>;
  fetchMarketplaceSkills: () => Promise<SkillRegistryEntry[]>;
  downloadAndInstallSkill: (entry: SkillRegistryEntry) => Promise<unknown>;
}

function getMarketplaceAPI(): MarketplaceAPI | null {
  const api = (window as any).electronAPI;
  if (api && api.isElectron && api.fetchMarketplaceSkills) return api as MarketplaceAPI;
  return null;
}

interface SkillMarketplaceProps {
  visible: boolean;
  onClose: () => void;
  /** 安装/卸载后触发同步 */
  onSkillChanged?: () => void;
}

const SkillMarketplace: React.FC<SkillMarketplaceProps> = ({ visible, onClose, onSkillChanged }) => {
  const api = getMarketplaceAPI();

  // 已安装 Tab
  const [installed, setInstalled] = useState<InstalledSkill[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);

  // 在线市场 Tab
  const [onlineSkills, setOnlineSkills] = useState<SkillRegistryEntry[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);

  // 注册表管理
  const [registries, setRegistries] = useState<string[]>([]);
  const [newRegistryUrl, setNewRegistryUrl] = useState('');

  const installedNames = new Set(installed.map((s) => s.name));

  const loadInstalled = useCallback(async () => {
    if (!api) return;
    setInstalledLoading(true);
    try {
      const list = await api.listCustomSkills();
      setInstalled(list);
    } catch {
      void antMessage.error('加载已安装 Skill 失败');
    } finally {
      setInstalledLoading(false);
    }
  }, [api]);

  const loadOnline = useCallback(async () => {
    if (!api) return;
    setOnlineLoading(true);
    try {
      const skills = await api.fetchMarketplaceSkills();
      setOnlineSkills(skills);
    } catch {
      void antMessage.error('加载在线 Skill 失败');
    } finally {
      setOnlineLoading(false);
    }
  }, [api]);

  const loadRegistries = useCallback(async () => {
    if (!api) return;
    try {
      const urls = await api.getSkillRegistries();
      setRegistries(urls);
    } catch {
      // ignore
    }
  }, [api]);

  useEffect(() => {
    if (visible && api) {
      void loadInstalled();
      void loadOnline();
      void loadRegistries();
      setSearchText('');
    }
  }, [visible, api, loadInstalled, loadOnline, loadRegistries]);

  /** 从本地目录安装 */
  const handleLocalInstall = async () => {
    if (!api) return;
    try {
      const dir = await api.selectSkillDir();
      if (!dir) return;
      await api.installSkill(dir);
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
      await api.uninstallSkill(name);
      void antMessage.success('Skill 已卸载');
      void loadInstalled();
      onSkillChanged?.();
    } catch {
      void antMessage.error('卸载失败');
    }
  };

  /** 从在线市场安装 */
  const handleOnlineInstall = async (entry: SkillRegistryEntry) => {
    if (!api) return;
    setInstalling(entry.name);
    try {
      await api.downloadAndInstallSkill(entry);
      void antMessage.success(`${entry.displayName} 安装成功`);
      void loadInstalled();
      onSkillChanged?.();
    } catch (err: any) {
      void antMessage.error(err?.message || '下载安装失败');
    } finally {
      setInstalling(null);
    }
  };

  /** 添加注册表 */
  const handleAddRegistry = async () => {
    if (!api || !newRegistryUrl.trim()) return;
    const url = newRegistryUrl.trim();
    if (registries.includes(url)) {
      void antMessage.warning('该注册表已存在');
      return;
    }
    try {
      const updated = [...registries, url];
      await api.setSkillRegistries(updated);
      setRegistries(updated);
      setNewRegistryUrl('');
      void loadOnline();
    } catch {
      void antMessage.error('添加注册表失败');
    }
  };

  /** 移除注册表 */
  const handleRemoveRegistry = async (url: string) => {
    if (!api) return;
    try {
      const updated = registries.filter((r) => r !== url);
      await api.setSkillRegistries(updated);
      setRegistries(updated);
      void loadOnline();
    } catch {
      void antMessage.error('移除注册表失败');
    }
  };

  /** 搜索过滤 */
  const filteredOnline = searchText
    ? onlineSkills.filter((s) =>
        s.name.toLowerCase().includes(searchText.toLowerCase()) ||
        s.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
        s.description.toLowerCase().includes(searchText.toLowerCase()) ||
        (s.tags?.some((t) => t.toLowerCase().includes(searchText.toLowerCase())))
      )
    : onlineSkills;

  // 非 Electron 环境
  if (!api) {
    return (
      <Modal
        title="Skill 市场"
        open={visible}
        onCancel={onClose}
        footer={null}
        destroyOnClose
      >
        <div className={styles.notAvailable}>
          <Text type="secondary">Skill 市场仅在桌面端可用，请使用 Electron 客户端。</Text>
        </div>
      </Modal>
    );
  }

  const installedTab = (
    <div className={styles.tabContent}>
      <div className={styles.localActions}>
        <Button icon={<FolderOpenOutlined />} onClick={handleLocalInstall}>
          从本地目录安装
        </Button>
      </div>
      <Spin spinning={installedLoading}>
        {installed.length === 0 ? (
          <Empty description="暂无已安装的自定义 Skill" className={styles.emptyState} />
        ) : (
          installed.map((skill) => (
            <div key={skill.name} className={styles.skillItem}>
              <div className={styles.skillInfo}>
                <span className={styles.skillName}>{skill.displayName}</span>
                <Tag>{skill.name}</Tag>
                <div><Text type="secondary">{skill.description}</Text></div>
                <div className={styles.skillMeta}>
                  <Text type="secondary">
                    {skill.version && `v${skill.version}`}
                    {skill.author && ` · ${skill.author}`}
                  </Text>
                </div>
              </div>
              <div className={styles.skillActions}>
                <Popconfirm
                  title={`确定卸载 ${skill.displayName}？`}
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
          placeholder="搜索 Skill（名称/描述/标签）"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
      </div>
      <Spin spinning={onlineLoading}>
        {filteredOnline.length === 0 ? (
          <Empty description={searchText ? '没有匹配的 Skill' : '在线市场暂无 Skill'} className={styles.emptyState} />
        ) : (
          filteredOnline.map((skill) => {
            const isInstalled = installedNames.has(skill.name);
            return (
              <div key={skill.name} className={styles.skillItem}>
                <div className={styles.skillInfo}>
                  <span className={styles.skillName}>{skill.displayName}</span>
                  {isInstalled && <Tag icon={<CheckCircleOutlined />} color="success">已安装</Tag>}
                  <div><Text type="secondary">{skill.description}</Text></div>
                  <div className={styles.skillMeta}>
                    <Text type="secondary">
                      v{skill.version} · {skill.author}
                      {skill.size && ` · ${(skill.size / 1024).toFixed(0)} KB`}
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
                  <Button
                    type={isInstalled ? 'default' : 'primary'}
                    icon={isInstalled ? <DownloadOutlined /> : <CloudDownloadOutlined />}
                    size="small"
                    loading={installing === skill.name}
                    onClick={() => handleOnlineInstall(skill)}
                  >
                    {isInstalled ? '重新安装' : '安装'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </Spin>

      {/* 注册表管理 */}
      <Collapse
        ghost
        items={[{
          key: 'registry',
          label: '注册表管理',
          children: (
            <div className={styles.registrySection}>
              {registries.map((url) => (
                <div key={url} className={styles.registryItem}>
                  <span className={styles.registryUrl}>{url}</span>
                  <Button
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    size="small"
                    onClick={() => handleRemoveRegistry(url)}
                  />
                </div>
              ))}
              <div className={styles.addRegistryRow}>
                <Input
                  placeholder="输入注册表 URL"
                  value={newRegistryUrl}
                  onChange={(e) => setNewRegistryUrl(e.target.value)}
                  onPressEnter={handleAddRegistry}
                  size="small"
                />
                <Button
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={handleAddRegistry}
                  disabled={!newRegistryUrl.trim()}
                >
                  添加
                </Button>
              </div>
            </div>
          ),
        }]}
      />
    </div>
  );

  return (
    <Modal
      title="Skill 市场"
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
          { key: 'online', label: '在线市场', children: onlineTab },
        ]}
      />
    </Modal>
  );
};

export default SkillMarketplace;
