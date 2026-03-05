/**
 * Bot 日志查看器
 *
 * Modal 组件，展示 Agent 生成日志（含步骤时间线）。
 * 支持分页、展开查看详情、清空日志。
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, Typography, Tag, Pagination, Popconfirm,
  Button, Spin, message as antMessage, Empty, Space, Tooltip,
} from 'antd';
import {
  CopyOutlined, DeleteOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ToolOutlined,
  CodeOutlined, RobotOutlined, ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { AgentGenerationLog, AgentStepLog } from '@chat/shared';
import { botService } from '../../services/botService';
import styles from './BotLogViewer.module.less';

const { Text } = Typography;

interface BotLogViewerProps {
  visible: boolean;
  onClose: () => void;
  botId: string;
  botName: string;
}

const PAGE_SIZE = 20;

/** 步骤类型 → 图标 */
const STEP_ICONS: Record<string, React.ReactNode> = {
  llm_call: <RobotOutlined />,
  tool_call: <ThunderboltOutlined />,
  tool_result: <CodeOutlined />,
  error: <CloseCircleOutlined />,
};

/** 步骤类型 → 中文标签 */
const STEP_TYPE_LABELS: Record<string, string> = {
  llm_call: 'LLM 调用',
  tool_call: '工具调用',
  tool_result: '工具返回',
  error: '错误',
};

const BotLogViewer: React.FC<BotLogViewerProps> = ({ visible, onClose, botId, botName }) => {
  const [logs, setLogs] = useState<AgentGenerationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const loadLogs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const offset = (p - 1) * PAGE_SIZE;
      const result = await botService.getGenerationLogs(botId, offset, PAGE_SIZE);
      setLogs(result.logs);
      setTotal(result.total);
    } catch {
      void antMessage.error('加载日志失败');
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    if (visible) {
      setPage(1);
      setExpandedId(null);
      setExpandedStepId(null);
      void loadLogs(1);
    }
  }, [visible, loadLogs]);

  const handleCopyJson = (data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    void antMessage.success('已复制');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    setExpandedId(null);
    setExpandedStepId(null);
    void loadLogs(p);
  };

  const handleClear = async () => {
    try {
      await botService.clearGenerationLogs(botId);
      setLogs([]);
      setTotal(0);
      setPage(1);
      void antMessage.success('日志已清空');
    } catch {
      void antMessage.error('清空日志失败');
    }
  };

  const renderStepItem = (step: AgentStepLog) => {
    const isStepExpanded = expandedStepId === step.id;
    const isError = step.type === 'error' || !!step.error;
    const typeLabel = STEP_TYPE_LABELS[step.type] || step.type;
    const icon = STEP_ICONS[step.type] || <ClockCircleOutlined />;

    return (
      <div key={step.id} className={styles.stepItem}>
        <div className={styles.stepConnector}>
          <div className={`${styles.stepDot} ${isError ? styles.stepDotError : ''}`}>
            {icon}
          </div>
          <div className={styles.stepLine} />
        </div>
        <div
          className={`${styles.stepContent} ${isError ? styles.stepContentError : ''}`}
          onClick={() => setExpandedStepId(isStepExpanded ? null : step.id)}
        >
          <div className={styles.stepHeader}>
            <span className={styles.stepIndex}>#{step.stepIndex}</span>
            <Tag color={isError ? 'error' : step.type === 'llm_call' ? 'blue' : 'green'} style={{ margin: 0 }}>
              {typeLabel}
            </Tag>
            {step.toolName && <Text code style={{ fontSize: 12 }}>{step.toolName}</Text>}
            <Tag style={{ margin: 0 }}>{step.durationMs}ms</Tag>
          </div>

          {isStepExpanded && (
            <div className={styles.stepDetail} onClick={(e) => e.stopPropagation()}>
              {step.llmInfo && (
                <div style={{ marginBottom: 6 }}>
                  <Tag color="blue">{step.llmInfo.provider}/{step.llmInfo.model}</Tag>
                  {step.llmInfo.finishReason && <Tag>{step.llmInfo.finishReason}</Tag>}
                </div>
              )}
              {step.toolInput && (
                <>
                  <div className={styles.sectionTitle}>
                    <span>Input</span>
                    <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyJson(step.toolInput)} /></Tooltip>
                  </div>
                  <div className={styles.jsonBlock}>
                    {JSON.stringify(step.toolInput, null, 2)}
                  </div>
                </>
              )}
              {step.toolOutput && (
                <>
                  <div className={styles.sectionTitle} style={{ marginTop: 6 }}>
                    <span>Output</span>
                    <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyJson(step.toolOutput)} /></Tooltip>
                  </div>
                  <div className={styles.jsonBlock}>
                    {step.toolOutput}
                  </div>
                </>
              )}
              {step.error && (
                <>
                  <div className={styles.sectionTitle} style={{ marginTop: 6, color: '#ff4d4f' }}>
                    <span>Error</span>
                  </div>
                  <div className={styles.jsonBlock} style={{ background: '#fff2f0', color: '#ff4d4f' }}>
                    {step.error}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLogItem = (log: AgentGenerationLog) => {
    const isExpanded = expandedId === log.generationId;
    const isError = !log.success;

    return (
      <div
        key={log.generationId}
        className={`${styles.logItem} ${isError ? styles.error : ''}`}
        onClick={() => {
          setExpandedId(isExpanded ? null : log.generationId);
          setExpandedStepId(null);
        }}
      >
        <div className={styles.logHeader}>
          <div className={styles.logMeta}>
            <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(log.startTime)}</Text>
            <Tag>{log.totalDurationMs}ms</Tag>
            <Tag icon={<ThunderboltOutlined />} color="purple">{log.stepCount} 步</Tag>
          </div>
          {isError ? (
            <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
          ) : (
            <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
          )}
        </div>

        {log.error && !isExpanded && (
          <Text type="danger" style={{ fontSize: 12, marginTop: 4 }}>{log.error}</Text>
        )}

        {isExpanded && (
          <div className={styles.stepTimeline} onClick={(e) => e.stopPropagation()}>
            {log.steps.map(renderStepItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={`Bot 日志 — ${botName}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={760}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      destroyOnHidden
    >
      {/* 工具栏 */}
      <div className={styles.toolbarRow}>
        <Text type="secondary">共 {total} 条日志</Text>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => loadLogs(page)}
          >
            刷新
          </Button>
          <Popconfirm
            title="确定清空所有日志？"
            onConfirm={handleClear}
            okText="确定"
            cancelText="取消"
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              disabled={total === 0}
            >
              清空
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {/* 日志列表 */}
      <Spin spinning={loading}>
        {logs.length === 0 ? (
          <Empty description="暂无日志" className={styles.emptyState} />
        ) : (
          logs.map(renderLogItem)
        )}
      </Spin>

      {/* 分页 */}
      {total > PAGE_SIZE && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={handlePageChange}
            size="small"
            showSizeChanger={false}
          />
        </div>
      )}
    </Modal>
  );
};

export default BotLogViewer;
