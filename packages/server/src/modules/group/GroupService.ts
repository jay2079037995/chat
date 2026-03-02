import type { Group, Conversation } from '@chat/shared';
import { generateId, MIN_GROUP_NAME_LENGTH, MAX_GROUP_NAME_LENGTH, MAX_GROUP_MEMBERS } from '@chat/shared';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import { getRedisClient } from '../../repositories/redis/RedisClient';

/** 群组元数据 Redis Key */
const GROUP_KEY = (id: string) => id;
/** 用户会话列表 Redis Key */
const USER_CONVS_KEY = (userId: string) => `user_convs:${userId}`;
/** 会话元数据 Redis Key */
const CONV_KEY = (convId: string) => `conv:${convId}`;

/**
 * 群组服务
 *
 * 处理群组创建、成员管理、群信息查询。
 * 群组元数据存储在 group:{uuid} Redis Hash 中，
 * 群组会话复用 IMessageRepository 的 Conversation 机制。
 */
export class GroupService {
  constructor(
    private messageRepo: IMessageRepository,
    private userRepo: IUserRepository,
  ) {}

  /** 将 Group 对象序列化为 Redis Hash 字段 */
  private serializeGroup(group: Group): Record<string, string> {
    return {
      id: group.id,
      name: group.name,
      ownerId: group.ownerId,
      members: JSON.stringify(group.members),
      createdAt: String(group.createdAt),
      updatedAt: String(group.updatedAt),
    };
  }

  /** 从 Redis Hash 数据反序列化为 Group 对象 */
  private deserializeGroup(data: Record<string, string>): Group {
    return {
      id: data.id,
      name: data.name,
      ownerId: data.ownerId,
      members: JSON.parse(data.members),
      createdAt: parseInt(data.createdAt, 10),
      updatedAt: parseInt(data.updatedAt, 10),
    };
  }

  /**
   * 创建群组
   *
   * 1. 验证群名和成员
   * 2. 创建 Group 实体写入 Redis
   * 3. 创建对应的 Conversation (type='group')
   */
  async createGroup(
    ownerId: string,
    name: string,
    memberIds: string[],
  ): Promise<{ group: Group; conversation: Conversation }> {
    // 群名校验
    const trimmedName = name.trim();
    if (trimmedName.length < MIN_GROUP_NAME_LENGTH) {
      throw new Error('GROUP_NAME_TOO_SHORT');
    }
    if (trimmedName.length > MAX_GROUP_NAME_LENGTH) {
      throw new Error('GROUP_NAME_TOO_LONG');
    }

    // 去重成员列表，确保创建者在其中
    const uniqueMembers = [...new Set([ownerId, ...memberIds])];

    if (uniqueMembers.length > MAX_GROUP_MEMBERS) {
      throw new Error('TOO_MANY_MEMBERS');
    }

    // 验证所有成员存在
    for (const memberId of uniqueMembers) {
      if (memberId !== ownerId) {
        const user = await this.userRepo.findById(memberId);
        if (!user) throw new Error('MEMBER_NOT_FOUND');
      }
    }

    const now = Date.now();
    const groupId = `group:${generateId()}`;

    const group: Group = {
      id: groupId,
      name: trimmedName,
      ownerId,
      members: uniqueMembers,
      createdAt: now,
      updatedAt: now,
    };

    // 写入 Redis
    const redis = getRedisClient();
    await redis.hset(GROUP_KEY(groupId), this.serializeGroup(group));

    // 创建对应的 Conversation
    const conversation: Conversation = {
      id: groupId,
      type: 'group',
      participants: uniqueMembers,
      updatedAt: now,
    };
    await this.messageRepo.createConversation(conversation);

    return { group, conversation };
  }

  /** 获取群组信息 */
  async getGroup(groupId: string): Promise<Group | null> {
    const redis = getRedisClient();
    const data = await redis.hgetall(GROUP_KEY(groupId));
    if (!data || !data.id) return null;
    return this.deserializeGroup(data);
  }

