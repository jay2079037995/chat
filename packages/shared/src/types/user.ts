/** 用户实体（不含密码等敏感信息） */
export interface User {
  /** 唯一标识 */
  id: string;
  /** 用户名 */
  username: string;
  /** 是否为机器人 */
  isBot?: boolean;
  /** 机器人所有者用户 ID */
  botOwnerId?: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/** 创建用户请求体 */
export interface CreateUserDTO {
  username: string;
  password: string;
}

/** 登录请求体 */
export interface LoginDTO {
  username: string;
  password: string;
}

/** 认证接口统一返回体 */
export interface AuthResponse {
  /** JWT token */
  token: string;
  /** 用户信息 */
  user: User;
}
