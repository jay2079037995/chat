import React from 'react';
import { Button, Popconfirm, Space } from 'antd';
import { PlusOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../stores/useAgentStore';
import styles from './index.module.less';

const AgentList: React.FC = () => {
  const {
    agents,
    agentStates,
    selectedAgentId,
    setSelectedAgent,
    setEditing,
    deleteAgent,
    startAgent,
    stopAgent,
  } = useAgentStore();

  const handleNew = () => {
    setSelectedAgent(null);
    setEditing(true);
  };

  const getStatusClass = (agentId: string) => {
    const status = agentStates[agentId]?.status ?? 'stopped';
    switch (status) {
      case 'running':
        return styles.statusRunning;
      case 'error':
        return styles.statusError;
      default:
        return styles.statusStopped;
    }
  };

  const isRunning = (agentId: string) =>
    agentStates[agentId]?.status === 'running';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Agent 列表</h3>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleNew}>
          新建
        </Button>
      </div>

      <div className={styles.list}>
        {agents.length === 0 ? (
          <div className={styles.emptyState}>暂无 Agent，点击"新建"创建</div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.id}
              className={`${styles.agentItem} ${selectedAgentId === agent.id ? styles.agentItemSelected : ''}`}
              onClick={() => {
                setSelectedAgent(agent.id);
                setEditing(false);
              }}
            >
              <div className={`${styles.statusDot} ${getStatusClass(agent.id)}`} />
              <div className={styles.agentInfo}>
                <div className={styles.agentName}>{agent.name}</div>
                <div className={styles.agentProvider}>
                  {agent.provider} · {agent.model}
                </div>
              </div>
              <Space size={4} onClick={(e) => e.stopPropagation()}>
                {isRunning(agent.id) ? (
                  <Button
                    type="text"
                    size="small"
                    icon={<PauseCircleOutlined />}
                    onClick={() => stopAgent(agent.id)}
                  />
                ) : (
                  <Button
                    type="text"
                    size="small"
                    icon={<PlayCircleOutlined style={{ color: '#52c41a' }} />}
                    onClick={() => startAgent(agent.id)}
                  />
                )}
                <Popconfirm
                  title="确定删除该 Agent？"
                  onConfirm={() => deleteAgent(agent.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AgentList;
