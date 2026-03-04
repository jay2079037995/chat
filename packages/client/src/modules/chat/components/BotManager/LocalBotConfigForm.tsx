/**
 * 本地 Bot Mastra 配置表单
 *
 * 创建和编辑本地机器人时使用。
 * Provider 切换时自动填充默认模型。
 * 支持 Mastra Tool 选择（从 Electron IPC 获取）。
 */
import React, { useEffect, useState } from 'react';
import { Form, Select, Input, InputNumber, Checkbox, Tooltip, Divider, Typography } from 'antd';
import type { MastraLLMConfig, MastraProvider } from '@chat/shared';
import { MASTRA_PROVIDERS } from '@chat/shared';

const { TextArea } = Input;

/** Mastra Tool 信息 */
interface MastraToolInfo {
  id: string;
  name: string;
  description: string;
}

interface LocalBotConfigFormProps {
  form: ReturnType<typeof Form.useForm>[0];
  initialValues?: Partial<MastraLLMConfig>;
}

const LocalBotConfigForm: React.FC<LocalBotConfigFormProps> = ({ form, initialValues }) => {
  const [tools, setTools] = useState<MastraToolInfo[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>(['*']);
  const provider = Form.useWatch('provider', form);

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
      if (initialValues.enabledTools) {
        setSelectedTools(initialValues.enabledTools);
      }
    }
  }, [initialValues, form]);

  // 从 Electron 加载可用 Tool 列表
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.listMastraTools) {
      electronAPI.listMastraTools().then((list: MastraToolInfo[]) => {
        setTools(list);
      }).catch(() => {
        // 非 Electron 环境忽略
      });
    }
  }, []);

  const handleProviderChange = (value: MastraProvider) => {
    const info = MASTRA_PROVIDERS[value];
    if (info && info.models.length > 0) {
      form.setFieldValue('model', info.models[0]);
    } else {
      form.setFieldValue('model', '');
    }
  };

  const isAllTools = selectedTools.includes('*');
  const allToolIds = tools.map((t) => t.id);

  const handleSelectAllChange = (checked: boolean) => {
    const newValue = checked ? ['*'] : [...allToolIds];
    setSelectedTools(newValue);
    form.setFieldValue('enabledTools', newValue);
  };

  const handleToolChange = (checkedValues: string[]) => {
    const newValue = checkedValues.length === allToolIds.length ? ['*'] : checkedValues;
    setSelectedTools(newValue);
    form.setFieldValue('enabledTools', newValue);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        provider: 'openai' as MastraProvider,
        model: MASTRA_PROVIDERS.openai.models[0],
        systemPrompt: '你是一个有用的助手。',
        contextLength: 4096,
        enabledTools: ['*'],
        ...initialValues,
      }}
      size="small"
    >
      <Form.Item
        name="provider"
        label="AI 服务商"
        rules={[{ required: true, message: '请选择服务商' }]}
      >
        <Select onChange={handleProviderChange}>
          {(Object.entries(MASTRA_PROVIDERS) as [MastraProvider, { displayName: string; models: string[] }][]).map(([key, info]) => (
            <Select.Option key={key} value={key}>
              {info.displayName}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="apiKey"
        label="API Key"
        rules={[{ required: true, message: '请输入 API Key' }]}
      >
        <Input.Password placeholder="输入 API Key" />
      </Form.Item>

      <Form.Item
        name="model"
        label="模型"
        rules={[{ required: true, message: '请选择模型' }]}
      >
        <Select>
          {provider && MASTRA_PROVIDERS[provider as MastraProvider]?.models.map((m: string) => (
            <Select.Option key={m} value={m}>
              {m}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="systemPrompt"
        label="系统提示词"
      >
        <TextArea rows={3} placeholder="输入系统提示词" />
      </Form.Item>

      <Form.Item
        name="contextLength"
        label="上下文长度 (tokens)"
        tooltip="Mastra Agent 的最大上下文 token 数"
      >
        <InputNumber min={512} max={128000} step={512} style={{ width: '100%' }} />
      </Form.Item>

      {/* 隐藏字段存储 enabledTools */}
      <Form.Item name="enabledTools" hidden>
        <Input />
      </Form.Item>

      {/* Mastra Tool 选择 */}
      {tools.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Divider style={{ margin: '8px 0' }} />
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Tool 配置
          </Typography.Text>
          <Checkbox
            checked={isAllTools}
            onChange={(e) => handleSelectAllChange(e.target.checked)}
            style={{ marginBottom: 8 }}
          >
            全部启用
          </Checkbox>
          {!isAllTools && (
            <Checkbox.Group
              value={selectedTools}
              onChange={(values) => handleToolChange(values as string[])}
              style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 24 }}
            >
              {tools.map((tool) => (
                <Tooltip key={tool.id} title={tool.description} placement="right">
                  <Checkbox value={tool.id}>{tool.name}</Checkbox>
                </Tooltip>
              ))}
            </Checkbox.Group>
          )}
        </div>
      )}
    </Form>
  );
};

export default LocalBotConfigForm;
