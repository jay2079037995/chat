/**
 * @mastra/core/tools Jest mock
 *
 * 避免 Jest CJS 模式下加载 ESM-only 依赖（execa）导致解析失败。
 */
export function createTool(config: any) {
  return {
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    execute: config.execute,
  };
}
