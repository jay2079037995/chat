/** 群组实体 */
export interface Group {
  /** 群组唯一标识 */
  id: string;
  /** 群名称 */
  name: string;
  /** 群主用户 ID */
  ownerId: string;
  /** 群成员用户 ID 列表 */
  members: string[];
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/** 创建群组请求体 */
export interface CreateGroupDTO {
  /** 群名称 */
  name: string;
  /** 初始成员用户 ID 列表 */
  memberIds: string[];
}
