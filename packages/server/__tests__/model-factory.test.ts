/**
 * ModelFactory 测试
 *
 * 测试 parseModelString、isReasonerModel 和 createModel provider 路由。
 */
import { parseModelString, isReasonerModel } from '../src/modules/bot/ModelFactory';

describe('ModelFactory', () => {
  describe('parseModelString', () => {
    test('解析标准格式', () => {
      expect(parseModelString('anthropic/claude-sonnet-4-5')).toEqual({
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-5',
      });
    });

    test('解析含多个斜杠的格式', () => {
      expect(parseModelString('custom/my/model/v2')).toEqual({
        provider: 'custom',
        modelId: 'my/model/v2',
      });
    });

    test('解析 OpenAI 格式', () => {
      expect(parseModelString('openai/gpt-4o')).toEqual({
        provider: 'openai',
        modelId: 'gpt-4o',
      });
    });

    test('解析 DeepSeek 格式', () => {
      expect(parseModelString('deepseek/deepseek-chat')).toEqual({
        provider: 'deepseek',
        modelId: 'deepseek-chat',
      });
    });

    test('解析本地模型格式', () => {
      expect(parseModelString('ollama/llama3')).toEqual({
        provider: 'ollama',
        modelId: 'llama3',
      });
    });

    test('无斜杠时抛出错误', () => {
      expect(() => parseModelString('invalid-model')).toThrow('provider/model');
    });
  });

  describe('isReasonerModel', () => {
    test('deepseek-reasoner 是推理模型', () => {
      expect(isReasonerModel('deepseek/deepseek-reasoner')).toBe(true);
    });

    test('o1 是推理模型', () => {
      expect(isReasonerModel('openai/o1')).toBe(true);
    });

    test('o1-mini 是推理模型', () => {
      expect(isReasonerModel('openai/o1-mini')).toBe(true);
    });

    test('o3-mini 是推理模型', () => {
      expect(isReasonerModel('openai/o3-mini')).toBe(true);
    });

    test('gpt-4o 不是推理模型', () => {
      expect(isReasonerModel('openai/gpt-4o')).toBe(false);
    });

    test('claude-sonnet 不是推理模型', () => {
      expect(isReasonerModel('anthropic/claude-sonnet-4-5')).toBe(false);
    });

    test('deepseek-chat 不是推理模型', () => {
      expect(isReasonerModel('deepseek/deepseek-chat')).toBe(false);
    });
  });
});
