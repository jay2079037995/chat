export interface ISessionRepository {
  create(userId: string): Promise<string>;
  validate(sessionId: string): Promise<string | null>;
  destroy(sessionId: string): Promise<void>;
  destroyByUserId(userId: string): Promise<void>;
}
