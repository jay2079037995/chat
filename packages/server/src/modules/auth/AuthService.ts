import bcrypt from 'bcryptjs';
import type { User, AuthResponse } from '@chat/shared';
import { generateId } from '@chat/shared';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import { generateToken, verifyToken } from './utils';

export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private sessionRepo: ISessionRepository,
  ) {}

  async register(username: string, password: string): Promise<AuthResponse & { sessionId: string }> {
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
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userRepo.create({ id, username: username.trim(), password, hashedPassword });
    const token = generateToken(user.id);
    const sessionId = await this.sessionRepo.create(user.id);

    return { token, user, sessionId };
  }

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

  async logout(sessionId: string): Promise<void> {
    await this.sessionRepo.destroy(sessionId);
  }

  async getMe(userId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    return user;
  }
}
