import jwt from 'jsonwebtoken';
import { config } from '../../config';

/** 生成 JWT Token（包含 userId，用于自动登录） */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

/** 验证 JWT Token，返回 payload 或 null（过期/无效时） */
export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, config.jwt.secret) as { userId: string };
  } catch {
    return null;
  }
}
