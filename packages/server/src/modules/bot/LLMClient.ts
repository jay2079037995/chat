/**
 * 服务端 LLM 客户端
 *
 * 支持 OpenAI 兼容格式（DeepSeek/MiniMax/OpenAI/通义千问/自定义）
 * 以及 Claude 独立 API 格式。移植自 agent-app/llmClient.ts。
 */
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import type { LLMConfig, ChatMessage, LLMTool, LLMToolCall } from '@chat/shared';
import { LLM_PROVIDERS } from '@chat/shared';

interface LLMResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
}

interface ClaudeResponse {
  content: Array<{
    type: string;
    text?: string;
    /** Claude tool_use 块 */
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  stop_reason: string;
}

/** callLLMWithTools 的返回值 */
export interface LLMCallResult {
  /** 是否包含 tool_calls */
  hasToolCalls: boolean;
  /** 文本回复内容（可能为空） */
  content?: string;
  /** LLM 返回的 tool_calls 列表 */
  toolCalls?: LLMToolCall[];
  /** 结束原因 */
  finishReason: string;
}

/** 调用 LLM 获取回复 */
export async function callLLM(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
  if (config.provider === 'claude') {
    return callClaude(config, messages);
  }
  return callOpenAICompatible(config, messages);
}

/** OpenAI 兼容格式调用 */
async function callOpenAICompatible(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
  let baseUrl: string;
  let model: string;

  if (config.provider === 'custom') {
    if (!config.customBaseUrl) throw new Error('Custom provider requires customBaseUrl');
    baseUrl = config.customBaseUrl;
    model = config.customModel || config.model;
  } else {
    const provider = LLM_PROVIDERS[config.provider];
    if (!provider) throw new Error(`Unknown provider: ${config.provider}`);
    baseUrl = provider.baseUrl;
    model = config.model;
  }

  const apiUrl = `${baseUrl}/chat/completions`;
  const body = { model, messages, temperature: 0.7, max_tokens: 2048 };

  const response = await httpPost(apiUrl, body, {
    'Authorization': `Bearer ${config.apiKey}`,
  }) as LLMResponse;

  if (!response.choices || response.choices.length === 0) {
    throw new Error('LLM returned empty choices');
  }

  return response.choices[0].message.content || '';
}

/** Claude API 格式调用 */
async function callClaude(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
  const apiUrl = `${LLM_PROVIDERS.claude.baseUrl}/messages`;

  const systemPrompt = messages.find((m) => m.role === 'system')?.content;
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const body: Record<string, unknown> = {
    model: config.model,
    messages: conversationMessages,
    max_tokens: 2048,
  };
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await httpPost(apiUrl, body, {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  }) as ClaudeResponse;

  if (!response.content || response.content.length === 0) {
    throw new Error('Claude returned empty content');
  }

  return response.content[0].text || '';
}

/**
 * 调用 LLM 并支持 function calling（tool use）
 *
 * 统一归一化 OpenAI 和 Claude 两种 API 的 tool_calls 响应。
 * 当 tools 为空数组或不传时，行为与普通文本调用一致。
 */
export async function callLLMWithTools(
  config: LLMConfig,
  messages: ChatMessage[],
  tools?: LLMTool[],
): Promise<LLMCallResult> {
  if (config.provider === 'claude') {
    return callClaudeWithTools(config, messages, tools);
  }
  return callOpenAICompatibleWithTools(config, messages, tools);
}

/** OpenAI 兼容格式 — 带 tools 调用 */
async function callOpenAICompatibleWithTools(
  config: LLMConfig,
  messages: ChatMessage[],
  tools?: LLMTool[],
): Promise<LLMCallResult> {
  let baseUrl: string;
  let model: string;

  if (config.provider === 'custom') {
    if (!config.customBaseUrl) throw new Error('Custom provider requires customBaseUrl');
    baseUrl = config.customBaseUrl;
    model = config.customModel || config.model;
  } else {
    const provider = LLM_PROVIDERS[config.provider];
    if (!provider) throw new Error(`Unknown provider: ${config.provider}`);
    baseUrl = provider.baseUrl;
    model = config.model;
  }

  const apiUrl = `${baseUrl}/chat/completions`;

  // 构建请求体，支持 tool 角色消息（含 tool_calls / tool_call_id）
  const reqMessages = messages.map((m) => {
    const msg: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.tool_calls) msg.tool_calls = m.tool_calls;
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    if (m.name) msg.name = m.name;
    return msg;
  });

