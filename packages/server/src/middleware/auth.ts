import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { RedisSessionRepository } from '../repositories/redis/RedisSessionRepository';
import { RedisUserRepository } from '../repositories/redis/RedisUserRepository';

const sessionRepo = new RedisSessionRepository();
const userRepo = new RedisUserRepository();

export interface AuthenticatedRequest extends Request {
  userId?: string;
  sessionId?: string;
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, config.jwt.secret) as { userId: string };
  } catch {
    return null;
  }
}

export async function sessionMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionId = req.headers['x-session-id'] as string;

  if (!sessionId) {
    res.status(401).json({ error: 'Session ID is required' });
    return;
  }

  const userId = await sessionRepo.validate(sessionId);
  if (!userId) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  const user = await userRepo.findById(userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  req.userId = userId;
  req.sessionId = sessionId;
  next();
}
