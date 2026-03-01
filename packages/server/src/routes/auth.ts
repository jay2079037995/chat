import { Router } from 'express';
import { AuthService } from '../services/AuthService';
import { sessionMiddleware, type AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const authService = new AuthService();

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

router.get('/me', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await authService.getMe(req.userId!);
    res.json({ user });
  } catch {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.post('/logout', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    await authService.logout(req.sessionId!);
    res.json({ message: '登出成功' });
  } catch {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export { router as authRouter };
