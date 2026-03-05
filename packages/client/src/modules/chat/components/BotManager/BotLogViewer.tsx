/**
 * Bot 日志查看器
 *
 * Modal 组件，展示 Server Bot 的日志信息。
 * 包含两个 Tab：LLM 调用日志 和 Agent 生成日志（含步骤时间线）。
 * 支持分页、展开查看详情、清空日志。
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, Typography, Tag, Pagination, Popconfirm,
  Button, Spin, message as antMessage, Empty, Space, Tooltip, Segmented,
} from 'antd';
import {
  CopyOutlined, DeleteOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ToolOutlined,
  CodeOutlined, RobotOutlined, ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { LLMCallLog, AgentGenerationLog, AgentStepLog } from '@chat/shared';
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

type TabKey = 'llm' | 'agent';

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
  const [tab, setTab] = useState<TabKey>('agent');

  // LLM logs state
  const [llmLogs, setLlmLogs] = useState<LLMCallLog[]>([]);
  const [llmTotal, setLlmTotal] = useState(0);
  const [llmPage, setLlmPage] = useState(1);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmExpandedId, setLlmExpandedId] = useState<string | null>(null);

  // Agent logs state
  const [agentLogs, setAgentLogs] = useState<AgentGenerationLog[]>([]);
  const [agentTotal, setAgentTotal] = useState(0);
  const [agentPage, setAgentPage] = useState(1);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentExpandedId, setAgentExpandedId] = useState<string | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const loadLlmLogs = useCallback(async (p: number) => {
    setLlmLoading(true);
    try {
      const offset = (p - 1) * PAGE_SIZE;
      const result = await botService.getBotLogs(botId, offset, PAGE_SIZE);
      setLlmLogs(result.logs);
      setLlmTotal(result.total);
    } catch {
      void antMessage.error('加载日志失败');
    } finally {
      setLlmLoading(false);
    }
  }, [botId]);

  const loadAgentLogs = useCallback(async (p: number) => {
    setAgentLoading(true);
    try {
      const offset = (p - 1) * PAGE_SIZE;
      const result = await botService.getGenerationLogs(botId, offset, PAGE_SIZE);
      setAgentLogs(result.logs);
      setAgentTotal(result.total);
    } catch {
      void antMessage.error('加载日志失败');
    } finally {
      setAgentLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    if (visible) {
      setLlmPage(1);
      setLlmExpandedId(null);
      setAgentPage(1);
      setAgentExpandedId(null);
      setExpandedStepId(null);
      if (tab === 'llm') {
        void loadLlmLogs(1);
      } else {
        void loadAgentLogs(1);
      }
    }
  }, [visible, tab, loadLlmLogs, loadAgentLogs]);

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

  // ─── LLM Logs Tab ────────────────────

  const handleLlmPageChange = (p: number) => {
    setLlmPage(p);
    setLlmExpandedId(null);
    void loadLlmLogs(p);
  };

  const handleClearLlm = async () => {
    try {
      await botService.clearBotLogs(botId);
      setLlmLogs([]);
      setLlmTotal(0);
      setLlmPage(1);
      void antMessage.success('日志已清空');
    } catch {
      void antMessage.error('清空日志失败');
    }
  };

  const renderLlmLogItem = (log: LLMCallLog) => {
    const isError = !!log.error;
    const isExpanded = llmExpandedId === log.id;

    return (
      <div
        key={log.id}
        className={`${styles.logItem} ${isError ? styles.error : ''}`}
        onClick={() => setLlmExpandedId(isExpanded ? null : log.id)}
      >
        <div className={styles.logHeader}>
          <div className={styles.logMeta}>
            <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(log.timestamp)}</Text>
            <Tag color="blue">{log.request.provider}/{log.request.model}</Tag>
            <Tag>{log.durationMs}ms</Tag>
            {log.toolRound !== undefined && (
              <Tag icon={<ToolOutlined />} color="purple">Round {log.toolRound}</Tag>
            )}
          </div>
          {isError ? (
            <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
          ) : (
            <Tag icon={<CheckCircleOutlined />} color="success">
              {log.response?.toolCalls ? 'Tool Call' : '成功'}
            </Tag>
          )}
        </div>

        {isExpanded && (
          <div className={styles.logDetail} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sectionTitle}>
              <span>Request Messages ({log.request.messages.length})</span>
              <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyJson(log.request.messages)} /></Tooltip>
            </div>
            <div className={styles.jsonBlock}>
              {JSON.stringify(log.request.messages, null, 2)}
            </div>

            {log.request.tools && log.request.tools.length > 0 && (
              <>
                <div className={styles.sectionTitle} style={{ marginTop: 8 }}>
                  <span>Tools ({log.request.tools.length})</span>
                </div>
                <div className={styles.jsonBlock}>
                  {log.request.tools.map((t) => t.name).join(', ')}
                </div>
              </>
            )}

            {log.response && (
              <>
                <div className={styles.sectionTitle} style={{ marginTop: 8 }}>
                  <span>Response (finish: {log.response.finishReason})</span>
                  <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyJson(log.response)} /></Tooltip>
                </div>
                <div className={styles.jsonBlock}>
                  {JSON.stringify(log.response, null, 2)}
                </div>
              </>
            )}

            {log.error && (
              <>
                <div className={styles.sectionTitle} style={{ marginTop: 8, color: '#ff4d4f' }}>
                  <span>Error</span>
                </div>
                <div className={styles.jsonBlock} style={{ background: '#fff2f0', color: '#ff4d4f' }}>
                  {log.error}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Agent Logs Tab ────────────────────

  const handleAgentPageChange = (p: number) => {
    setAgentPage(p);
    setAgentExpandedId(null);
    setExpandedStepId(null);
    void loadAgentLogs(p);
  };

  const handleClearAgent = async () => {
    try {
      await botService.clearGenerationLogs(botId);
      setAgentLogs([]);
      setAgentTotal(0);
      setAgentPage(1);
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

  const renderAgentLogItem = (log: AgentGenerationLog) => {
    const isExpanded = agentExpandedId === log.generationId;
    const isError = !log.success;

    return (
      <div
        key={log.generationId}
        className={`${styles.logItem} ${isError ? styles.error : ''}`}
        onClick={() => {
          setAgentExpandedId(isExpanded ? null : log.generationId);
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

  // ─── Render ────────────────────

  const isLlm = tab === 'llm';
  const currentTotal = isLlm ? llmTotal : agentTotal;
  const currentPage = isLlm ? llmPage : agentPage;
  const currentLoading = isLlm ? llmLoading : agentLoading;

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
      {/* Tab 切换 */}
      <div style={{ marginBottom: 12 }}>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
          options={[
            { label: 'Agent 日志', value: 'agent' },
            { label: 'LLM 日志', value: 'llm' },
          ]}
        />
      </div>

      {/* 工具栏 */}
      <div className={styles.toolbarRow}>
        <Text type="secondary">共 {currentTotal} 条日志</Text>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => isLlm ? loadLlmLogs(currentPage) : loadAgentLogs(currentPage)}
          >
            刷新
          </Button>
          <Popconfirm
            title="确定清空所有日志？"
            onConfirm={isLlm ? handleClearLlm : handleClearAgent}
            okText="确定"
            cancelText="取消"
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              disabled={currentTotal === 0}
            >
              清空
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {/* 日志列表 */}
      <Spin spinning={currentLoading}>
        {isLlm ? (
          llmLogs.length === 0 ? (
            <Empty description="暂无日志" className={styles.emptyState} />
          ) : (
            llmLogs.map(renderLlmLogItem)
          )
        ) : (
          agentLogs.length === 0 ? (
            <Empty description="暂无日志" className={styles.emptyState} />
          ) : (
            agentLogs.map(renderAgentLogItem)
          )
        )}
      </Spin>

      {/* 分页 */}
      {currentTotal > PAGE_SIZE && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Pagination
            current={currentPage}
            pageSize={PAGE_SIZE}
            total={currentTotal}
            onChange={isLlm ? handleLlmPageChange : handleAgentPageChange}
            size="small"
            showSizeChanger={false}
          />
        </div>
      )}
    </Modal>
  );
};

export default BotLogViewer;
