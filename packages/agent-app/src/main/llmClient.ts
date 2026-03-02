/**
 * 统一 LLM 客户端
 *
 * 支持 DeepSeek 和 MiniMax（均兼容 OpenAI 格式）。
 */
import * as https from 'https';
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

/** 调用 LLM 获取回复 */
export async function callLLM(config: AgentConfig, messages: ChatMessage[]): Promise<string> {
  const provider = PROVIDERS[config.provider];
  if (!provider) {
    throw new Error(`Unknown provider: ${config.provider}`);
  }

  const apiUrl = `${provider.baseUrl}/chat/completions`;
  const body = {
    model: config.model,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
  };

  const response = await httpsPost(apiUrl, body, config.apiKey);

  if (!response.choices || response.choices.length === 0) {
    throw new Error('LLM returned empty choices');
  }

  return response.choices[0].message.content;
}

function httpsPost(apiUrl: string, body: any, apiKey: string): Promise<LLMResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(apiUrl);

    const postData = JSON.stringify(body);

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 120000,
    };

    const req = https.request(options, (res) => {
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
