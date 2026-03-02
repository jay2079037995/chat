/**
 * 统一 LLM 客户端
 *
 * 支持 OpenAI 兼容格式（DeepSeek/MiniMax/OpenAI/通义千问/自定义）
 * 以及 Claude 独立 API 格式。
 */
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import type { AgentConfig, ChatMessage } from '../shared/types';
import { PROVIDERS } from '../shared/types';

interface LLMResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/** 调用 LLM 获取回复 */
export async function callLLM(config: AgentConfig, messages: ChatMessage[]): Promise<string> {
  if (config.provider === 'claude') {
    return callClaude(config, messages);
  }
  return callOpenAICompatible(config, messages);
}

/** OpenAI 兼容格式调用（deepseek/minimax/openai/qwen/custom） */
async function callOpenAICompatible(config: AgentConfig, messages: ChatMessage[]): Promise<string> {
  let baseUrl: string;
  let model: string;

  if (config.provider === 'custom') {
    if (!config.customBaseUrl) throw new Error('Custom provider requires customBaseUrl');
    baseUrl = config.customBaseUrl;
    model = config.customModel || config.model;
  } else {
    const provider = PROVIDERS[config.provider];
    if (!provider) throw new Error(`Unknown provider: ${config.provider}`);
    baseUrl = provider.baseUrl;
    model = config.model;
  }

  const apiUrl = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
  };

  const response = await httpPost(apiUrl, body, {
    'Authorization': `Bearer ${config.apiKey}`,
  }) as LLMResponse;

  if (!response.choices || response.choices.length === 0) {
    throw new Error('LLM returned empty choices');
  }

  return response.choices[0].message.content;
}

/** Claude API 格式调用 */
async function callClaude(config: AgentConfig, messages: ChatMessage[]): Promise<string> {
  const apiUrl = `${PROVIDERS.claude.baseUrl}/messages`;

  // Claude 的 system prompt 是顶层字段，不在 messages 中
  const systemPrompt = messages.find((m) => m.role === 'system')?.content;
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const body: any = {
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

  return response.content[0].text;
}

function httpPost(apiUrl: string, body: any, extraHeaders: Record<string, string>): Promise<any> {
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
            const errMsg = json.error?.message || json.error || `HTTP ${res.statusCode}`;
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
