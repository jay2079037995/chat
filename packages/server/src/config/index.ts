import dotenv from 'dotenv';

dotenv.config();

/**
 * 应用配置（从环境变量读取，支持 .env 文件）
 *
 * 生产环境务必设置 JWT_SECRET 和 REDIS_PASSWORD。
 */
export const config = {
  /** 服务端口 */
  port: parseInt(process.env.PORT || '3001', 10),
  /** Redis 连接配置 */
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    /** 数据库编号：开发用 db 0，测试用 db 1（避免 flushdb 清除开发数据） */
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  /** JWT 配置 */
  jwt: {
    secret: process.env.JWT_SECRET || 'chat-app-jwt-secret-dev',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  /** Bot API Key 加密密钥（32 字节） */
  botEncryptionKey: process.env.BOT_ENCRYPTION_KEY || 'chat-bot-encryption-key-dev-only',
  /** CORS 跨域配置 */
  cors: {
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'],
  },
};
