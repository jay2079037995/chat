/**
 * Webpack 配置验证测试（v1.14.0）
 *
 * 验证 publicPath 在生产/开发模式下的值。
 * 通过 mock 重依赖避免 Jest 解析 ESM 模块失败。
 */
import path from 'path';

// mock 掉 webpack 配置中的重依赖插件（它们含 ESM 代码 Jest 无法解析）
jest.mock('html-webpack-plugin', () => jest.fn().mockImplementation(() => ({})));
jest.mock('copy-webpack-plugin', () => jest.fn().mockImplementation(() => ({})));
jest.mock('workbox-webpack-plugin', () => ({
  GenerateSW: jest.fn().mockImplementation(() => ({})),
}));

describe('webpack.config.js — publicPath', () => {
  const configPath = path.resolve(__dirname, '../webpack.config.js');

  beforeEach(() => {
    jest.resetModules();
  });

  test('生产模式 publicPath 为 "./"', () => {
    const configFactory = require(configPath);
    const config = configFactory({}, { mode: 'production' });
    expect(config.output.publicPath).toBe('./');
  });

  test('开发模式 publicPath 为 "/"', () => {
    const configFactory = require(configPath);
    const config = configFactory({}, { mode: 'development' });
    expect(config.output.publicPath).toBe('/');
  });
});
