import React, { useRef, useEffect } from 'react';
import { Button, Tag, Alert, Space } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useAgentStore } from '../../stores/useAgentStore';
import type { AgentConfig } from '../../../shared/types';
import styles from './index.module.less';

interface AgentLogProps {
  agent: AgentConfig;
}

const AgentLog: React.FC<AgentLogProps> = ({ agent }) => {
  const { agentStates, logs, startAgent, stopAgent, setEditing } = useAgentStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  const state = agentStates[agent.id];
  const status = state?.status ?? 'stopped';
  const messagesProcessed = state?.messagesProcessed ?? 0;
  const lastError = state?.lastError;

  // 过滤当前 agent 的日志
  const agentLogs = logs.filter((l) => l.agentId === agent.id);

  // 自动滚动到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentLogs.length]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour12: false });
  };

  const statusTag = () => {
    switch (status) {
      case 'running':
        return <Tag color="success">运行中</Tag>;
      case 'error':
        return <Tag color="error">异常</Tag>;
      default:
        return <Tag>已停止</Tag>;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <span className={styles.title}>{agent.name}</span>
          <span style={{ marginLeft: 8 }}>{statusTag()}</span>
        </div>
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditing(true)}
          >
            编辑
          </Button>
          {status === 'running' ? (
            <Button
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={() => stopAgent(agent.id)}
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => startAgent(agent.id)}
            >
              启动
            </Button>
          )}
        </Space>
      </div>

      {lastError && status === 'error' && (
        <Alert
          className={styles.errorBanner}
          type="error"
          message={`错误: ${lastError}`}
          showIcon
          closable
        />
      )}

      <div className={styles.stats}>
        <div className={styles.statItem}>
          提供商: <span className={styles.statValue}>{agent.provider}</span>
        </div>
        <div className={styles.statItem}>
          模型: <span className={styles.statValue}>{agent.model}</span>
        </div>
        <div className={styles.statItem}>
          已处理: <span className={styles.statValue}>{messagesProcessed}</span> 条
        </div>
      </div>

      <div className={styles.logPanel}>
        {agentLogs.length === 0 ? (
          <div className={styles.emptyLog}>暂无日志，启动 Agent 后将在此显示运行日志</div>
        ) : (
          agentLogs.map((entry, idx) => (
            <div key={idx} className={styles.logEntry}>
              <span className={styles.logTime}>{formatTime(entry.timestamp)}</span>
              <span
                className={
                  entry.level === 'error'
                    ? styles.logError
                    : entry.level === 'warn'
                      ? styles.logWarn
                      : styles.logInfo
                }
              >
                {entry.message}
              </span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default AgentLog;
