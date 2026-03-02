import { Router } from 'express';
import multer from 'multer';
import type { ServerModule, ModuleContext, ModuleRegistration } from '../../core/types';
import { TOKENS } from '../../core/tokens';
import { MAX_NICKNAME_LENGTH, MAX_BIO_LENGTH } from '@chat/shared';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import { AuthService } from './AuthService';
import { createSessionMiddleware, type AuthenticatedRequest } from './middleware';
import { avatarUpload, getFileUrl } from '../chat/upload';

// 导出供其他模块使用（如 user 模块需要 sessionMiddleware）
export { createSessionMiddleware, type AuthenticatedRequest } from './middleware';
export { generateToken, verifyToken } from './utils';

/**
 * 认证模块
 *
 * 提供注册、登录、Token 自动登录、Session 验证、登出等 API。
 * 路由挂载到 /api/auth/*
 */
export class AuthModule implements ServerModule {
  name = 'auth';

  register(ctx: ModuleContext): ModuleRegistration {
    // 从 DI 容器获取 Repository
    const userRepo = ctx.resolve<IUserRepository>(TOKENS.UserRepository);
    const sessionRepo = ctx.resolve<ISessionRepository>(TOKENS.SessionRepository);

    // 通过构造函数注入创建 Service 和中间件
    const authService = new AuthService(userRepo, sessionRepo);
    const sessionMiddleware = createSessionMiddleware(sessionRepo, userRepo);

    const router = Router();

    // POST /api/auth/register — 用户注册
    router.post('/register', async (req, res) => {
      try {
        const { username, password } = req.body;

        if (!username || typeof username !== 'string' || username.trim().length === 0) {
          res.status(400).json({ error: '请输入用户名' });
          return;
        }

        if (!password || typeof password !== 'string' || password.length === 0) {
          res.status(400).json({ error: '请输入密码' });
          return;
        }

        const result = await authService.register(username, password);
        res.json(result);
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message === 'USERNAME_TAKEN') {
          res.status(409).json({ error: '用户名已被占用' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/auth/login — 用户登录
    router.post('/login', async (req, res) => {
      try {
        const { username, password } = req.body;

        if (!username || !password) {
          res.status(400).json({ error: '请输入用户名和密码' });
          return;
        }

        const result = await authService.login(username, password);
        res.json(result);
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message === 'INVALID_CREDENTIALS') {
          res.status(401).json({ error: '用户名或密码错误' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/auth/session — Token 自动登录（创建新 Session）
    router.post('/session', async (req, res) => {
      try {
        const { token } = req.body;

        if (!token) {
          res.status(400).json({ error: 'Token is required' });
          return;
        }

        const result = await authService.createSession(token);
        res.json(result);
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message === 'INVALID_TOKEN') {
          res.status(401).json({ error: 'Token 无效或已过期' });
          return;
        }
        if (error.message === 'USER_NOT_FOUND') {
          res.status(401).json({ error: '用户不存在' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // GET /api/auth/me — 获取当前登录用户信息（需要有效 Session）
    router.get('/me', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const user = await authService.getMe(req.userId!);
        res.json({ user });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/auth/logout — 用户登出（销毁 Session）
    router.post('/logout', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        await authService.logout(req.sessionId!);
        res.json({ message: '登出成功' });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // PUT /api/auth/profile — 更新用户资料（nickname/bio）
    router.put('/profile', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const { nickname, bio } = req.body;

        if (nickname !== undefined && typeof nickname === 'string' && nickname.length > MAX_NICKNAME_LENGTH) {
          res.status(400).json({ error: `昵称不能超过${MAX_NICKNAME_LENGTH}个字符` });
          return;
        }
        if (bio !== undefined && typeof bio === 'string' && bio.length > MAX_BIO_LENGTH) {
          res.status(400).json({ error: `简介不能超过${MAX_BIO_LENGTH}个字符` });
          return;
        }

        const user = await userRepo.updateProfile(req.userId!, { nickname, bio });
        res.json({ user });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/auth/avatar — 上传头像
    router.post('/avatar', sessionMiddleware, (req, res) => {
      avatarUpload.single('file')(req, res, async (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: '头像文件过大' });
          return;
        }
        if (err?.message === 'UNSUPPORTED_IMAGE_TYPE') {
          res.status(400).json({ error: '不支持的图片类型' });
          return;
        }
        if (err) {
          res.status(500).json({ error: '上传失败' });
          return;
        }
        if (!req.file) {
          res.status(400).json({ error: '请选择文件' });
          return;
        }
        try {
          const avatarUrl = getFileUrl(req.file.path);
          const user = await userRepo.updateProfile((req as AuthenticatedRequest).userId!, { avatar: avatarUrl });
          res.json({ user, avatarUrl });
        } catch {
          res.status(500).json({ error: '服务器内部错误' });
        }
      });
    });

    // GET /api/auth/user/:id — 获取用户公开资料
    router.get('/user/:id', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const user = await userRepo.findById(req.params.id as string);
        if (!user) {
          res.status(404).json({ error: '用户不存在' });
          return;
        }
        res.json({ user });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    return { router };
  }
}