  const body: Record<string, unknown> = {
    model,
    messages: reqMessages,
    temperature: 0.7,
    max_tokens: 2048,
  };

  // 只有传入非空 tools 时才附加
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const response = await httpPost(apiUrl, body, {
    'Authorization': `Bearer ${config.apiKey}`,
  }) as LLMResponse;

  if (!response.choices || response.choices.length === 0) {
    throw new Error('LLM returned empty choices');
  }

  const choice = response.choices[0];
  const hasToolCalls = !!choice.message.tool_calls && choice.message.tool_calls.length > 0;

  return {
    hasToolCalls,
    content: choice.message.content ?? undefined,
    toolCalls: hasToolCalls
      ? choice.message.tool_calls!.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        }))
      : undefined,
    finishReason: choice.finish_reason,
  };
}

/** Claude API — 带 tools 调用 */
async function callClaudeWithTools(
  config: LLMConfig,
  messages: ChatMessage[],
  tools?: LLMTool[],
): Promise<LLMCallResult> {
  const apiUrl = `${LLM_PROVIDERS.claude.baseUrl}/messages`;

  const systemPrompt = messages.find((m) => m.role === 'system')?.content;

  // Claude 格式消息转换：tool_result 角色映射
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'assistant' && m.tool_calls) {
        // assistant 带 tool_use 块
        const content: Array<Record<string, unknown>> = [];
        if (m.content) {
          content.push({ type: 'text', text: m.content });
        }
        for (const tc of m.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
        return { role: 'assistant', content };
      }
      if (m.role === 'tool') {
        // tool 角色 → Claude 的 tool_result
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: m.tool_call_id,
            content: m.content,
          }],
        };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    });

  const body: Record<string, unknown> = {
    model: config.model,
    messages: conversationMessages,
    max_tokens: 2048,
  };
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  // Claude tools 格式转换
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  const response = await httpPost(apiUrl, body, {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  }) as ClaudeResponse;

  if (!response.content || response.content.length === 0) {
    throw new Error('Claude returned empty content');
  }

  // 解析 Claude 响应：可能同时包含 text 和 tool_use
  let textContent = '';
  const toolCalls: LLMToolCall[] = [];

  for (const block of response.content) {
    if (block.type === 'text' && block.text) {
      textContent += block.text;
    } else if (block.type === 'tool_use' && block.id && block.name) {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        },
      });
    }
  }

  const hasToolCalls = toolCalls.length > 0;

  return {
    hasToolCalls,
    content: textContent || undefined,
    toolCalls: hasToolCalls ? toolCalls : undefined,
    finishReason: response.stop_reason,
  };
}

/** 检测回复是否包含 Markdown */
export function detectMarkdown(text: string): boolean {
  return /^#{1,6}\s/m.test(text) ||
    /```/.test(text) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /^\s*[-*]\s/m.test(text) ||
    /^\|.+\|/m.test(text);
}

function httpPost(apiUrl: string, body: unknown, extraHeaders: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(apiUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const postData = JSON.stringify(body);

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...extraHeaders,
      },
      timeout: 120000,
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            const errMsg = (json as any).error?.message || (json as any).error || `HTTP ${res.statusCode}`;
            reject(new Error(`LLM API error: ${errMsg}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`Invalid JSON from LLM: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('LLM request timeout'));
    });

    req.write(postData);
    req.end();
  });
}
