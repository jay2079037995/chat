/** DI 容器依赖 token 常量 */
export const TOKENS = {
  // Repositories
  UserRepository: 'IUserRepository',
  SessionRepository: 'ISessionRepository',
  MessageRepository: 'IMessageRepository',

  // Services（跨模块共享时使用）
  AuthService: 'AuthService',
  UserService: 'UserService',
} as const;
