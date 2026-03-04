/**
 * claude-plugins.dev 搜索客户端
 *
 * 封装 claude-plugins.dev API，支持搜索和获取在线 Skill。
 * API: GET https://claude-plugins.dev/api/skills?search=keyword&limit=20&offset=0
 */
import type { PluginSearchResult } from '../../../shared/dist';

/** API 基础地址 */
const API_BASE = 'https://claude-plugins.dev/api';

export class PluginSearchClient {
  /**
   * 搜索在线 Skill
   *
   * @param query 搜索关键词
   * @param limit 每页数量（默认 20）
   * @param offset 偏移量（默认 0）
   * @returns 搜索结果
   */
  async search(query: string, limit = 20, offset = 0): Promise<PluginSearchResult> {
    const params = new URLSearchParams({
      search: query,
      limit: String(limit),
      offset: String(offset),
    });

    const url = `${API_BASE}/skills?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'chat-electron/1.19.0',
      },
    });

    if (!response.ok) {
      throw new Error(`claude-plugins.dev API 请求失败: HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      skills: data.skills || [],
      total: data.total || 0,
      limit: data.limit || limit,
      offset: data.offset || offset,
    };
  }
}
