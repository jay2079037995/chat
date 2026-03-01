import React from 'react';
import { Layout, Button, Typography } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../../auth/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import UserSearch from '../../components/UserSearch';
import styles from './index.module.less';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

const Home: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Layout className={styles.layout}>
      <Header className={styles.header}>
        <Text strong className={styles.brand}>
          Chat
        </Text>
        <div className={styles.userInfo}>
          <Text className={styles.username}>{user?.username}</Text>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
            登出
          </Button>
        </div>
      </Header>
      <Layout>
        <Sider width={300} className={styles.sider}>
          <div className={styles.searchArea}>
            <UserSearch />
          </div>
        </Sider>
        <Content className={styles.content}>
          <div className={styles.placeholder}>
            <Typography.Title level={4}>欢迎使用 Chat</Typography.Title>
            <Text type="secondary">选择一个用户开始聊天</Text>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Home;
