import React, { useState, useCallback } from 'react';
import { Input, List, Avatar, Typography, Empty } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import type { User } from '@chat/shared';
import { userService } from '../../services/userService';
import styles from './index.module.less';

const { Text } = Typography;

interface UserSearchProps {
  onSelectUser?: (user: User) => void;
}

const UserSearch: React.FC<UserSearchProps> = ({ onSelectUser }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const users = await userService.search(trimmed);
      setResults(users);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className={styles.container}>
      <Input.Search
        placeholder="搜索用户"
        prefix={<SearchOutlined />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSearch={handleSearch}
        loading={loading}
        allowClear
      />
      {searched && (
        <div className={styles.results}>
          {results.length > 0 ? (
            <List
              dataSource={results}
              renderItem={(user) => (
                <List.Item
                  className={styles.userItem}
                  onClick={() => onSelectUser?.(user)}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={<Text>{user.username}</Text>}
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="未找到用户" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      )}
    </div>
  );
};

export default UserSearch;
