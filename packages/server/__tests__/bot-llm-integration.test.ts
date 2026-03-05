/**
 * Bot LLM 集成测试（DeepSeek 真实调用）
 *
 * 使用真实 DeepSeek API 验证 Bot 聊天核心流程。
 * 测试 AI SDK generateText/streamText + 工具元数据生成 + 文件产物回调。
 */
import { generateText, streamText } from 'ai';
import type { BotModelConfig, MessageMetadata } from '@chat/shared';

// Mock Mastra（ESM-only 依赖无法在 Jest CJS 模式加载）
jest.mock('@mastra/core/tools', () => ({
  createTool: (config: any) => ({
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    execute: config.execute,
  }),
}));

import { createModel } from '../src/modules/bot/ModelFactory';
import { createServerTools, type FileArtifact } from '../src/modules/bot/ServerToolBridge';

/** DeepSeek 测试配置（v2.0 "provider/model" 格式） */
const DEEPSEEK_CONFIG: BotModelConfig = {
  apiKey: 'sk-1d27fbdfbfd74d29be3dabb42fb57cbd',
  model: 'deepseek/deepseek-chat',
  systemPrompt: '你是一个简洁的助手，用一句话回答。',
  contextLength: 10,
};

describe('Bot LLM 集成测试（DeepSeek 真实调用）', () => {
  jest.setTimeout(60000);

  test('createModel + generateText 正常生成回复', async () => {
    const model = await createModel(DEEPSEEK_CONFIG);
    const result = await generateText({
      model,
      system: DEEPSEEK_CONFIG.systemPrompt,
      messages: [{ role: 'user' as const, content: '1+1等于几？请只回答数字。' }],
    });

    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(0);
  });

  test('createModel + streamText 正常流式输出', async () => {
    const model = await createModel(DEEPSEEK_CONFIG);
    const result = streamText({
      model,
      system: DEEPSEEK_CONFIG.systemPrompt,
      messages: [{ role: 'user' as const, content: '你好' }],
    });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    expect(fullText).toBeTruthy();
    expect(fullText.length).toBeGreaterThan(0);
  });
});

describe('工具元数据测试', () => {
  test('present_choices — single_select 生成 richItems metadata', async () => {
    let capturedMetadata: MessageMetadata | undefined;
    const tools = createServerTools({
      dispatcher: { dispatch: jest.fn() } as any,
      targetUserId: 'u1',
      botId: 'b1',
      conversationId: 'c1',
      onPresentChoices: (m) => { capturedMetadata = m; },
    });

    const result = await tools.present_choices.execute!({
      type: 'single_select' as const,
      prompt: '请选择语言',
      choices: [
        { label: 'TypeScript', description: '强类型' },
        { label: 'Python', description: '简洁易学' },
      ],
    } as any, {} as any);

    expect(result).toBe('已向用户展示选项');
    expect(capturedMetadata).toBeDefined();
    expect(capturedMetadata!.choices!.items).toEqual(['TypeScript', 'Python']);
    expect(capturedMetadata!.choices!.richItems).toEqual([
      { label: 'TypeScript', description: '强类型' },
      { label: 'Python', description: '简洁易学' },
    ]);
    expect(capturedMetadata!.choices!.prompt).toBe('请选择语言');
  });

  test('present_choices — 纯字符串选项不生成 richItems', async () => {
    let capturedMetadata: MessageMetadata | undefined;
    const tools = createServerTools({
      dispatcher: { dispatch: jest.fn() } as any,
      targetUserId: 'u1',
      botId: 'b1',
      conversationId: 'c1',
      onPresentChoices: (m) => { capturedMetadata = m; },
    });

    await tools.present_choices.execute!({
      type: 'single_select' as const,
      prompt: '请选择',
      choices: ['选项A', '选项B', '选项C'],
    } as any, {} as any);

    expect(capturedMetadata!.choices!.items).toEqual(['选项A', '选项B', '选项C']);
    // 纯字符串选项没有 description，不应生成 richItems
    expect(capturedMetadata!.choices!.richItems).toBeUndefined();
  });

  test('present_choices — text_input 生成 inputRequest metadata', async () => {
    let capturedMetadata: MessageMetadata | undefined;
    const tools = createServerTools({
      dispatcher: { dispatch: jest.fn() } as any,
      targetUserId: 'u1',
      botId: 'b1',
      conversationId: 'c1',
      onPresentChoices: (m) => { capturedMetadata = m; },
    });

    await tools.present_choices.execute!({
      type: 'text_input' as const,
      prompt: '请输入名称',
      placeholder: '输入...',
    } as any, {} as any);

    expect(capturedMetadata).toBeDefined();
    expect(capturedMetadata!.inputRequest!.label).toBe('请输入名称');
    expect(capturedMetadata!.inputRequest!.placeholder).toBe('输入...');
  });

  test('send_file_to_chat — dispatcher 获取文件 + artifact 回调', async () => {
    const mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue({
        requestId: 'req1',
        success: true,
        data: {
          base64: 'aGVsbG8=',
          fileName: 'test.txt',
          fileSize: 5,
          mimeType: 'text/plain',
        },
      }),
    };
    let capturedArtifact: FileArtifact | undefined;
    const tools = createServerTools({
      dispatcher: mockDispatcher as any,
      targetUserId: 'u1',
      botId: 'b1',
      conversationId: 'c1',
      onFileArtifact: (a) => { capturedArtifact = a; },
    });

    const result = await tools.send_file_to_chat.execute!({ path: 'test.txt' } as any, {} as any);

    expect(result).toContain('test.txt');
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'u1', 'read_file_binary', { path: 'test.txt' }, 'b1', 'c1',
    );
    expect(capturedArtifact).toBeDefined();
    expect(capturedArtifact!.base64).toBe('aGVsbG8=');
    expect(capturedArtifact!.fileName).toBe('test.txt');
    expect(capturedArtifact!.fileSize).toBe(5);
    expect(capturedArtifact!.mimeType).toBe('text/plain');
  });

  test('send_file_to_chat — dispatcher 返回错误', async () => {
    const mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue({
        requestId: 'req2',
        success: false,
        error: '文件不存在',
      }),
    };
    const tools = createServerTools({
      dispatcher: mockDispatcher as any,
      targetUserId: 'u1',
      botId: 'b1',
      conversationId: 'c1',
    });

    const result = await tools.send_file_to_chat.execute!({ path: 'nonexistent.txt' } as any, {} as any);

    expect(result).toContain('Error');
    expect(result).toContain('文件不存在');
  });
});
