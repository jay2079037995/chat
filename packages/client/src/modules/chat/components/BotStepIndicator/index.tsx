/**
 * Bot 执行步骤进度指示器
 *
 * 在聊天窗口输入框上方显示当前 Agent 执行的步骤信息，
 * 包括步骤描述、详情和耗时计时器。
 */
import React, { useEffect, useState } from 'react';
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import styles from './index.module.less';

/** 工具名 → 中文描述映射 */
const STEP_LABELS: Record<string, string> = {
  generating: '正在生成回复',
  bash_exec: '正在执行命令',
  read_file: '正在读取文件',
  write_file: '正在写入文件',
  send_file_to_chat: '正在发送文件',
  present_choices: '正在发送选项',
};

function getStepLabel(step: string): string {
  return STEP_LABELS[step] || `正在执行 ${step}`;
}

function truncateDetail(detail?: string, max = 60): string {
  if (!detail) return '';
  return detail.length > max ? detail.slice(0, max) + '...' : detail;
}

interface BotStepIndicatorProps {
  step: string;
  status: 'start' | 'complete' | 'error';
  detail?: string;
  timestamp: number;
}

const BotStepIndicator: React.FC<BotStepIndicatorProps> = ({ step, status, detail, timestamp }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== 'start') return;
    setElapsed(Math.floor((Date.now() - timestamp) / 1000));
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timestamp) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [status, timestamp]);

  const icon = status === 'error'
    ? <CloseCircleOutlined className={styles.iconError} />
    : status === 'complete'
    ? <CheckCircleOutlined className={styles.iconComplete} />
    : <LoadingOutlined className={styles.iconLoading} />;

  return (
    <div className={`${styles.indicator} ${status === 'error' ? styles.indicatorError : ''}`}>
      {icon}
      <span className={styles.label}>{getStepLabel(step)}</span>
      {detail && <span className={styles.detail}>{truncateDetail(detail)}</span>}
      {status === 'start' && <span className={styles.timer}>{elapsed}s</span>}
    </div>
  );
};

export default BotStepIndicator;
