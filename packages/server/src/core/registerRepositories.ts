import { Container } from './container';
import { TOKENS } from './tokens';
import { RedisUserRepository } from '../repositories/redis/RedisUserRepository';
import { RedisSessionRepository } from '../repositories/redis/RedisSessionRepository';
import { RedisMessageRepository } from '../repositories/redis/RedisMessageRepository';

/**
 * 注册所有 Repository 实现
 *
 * 切换 Redis → MongoDB 时只需修改此文件。
 */
export function registerRepositories(container: Container): void {
  container.registerFactory(TOKENS.UserRepository, () => new RedisUserRepository());
  container.registerFactory(TOKENS.SessionRepository, () => new RedisSessionRepository());
  container.registerFactory(TOKENS.MessageRepository, () => new RedisMessageRepository());
}
