/** Session 数据访问接口（Repository 模式，便于切换存储实现） */
export interface ISessionRepository {
  /** 为用户创建 Session，返回 sessionId */
  create(userId: string): Promise<string>;
  /** 验证 Session 是否有效，返回 userId 或 null */
  validate(sessionId: string): Promise<string | null>;
  /** 销毁指定 Session */
  destroy(sessionId: string): Promise<void>;
  /** 销毁指定用户的所有 Session */
  destroyByUserId(userId: string): Promise<void>;
}
