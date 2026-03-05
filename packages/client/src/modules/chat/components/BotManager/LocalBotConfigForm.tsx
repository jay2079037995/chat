/**
 * Bot 模型配置表单（v2.0）
 *
 * 使用 "provider/model" 格式。
 * Provider 切换时自动填充默认模型、baseUrl、显示/隐藏 apiKey。
 */
import React, { useEffect, useMemo } from 'react';
import { Form, Select, Input, InputNumber, Collapse } from 'antd';
import type { BotModelConfig } from '@chat/shared';
import { MODEL_PROVIDERS } from '@chat/shared';

const { TextArea } = Input;
const { Panel } = Collapse;

interface LocalBotConfigFormProps {
  form: ReturnType<typeof Form.useForm>[0];
  initialValues?: Partial<BotModelConfig>;
}

/** 从 "provider/model" 解析出 provider */
function getProvider(model: string): string {
  const idx = model.indexOf('/');
  return idx === -1 ? '' : model.slice(0, idx);
}

const LocalBotConfigForm: React.FC<LocalBotConfigFormProps> = ({ form, initialValues }) => {
  const modelStr = Form.useWatch('model', form) as string | undefined;
  const currentProvider = modelStr ? getProvider(modelStr) : '';

  const providerInfo = currentProvider ? MODEL_PROVIDERS[currentProvider] : undefined;

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [initialValues, form]);

  const handleProviderChange = (provider: string) => {
    const info = MODEL_PROVIDERS[provider];
    if (info && info.models.length > 0) {
      form.setFieldValue('model', `${provider}/${info.models[0]}`);
    } else {
      form.setFieldValue('model', `${provider}/`);
    }
    // 自动填充 baseUrl
    if (info?.baseUrl) {
      form.setFieldValue('baseUrl', info.baseUrl);
    } else {
      form.setFieldValue('baseUrl', undefined);
    }
  };

  const handleModelSelect = (modelId: string) => {
    form.setFieldValue('model', `${currentProvider}/${modelId}`);
  };

  // 当前 provider 的模型列表
  const modelOptions = useMemo(() => {
    if (!providerInfo) return [];
    return providerInfo.models.map(m => ({ label: m, value: m }));
  }, [providerInfo]);

  // 从 model 字符串提取 modelId 部分
  const currentModelId = modelStr ? modelStr.slice(modelStr.indexOf('/') + 1) : '';

  const defaultProvider = initialValues?.model ? getProvider(initialValues.model) : 'openai';
  const defaultModelStr = initialValues?.model || `openai/${MODEL_PROVIDERS.openai.models[0]}`;

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        model: defaultModelStr,
        systemPrompt: '你是一个有用的助手。',
        contextLength: 4096,
        apiKey: '',
        ...initialValues,
      }}
      size="small"
    >
      {/* 隐藏的 model 字段存储完整 "provider/model" */}
      <Form.Item name="model" hidden rules={[{ required: true }]}>
        <Input />
      </Form.Item>

      <Form.Item
        label="AI 服务商"
        rules={[{ required: true, message: '请选择服务商' }]}
      >
        <Select
          value={currentProvider || defaultProvider}
          onChange={handleProviderChange}
        >
          {Object.entries(MODEL_PROVIDERS).map(([key, info]) => (
            <Select.Option key={key} value={key}>
              {info.displayName}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      {providerInfo?.requiresApiKey !== false && (
        <Form.Item
          name="apiKey"
          label="API Key"
          rules={[{ required: providerInfo?.requiresApiKey, message: '请输入 API Key' }]}
        >
          <Input.Password placeholder="输入 API Key" />
        </Form.Item>
      )}

      <Form.Item
        label="模型"
        rules={[{ required: true, message: '请选择模型' }]}
      >
        {modelOptions.length > 0 ? (
          <Select value={currentModelId} onChange={handleModelSelect}>
            {modelOptions.map(opt => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
        ) : (
          <Input
            value={currentModelId}
            onChange={(e) => form.setFieldValue('model', `${currentProvider}/${e.target.value}`)}
            placeholder="输入模型名称"
          />
        )}
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
        tooltip="Agent 的最大上下文 token 数"
      >
        <InputNumber min={512} max={128000} step={512} style={{ width: '100%' }} />
      </Form.Item>

      <Collapse ghost size="small">
        <Panel header="高级选项" key="advanced">
          <Form.Item
            name="baseUrl"
            label="自定义 API 端点"
            tooltip="仅 OpenAI 兼容端点、本地模型或自定义服务商需要"
          >
            <Input placeholder="例如 http://localhost:11434/v1" />
          </Form.Item>
        </Panel>
      </Collapse>
    </Form>
  );
};

export default LocalBotConfigForm;
