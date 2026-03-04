/**
 * 本地 Bot Mastra 配置表单
 *
 * 创建和编辑本地机器人时使用。
 * Provider 切换时自动填充默认模型。
 */
import React, { useEffect } from 'react';
import { Form, Select, Input, InputNumber } from 'antd';
import type { MastraLLMConfig, MastraProvider } from '@chat/shared';
import { MASTRA_PROVIDERS } from '@chat/shared';

const { TextArea } = Input;

interface LocalBotConfigFormProps {
  form: ReturnType<typeof Form.useForm>[0];
  initialValues?: Partial<MastraLLMConfig>;
}

const LocalBotConfigForm: React.FC<LocalBotConfigFormProps> = ({ form, initialValues }) => {
  const provider = Form.useWatch('provider', form);

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [initialValues, form]);

  const handleProviderChange = (value: MastraProvider) => {
    const info = MASTRA_PROVIDERS[value];
    if (info && info.models.length > 0) {
      form.setFieldValue('model', info.models[0]);
    } else {
      form.setFieldValue('model', '');
    }
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
    </Form>
  );
};

export default LocalBotConfigForm;
