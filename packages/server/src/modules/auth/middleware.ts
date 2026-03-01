import type { Request, Response, NextFunction } from 'express';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  sessionId?: string;
}

/**
 * 创建 Session 验证中间件
 *
 * 工厂函数模式：通过参数注入依赖，其他模块可直接调用。
 */
export function createSessionMiddleware(
  sessionRepo: ISessionRepository,
  userRepo: IUserRepository,
) {
  return async function sessionMiddleware(
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
  };
}
