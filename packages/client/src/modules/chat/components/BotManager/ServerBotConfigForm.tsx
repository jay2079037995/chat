/**
 * 服务端 Bot LLM 配置表单
 *
 * 创建和编辑服务端机器人时共用。
 * Provider 切换时自动填充默认模型。
 */
import React, { useEffect } from 'react';
import { Form, Select, Input, InputNumber } from 'antd';
import type { LLMConfig, LLMProvider } from '@chat/shared';
import { LLM_PROVIDERS } from '@chat/shared';

const { TextArea } = Input;

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  deepseek: 'DeepSeek',
  minimax: 'MiniMax',
  openai: 'OpenAI',
  claude: 'Claude',
  qwen: '通义千问',
  custom: '自定义',
};

interface ServerBotConfigFormProps {
  form: ReturnType<typeof Form.useForm>[0];
  initialValues?: Partial<LLMConfig>;
}

const ServerBotConfigForm: React.FC<ServerBotConfigFormProps> = ({ form, initialValues }) => {
  const provider = Form.useWatch('provider', form);

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [initialValues, form]);

  const handleProviderChange = (value: LLMProvider) => {
    const info = LLM_PROVIDERS[value];
    if (info && info.models.length > 0) {
      form.setFieldValue('model', info.models[0]);
    } else {
      form.setFieldValue('model', '');
    }
    // 清空自定义字段（如果切换到非 custom）
    if (value !== 'custom') {
      form.setFieldValue('customBaseUrl', undefined);
      form.setFieldValue('customModel', undefined);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        provider: 'deepseek',
        model: LLM_PROVIDERS.deepseek.models[0],
        systemPrompt: 'You are a helpful assistant.',
        contextLength: 10,
        ...initialValues,
      }}
      size="small"
    >
      <Form.Item
        name="provider"
        label="LLM 服务商"
        rules={[{ required: true, message: '请选择服务商' }]}
      >
        <Select onChange={handleProviderChange}>
          {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
            <Select.Option key={key} value={key}>
              {label}
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

      {provider === 'custom' ? (
        <>
          <Form.Item
            name="customBaseUrl"
            label="API 地址"
            rules={[{ required: true, message: '请输入自定义 API 地址' }]}
          >
            <Input placeholder="例如 https://api.example.com/v1" />
          </Form.Item>
          <Form.Item
            name="customModel"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="输入模型名称" />
          </Form.Item>
        </>
      ) : (
        <Form.Item
          name="model"
          label="模型"
          rules={[{ required: true, message: '请选择模型' }]}
        >
          <Select>
            {provider && LLM_PROVIDERS[provider as LLMProvider]?.models.map((m: string) => (
              <Select.Option key={m} value={m}>
                {m}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      )}

      <Form.Item
        name="systemPrompt"
        label="系统提示词"
      >
        <TextArea rows={3} placeholder="输入系统提示词" />
      </Form.Item>

      <Form.Item
        name="contextLength"
        label="上下文长度"
        tooltip="保留最近 N 条对话记录作为上下文"
      >
        <InputNumber min={1} max={50} style={{ width: '100%' }} />
      </Form.Item>
    </Form>
  );
};

export default ServerBotConfigForm;
