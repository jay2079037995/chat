import bcrypt from 'bcryptjs';
import type { User, AuthResponse } from '@chat/shared';
import { generateId } from '@chat/shared';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import { generateToken, verifyToken } from './utils';

/**
 * 认证服务
 *
 * 处理用户注册、登录、Token 自动登录、登出等核心认证逻辑。
 * 通过构造函数注入 Repository 依赖，便于测试和替换存储实现。
 */
export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private sessionRepo: ISessionRepository,
  ) {}

  /** 用户注册：创建用户 + 生成 Token + 创建 Session */
  async register(username: string, password: string): Promise<AuthResponse & { sessionId: string }> {
    // 检查用户名是否已存在
    const existing = await this.userRepo.findByUsername(username);
    if (existing) {
      throw new Error('USERNAME_TAKEN');
    }

    if (!username || username.trim().length === 0) {
      throw new Error('USERNAME_REQUIRED');
    }

    if (!password || password.length === 0) {
      throw new Error('PASSWORD_REQUIRED');
    }

    const id = generateId();
    // 密码使用 bcrypt 加密存储
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userRepo.create({ id, username: username.trim(), password, hashedPassword });
    const token = generateToken(user.id);
    const sessionId = await this.sessionRepo.create(user.id);

    return { token, user, sessionId };
  }

  /** 用户登录：验证凭据 + 生成 Token + 创建 Session */
  async login(username: string, password: string): Promise<AuthResponse & { sessionId: string }> {
    if (!username || !password) {
      throw new Error('CREDENTIALS_REQUIRED');
    }

    const user = await this.userRepo.findByUsername(username);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const hash = await this.userRepo.getPasswordHash(user.id);
    if (!hash) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const token = generateToken(user.id);
    const sessionId = await this.sessionRepo.create(user.id);

    return { token, user, sessionId };
  }

  /** Token 自动登录：验证 Token 有效性，创建新 Session */
  async createSession(token: string): Promise<{ user: User; sessionId: string }> {
    const payload = verifyToken(token);
    if (!payload) {
      throw new Error('INVALID_TOKEN');
    }

    const user = await this.userRepo.findById(payload.userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const sessionId = await this.sessionRepo.create(user.id);
    return { user, sessionId };
  }

  /** 用户登出：销毁 Session */
  async logout(sessionId: string): Promise<void> {
    await this.sessionRepo.destroy(sessionId);
  }

  /** 获取当前用户信息 */
  async getMe(userId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    return user;
  }
}
