import { Router } from 'express';
import type { ServerModule, ModuleContext, ModuleRegistration } from '../../core/types';
import { TOKENS } from '../../core/tokens';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import { UserService } from './UserService';
import { createSessionMiddleware, type AuthenticatedRequest } from '../auth';

export class UserModule implements ServerModule {
  name = 'users';

  register(ctx: ModuleContext): ModuleRegistration {
    const userRepo = ctx.resolve<IUserRepository>(TOKENS.UserRepository);
    const sessionRepo = ctx.resolve<ISessionRepository>(TOKENS.SessionRepository);

    const userService = new UserService(userRepo);
    const sessionMiddleware = createSessionMiddleware(sessionRepo, userRepo);

    const router = Router();

    router.get('/search', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const q = req.query.q as string;

        if (!q || q.trim().length === 0) {
          res.status(400).json({ error: '请输入搜索关键词' });
          return;
        }

        const users = await userService.search(q.trim(), req.userId);
        res.json({ users });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    return { router };
  }
}