  /**
   * 邀请成员加入群组
   *
   * 验证群主权限 → 更新成员列表 → 同步 Conversation + user_convs
   */
  async addMember(groupId: string, userId: string, requesterId: string): Promise<Group> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('GROUP_NOT_FOUND');
    if (group.ownerId !== requesterId) throw new Error('NOT_GROUP_OWNER');

    // 验证用户存在
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    // 检查是否已是成员
    if (group.members.includes(userId)) throw new Error('ALREADY_MEMBER');

    if (group.members.length >= MAX_GROUP_MEMBERS) throw new Error('TOO_MANY_MEMBERS');

    // 更新群组成员
    const updatedMembers = [...group.members, userId];
    const now = Date.now();

    const redis = getRedisClient();
    await redis.hset(GROUP_KEY(groupId), {
      members: JSON.stringify(updatedMembers),
      updatedAt: String(now),
    });

    // 更新 Conversation 参与者
    await this.messageRepo.updateConversation(groupId, {
      participants: updatedMembers,
    });

    // 将会话添加到新成员的 user_convs
    await redis.zadd(USER_CONVS_KEY(userId), now, groupId);

    return { ...group, members: updatedMembers, updatedAt: now };
  }

  /**
   * 移除成员
   *
   * 验证群主权限 → 更新成员列表 → 同步 Conversation + user_convs
   */
  async removeMember(groupId: string, userId: string, requesterId: string): Promise<Group> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('GROUP_NOT_FOUND');
    if (group.ownerId !== requesterId) throw new Error('NOT_GROUP_OWNER');
    if (userId === group.ownerId) throw new Error('CANNOT_REMOVE_OWNER');

    if (!group.members.includes(userId)) throw new Error('NOT_A_MEMBER');

    // 更新群组成员
    const updatedMembers = group.members.filter((m) => m !== userId);
    const now = Date.now();

    const redis = getRedisClient();
    await redis.hset(GROUP_KEY(groupId), {
      members: JSON.stringify(updatedMembers),
      updatedAt: String(now),
    });

    // 更新 Conversation 参与者
    await this.messageRepo.updateConversation(groupId, {
      participants: updatedMembers,
    });

    // 从被移除成员的 user_convs 中删除
    await redis.zrem(USER_CONVS_KEY(userId), groupId);

    return { ...group, members: updatedMembers, updatedAt: now };
  }

  /**
   * 退出群聊
   *
   * 普通成员主动退出，群主不能退出（需先解散）。
   */
  async leaveGroup(groupId: string, userId: string): Promise<Group> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('GROUP_NOT_FOUND');
    if (!group.members.includes(userId)) throw new Error('NOT_A_MEMBER');
    if (userId === group.ownerId) throw new Error('OWNER_CANNOT_LEAVE');

    const updatedMembers = group.members.filter((m) => m !== userId);
    const now = Date.now();

    const redis = getRedisClient();
    await redis.hset(GROUP_KEY(groupId), {
      members: JSON.stringify(updatedMembers),
      updatedAt: String(now),
    });

    await this.messageRepo.updateConversation(groupId, {
      participants: updatedMembers,
    });

    await redis.zrem(USER_CONVS_KEY(userId), groupId);

    return { ...group, members: updatedMembers, updatedAt: now };
  }

  /**
   * 解散群组
   *
   * 仅群主可操作。删除群组元数据 + 会话，清理所有成员的 user_convs。
   * 返回被删群组的成员列表（用于通知）。
   */
  async dissolveGroup(groupId: string, requesterId: string): Promise<string[]> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('GROUP_NOT_FOUND');
    if (group.ownerId !== requesterId) throw new Error('NOT_GROUP_OWNER');

    const members = group.members;
    const redis = getRedisClient();

    // 删除群组元数据
    await redis.del(GROUP_KEY(groupId));

    // 删除会话
    await redis.del(CONV_KEY(groupId));

    // 清理所有成员的 user_convs
    for (const memberId of members) {
      await redis.zrem(USER_CONVS_KEY(memberId), groupId);
    }

    return members;
  }
}
