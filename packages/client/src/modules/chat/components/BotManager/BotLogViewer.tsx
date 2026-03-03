/**
 * LLM 调用日志查看器
 *
 * Modal 组件，展示 Server Bot 的 LLM API 调用日志。
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
} from '@ant-design/icons';
import type { LLMCallLog } from '@chat/shared';
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

const BotLogViewer: React.FC<BotLogViewerProps> = ({ visible, onClose, botId, botName }) => {
  const [logs, setLogs] = useState<LLMCallLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const offset = (p - 1) * PAGE_SIZE;
      const result = await botService.getBotLogs(botId, offset, PAGE_SIZE);
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
      void loadLogs(1);
    }
  }, [visible, loadLogs]);

  const handlePageChange = (p: number) => {
    setPage(p);
    setExpandedId(null);
    void loadLogs(p);
  };

  const handleClear = async () => {
    try {
      await botService.clearBotLogs(botId);
      setLogs([]);
      setTotal(0);
      setPage(1);
      void antMessage.success('日志已清空');
    } catch {
      void antMessage.error('清空日志失败');
    }
  };

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

  const renderLogItem = (log: LLMCallLog) => {
    const isError = !!log.error;
    const isExpanded = expandedId === log.id;

    return (
      <div
        key={log.id}
        className={`${styles.logItem} ${isError ? styles.error : ''}`}
        onClick={() => setExpandedId(isExpanded ? null : log.id)}
      >
        {/* 头部：时间、provider/model、耗时、状态 */}
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

        {/* 展开详情 */}
        {isExpanded && (
          <div className={styles.logDetail} onClick={(e) => e.stopPropagation()}>
            {/* Request Messages */}
            <div className={styles.sectionTitle}>
              <span>Request Messages ({log.request.messages.length})</span>
              <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyJson(log.request.messages)} /></Tooltip>
            </div>
            <div className={styles.jsonBlock}>
              {JSON.stringify(log.request.messages, null, 2)}
            </div>

            {/* Tools */}
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

            {/* Response */}
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

            {/* Error */}
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

  return (
    <Modal
      title={`LLM 调用日志 — ${botName}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={720}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      destroyOnClose
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
