/**
 * 首页 —— 聊天主界面
 *
 * 布局：顶部导航栏 + 左侧（用户搜索 + 会话列表） + 右侧聊天窗口。
 * 移动端：单视图切换 —— 一次只显示会话列表或聊天窗口。
 * 由 AuthGuard 保护——未登录用户会被重定向到登录页。
 */
import React, { useEffect, useState } from 'react';
import { Layout, Button, Typography } from 'antd';
import { LogoutOutlined, UsergroupAddOutlined, SearchOutlined, MessageOutlined, RobotOutlined, UserOutlined, SunOutlined, MoonOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import UserSearch from '../../components/UserSearch';
import ConversationList from '../../../chat/components/ConversationList';
import ChatWindow from '../../../chat/components/ChatWindow';
import CreateGroupDialog from '../../../chat/components/CreateGroupDialog';
import MessageSearch from '../../../chat/components/MessageSearch';
import BotManager from '../../../chat/components/BotManager';
import ProfileDrawer from '../../../chat/components/ProfileDrawer';
import { useSocketStore } from '../../../chat/stores/useSocketStore';
import { useChatStore } from '../../../chat/stores/useChatStore';
import { useThemeStore } from '../../../chat/stores/useThemeStore';
import { requestNotificationPermission } from '../../../chat/utils/notification';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import InstallPrompt from '../../../../components/InstallPrompt';
import type { User } from '@chat/shared';
import styles from './index.module.less';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

const Home: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const loadFromCache = useChatStore((s) => s.loadFromCache);
  const startPrivateChat = useChatStore((s) => s.startPrivateChat);
  const currentConversationId = useChatStore((s) => s.currentConversationId);

  const isDark = useThemeStore((s) => s.isDark);
  const setMode = useThemeStore((s) => s.setMode);

  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showBotManager, setShowBotManager] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // 挂载时建立 Socket 连接 + 加载会话列表
  useEffect(() => {
    if (sessionId) {
      loadFromCache();
      connect(sessionId);
      void loadConversations();
      requestNotificationPermission();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect, loadConversations, loadFromCache]);

  // 移动端选中会话时自动切换到聊天视图
  useEffect(() => {
    if (isMobile && currentConversationId) {
      setMobileView('chat');
    }
  }, [currentConversationId, isMobile]);

  /** 登出并跳转到登录页 */
  const handleLogout = async () => {
    disconnect();
    await logout();
    navigate('/login');
  };

  /** 搜索结果中选择用户 → 创建/进入私聊 */
  const handleSelectUser = (selectedUser: User) => {
    void startPrivateChat(selectedUser.id);
  };

  /** 移动端返回按钮：清除当前会话以便再次点击同一会话时能重新进入 */
  const handleMobileBack = () => {
    setMobileView('list');
    useChatStore.setState({ currentConversationId: null });
  };

  /** 渲染 Header */
  const renderHeader = () => (
    <Header className={styles.header}>
      {isMobile && mobileView === 'chat' ? (
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          className={styles.backButton}
          onClick={handleMobileBack}
        >
          {!isMobile && '返回'}
        </Button>
      ) : (
        <Text strong className={styles.brand}>
          Chat <Text className={styles.version}>v1.14.0</Text>
        </Text>
      )}
      <div className={styles.userInfo}>
        {!isMobile && <Text className={styles.username}>{user?.username}</Text>}
        <Button type="text" icon={<UserOutlined />} onClick={() => setShowProfile(true)}>
          {!isMobile && '资料'}
        </Button>
        <Button type="text" icon={<SearchOutlined />} onClick={() => setShowMessageSearch(true)}>
          {!isMobile && '搜索'}
        </Button>
        <Button type="text" icon={<RobotOutlined />} onClick={() => setShowBotManager(true)}>
          {!isMobile && '机器人'}
        </Button>
        <Button
          type="text"
          icon={isDark ? <SunOutlined /> : <MoonOutlined />}
          onClick={() => setMode(isDark ? 'light' : 'dark')}
        />
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
          {!isMobile && '登出'}
        </Button>
      </div>
    </Header>
  );

  /** 渲染移动端布局 */
  const renderMobileLayout = () => (
    <>
      {mobileView === 'list' ? (
        <div className={styles.mobileList}>
          <div className={styles.searchArea}>
            <UserSearch onSelectUser={handleSelectUser} />
            <Button
              type="dashed"
              icon={<UsergroupAddOutlined />}
              block
              className={styles.createGroupBtn}
              onClick={() => setShowCreateGroup(true)}
            >
              创建群组
            </Button>
          </div>
          <div className={styles.conversationArea}>
            <ConversationList />
          </div>
        </div>
      ) : (
        <div className={styles.mobileChat}>
          {currentConversationId ? (
            <ChatWindow onBack={handleMobileBack} />
          ) : (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}><MessageOutlined /></div>
              <Typography.Title level={4}>欢迎使用 Chat</Typography.Title>
              <Text type="secondary">选择一个会话开始聊天</Text>
            </div>
          )}
        </div>
      )}
    </>
  );

  /** 渲染桌面端布局 */
  const renderDesktopLayout = () => (
    <Layout>
      <Sider width={300} className={styles.sider}>
        <div className={styles.searchArea}>
          <UserSearch onSelectUser={handleSelectUser} />
          <Button
            type="dashed"
            icon={<UsergroupAddOutlined />}
            block
            className={styles.createGroupBtn}
            onClick={() => setShowCreateGroup(true)}
          >
            创建群组
          </Button>
        </div>
        <div className={styles.conversationArea}>
          <ConversationList />
        </div>
      </Sider>
      <Content className={styles.content}>
        {currentConversationId ? (
          <ChatWindow />
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}><MessageOutlined /></div>
            <Typography.Title level={4}>欢迎使用 Chat</Typography.Title>
            <Text type="secondary">选择一个会话开始聊天</Text>
          </div>
        )}
      </Content>
    </Layout>
  );

  return (
    <Layout className={styles.layout}>
      <InstallPrompt />
      {renderHeader()}
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}

      <CreateGroupDialog
        visible={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />

      <MessageSearch
        visible={showMessageSearch}
        onClose={() => setShowMessageSearch(false)}
      />

      <BotManager
        visible={showBotManager}
        onClose={() => setShowBotManager(false)}
      />

      <ProfileDrawer
        visible={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </Layout>
  );
};

export default Home;
