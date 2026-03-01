import { Router, type Router as RouterType } from 'express';
import { UserService } from '../services/UserService';
import { sessionMiddleware, type AuthenticatedRequest } from '../middleware/auth';

const router: RouterType = Router();
const userService = new UserService();

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

export { router as usersRouter };
