import React, { useEffect } from 'react';
import { RobotOutlined } from '@ant-design/icons';
import AgentList from './components/AgentList';
import AgentForm from './components/AgentForm';
import AgentLog from './components/AgentLog';
import { useAgentStore } from './stores/useAgentStore';
import styles from './App.module.less';

const App: React.FC = () => {
  const {
    agents,
    selectedAgentId,
    editing,
    loadAgents,
    addLog,
    updateAgentState,
  } = useAgentStore();

  useEffect(() => {
    loadAgents();

    // 订阅日志和状态推送
    const unsubLog = window.agentAPI.onAgentLog((entry) => {
      addLog(entry);
    });
    const unsubStatus = window.agentAPI.onAgentStatusChange((agentId, state) => {
      updateAgentState(agentId, state);
    });

    return () => {
      unsubLog();
      unsubStatus();
    };
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  const renderMain = () => {
    if (editing) {
      return <AgentForm agent={selectedAgent} />;
    }

    if (selectedAgent) {
      return <AgentLog agent={selectedAgent} />;
    }

    return (
      <div className={styles.welcome}>
        <RobotOutlined className={styles.welcomeIcon} />
        <h2>Agent App</h2>
        <p>创建 Agent 连接 Chat 机器人，实现 AI 自动对话</p>
      </div>
    );
  };

  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>
        <AgentList />
      </div>
      <div className={styles.main}>{renderMain()}</div>
    </div>
  );
};

export default App;
