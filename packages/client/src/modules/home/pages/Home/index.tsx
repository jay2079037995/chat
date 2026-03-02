/**
 * 首页 —— 聊天主界面
 *
 * 布局：顶部导航栏 + 左侧（用户搜索 + 会话列表） + 右侧聊天窗口。
 * 由 AuthGuard 保护——未登录用户会被重定向到登录页。
 */
import React, { useEffect, useState } from 'react';
import { Layout, Button, Typography } from 'antd';
import { LogoutOutlined, UsergroupAddOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import UserSearch from '../../components/UserSearch';
import ConversationList from '../../../chat/components/ConversationList';
import ChatWindow from '../../../chat/components/ChatWindow';
import CreateGroupDialog from '../../../chat/components/CreateGroupDialog';
import MessageSearch from '../../../chat/components/MessageSearch';
import { useSocketStore } from '../../../chat/stores/useSocketStore';
import { useChatStore } from '../../../chat/stores/useChatStore';
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

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);

  // 挂载时建立 Socket 连接 + 加载会话列表
  useEffect(() => {
    if (sessionId) {
      loadFromCache();
      connect(sessionId);
      void loadConversations();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect, loadConversations, loadFromCache]);

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

  return (
    <Layout className={styles.layout}>
      <Header className={styles.header}>
        <Text strong className={styles.brand}>
          Chat <Text type="secondary" className={styles.version}>v0.8.0</Text>
        </Text>
        <div className={styles.userInfo}>
          <Text className={styles.username}>{user?.username}</Text>
          <Button type="text" icon={<SearchOutlined />} onClick={() => setShowMessageSearch(true)}>
            搜索
          </Button>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
            登出
          </Button>
        </div>
      </Header>
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
              <Typography.Title level={4}>欢迎使用 Chat</Typography.Title>
              <Text type="secondary">选择一个用户开始聊天</Text>
            </div>
          )}
        </Content>
      </Layout>

      <CreateGroupDialog
        visible={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />

      <MessageSearch
        visible={showMessageSearch}
        onClose={() => setShowMessageSearch(false)}
      />
    </Layout>
  );
};

export default Home;
