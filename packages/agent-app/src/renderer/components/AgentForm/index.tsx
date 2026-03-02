import React, { useEffect } from 'react';
import { Form, Input, Select, InputNumber, Button, message } from 'antd';
import { useAgentStore } from '../../stores/useAgentStore';
import { PROVIDERS } from '../../../shared/types';
import type { AgentConfig, Provider } from '../../../shared/types';
import styles from './index.module.less';

const { TextArea } = Input;

interface AgentFormProps {
  agent?: AgentConfig | null;
}

const AgentForm: React.FC<AgentFormProps> = ({ agent }) => {
  const [form] = Form.useForm();
  const { createAgent, updateAgent, setEditing, setSelectedAgent, loadAgents } = useAgentStore();
  const isEditing = !!agent;

  useEffect(() => {
    if (agent) {
      form.setFieldsValue(agent);
    } else {
      form.resetFields();
      form.setFieldsValue({
        provider: 'deepseek',
        model: 'deepseek-chat',
        contextLength: 10,
        serverUrl: 'http://localhost:3001',
        systemPrompt: 'You are a helpful assistant.',
      });
    }
  }, [agent, form]);

  const handleProviderChange = (provider: Provider) => {
    const models = PROVIDERS[provider].models;
    form.setFieldValue('model', models[0]);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (isEditing && agent) {
        await updateAgent(agent.id, values);
        message.success('Agent 已更新');
      } else {
        const newAgent = await createAgent({
          ...values,
          enabled: false,
        });
        setSelectedAgent(newAgent.id);
        message.success('Agent 创建成功');
      }
      setEditing(false);
      await loadAgents();
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const selectedProvider = Form.useWatch('provider', form) as Provider;
  const modelOptions = selectedProvider ? PROVIDERS[selectedProvider]?.models ?? [] : [];

  return (
    <div className={styles.container}>
      <div className={styles.title}>{isEditing ? '编辑 Agent' : '新建 Agent'}</div>
      <Form
        form={form}
        layout="vertical"
        className={styles.form}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入 Agent 名称' }]}
        >
          <Input placeholder="我的 Agent" />
        </Form.Item>

        <Form.Item
          name="botToken"
          label="Bot Token"
          rules={[{ required: true, message: '请输入 Bot Token' }]}
        >
          <Input.Password placeholder="在 Chat 中创建机器人后获取的 Token" />
        </Form.Item>

        <Form.Item
          name="serverUrl"
          label="服务器地址"
          rules={[{ required: true, message: '请输入服务器地址' }]}
        >
          <Input placeholder="http://localhost:3001" />
        </Form.Item>

        <Form.Item
          name="provider"
          label="模型提供商"
          rules={[{ required: true }]}
        >
          <Select onChange={handleProviderChange}>
            <Select.Option value="deepseek">DeepSeek</Select.Option>
            <Select.Option value="minimax">MiniMax</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="apiKey"
          label="API Key"
          rules={[{ required: true, message: '请输入 API Key' }]}
        >
          <Input.Password placeholder="LLM 提供商的 API Key" />
        </Form.Item>

        <Form.Item
          name="model"
          label="模型"
          rules={[{ required: true }]}
        >
          <Select>
            {modelOptions.map((m) => (
              <Select.Option key={m} value={m}>
                {m}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="systemPrompt" label="System Prompt">
          <TextArea rows={4} placeholder="系统提示词，定义 Agent 的角色和行为" />
        </Form.Item>

        <Form.Item
          name="contextLength"
          label="上下文轮数"
          tooltip="携带最近 N 轮对话作为上下文"
        >
          <InputNumber min={1} max={50} />
        </Form.Item>

        <div className={styles.actions}>
          <Button type="primary" htmlType="submit">
            {isEditing ? '保存' : '创建'}
          </Button>
          <Button onClick={() => setEditing(false)}>取消</Button>
        </div>
      </Form>
    </div>
  );
};

export default AgentForm;
