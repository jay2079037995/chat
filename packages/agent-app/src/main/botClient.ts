/**
 * Chat Bot API 客户端
 *
 * 通过 HTTP 调用 chat 服务端的 Bot API（getUpdates / sendMessage）。
 */
import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import type { AgentGenerationLog } from '@chat/shared';

export interface BotUpdate {
  updateId: number;
  message: {
    id: string;
    senderId: string;
    content: string;
    type: string;
    conversationId: string;
    createdAt: number;
  };
  conversationId: string;
}

export class BotClient {
  constructor(
    private serverUrl: string,
    private token: string,
  ) {}

  /** 长轮询获取消息更新 */
  async getUpdates(timeout: number = 30): Promise<BotUpdate[]> {
    const apiUrl = `${this.serverUrl}/api/bot/getUpdates?token=${encodeURIComponent(this.token)}&timeout=${timeout}`;
    const data = await this.request('GET', apiUrl);
    return data.updates ?? data ?? [];
  }

  /** 获取会话历史消息 */
  async getHistory(
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ messages: any[]; botUserId: string; total: number }> {
    const apiUrl = `${this.serverUrl}/api/bot/getHistory?token=${encodeURIComponent(this.token)}&conversationId=${encodeURIComponent(conversationId)}&limit=${limit}&offset=${offset}`;
    return this.request('GET', apiUrl);
  }

  /** 发送消息 */
  async sendMessage(conversationId: string, content: string, type: string = 'text'): Promise<any> {
    const apiUrl = `${this.serverUrl}/api/bot/sendMessage`;
    return this.request('POST', apiUrl, {
      token: this.token,
      conversationId,
      content,
      type,
    });
  }

  /** 报告步骤进度到服务端（服务端通过 Socket.IO 转发给聊天客户端） */
  async reportStepProgress(
    conversationId: string,
    step: string,
    status: 'start' | 'complete' | 'error',
    detail?: string,
  ): Promise<void> {
    const apiUrl = `${this.serverUrl}/api/bot/stepProgress`;
    await this.request('POST', apiUrl, {
      token: this.token,
      conversationId,
      step,
      status,
      detail,
    });
  }

  /** 保存 Agent 生成日志到服务端 */
  async saveGenerationLog(log: AgentGenerationLog): Promise<void> {
    const apiUrl = `${this.serverUrl}/api/bot/generationLog`;
    await this.request('POST', apiUrl, {
      token: this.token,
      log,
    });
  }

  private request(method: string, apiUrl: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsed = new url.URL(apiUrl);
      const isHttps = parsed.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options: http.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      };

      const req = httpModule.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(json.error || `HTTP ${res.statusCode}`));
            } else {
              resolve(json);
            }
          } catch {
            reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}
