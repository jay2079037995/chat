/**
 * API Key 加解密工具
 *
 * 使用 AES-256-GCM 加密 Bot 的 LLM API Key。
 */
import crypto from 'crypto';
import { config } from '../../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/** 获取 32 字节密钥（不足补齐，超出截断） */
function getKey(): Buffer {
  const raw = config.botEncryptionKey;
  return crypto.createHash('sha256').update(raw).digest();
}

/** 加密 API Key，返回 base64 编码的 iv:authTag:ciphertext */
export function encryptApiKey(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/** 解密 API Key */
export function decryptApiKey(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');

  const [ivB64, authTagB64, ciphertext] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/** 脱敏 API Key，保留前缀和后 4 位 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  const prefix = key.substring(0, key.indexOf('-') + 1) || '';
  const suffix = key.slice(-4);
  return `${prefix}****${suffix}`;
}
