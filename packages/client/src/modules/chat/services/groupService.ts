/**
 * 群组服务 —— 封装所有与 /api/group 相关的 HTTP 请求
 */
import type { Group, Conversation } from '@chat/shared';
import { api } from '../../../services/api';

/** 创建群组 API 返回值 */
interface CreateGroupResponse {
  group: Group;
  conversation: Conversation;
  participantNames: Record<string, string>;
}

/** 群组详情 API 返回值 */
interface GroupDetailResponse {
  group: Group;
  memberNames: Record<string, string>;
}

export const groupService = {
  /** 创建群组 */
  async createGroup(name: string, memberIds: string[]): Promise<CreateGroupResponse> {
    const res = await api.post<CreateGroupResponse>('/group', { name, memberIds });
    return res.data;
  },

  /** 获取群组详情 */
  async getGroup(groupId: string): Promise<GroupDetailResponse> {
    const res = await api.get<GroupDetailResponse>(`/group/${groupId}`);
    return res.data;
  },

  /** 邀请成员 */
  async addMember(groupId: string, userId: string): Promise<{ group: Group }> {
    const res = await api.post<{ group: Group }>(`/group/${groupId}/members`, { userId });
    return res.data;
  },

  /** 移除成员 */
  async removeMember(groupId: string, userId: string): Promise<{ group: Group }> {
    const res = await api.delete<{ group: Group }>(`/group/${groupId}/members/${userId}`);
    return res.data;
  },

  /** 退出群聊 */
  async leaveGroup(groupId: string): Promise<{ group: Group }> {
    const res = await api.post<{ group: Group }>(`/group/${groupId}/leave`);
    return res.data;
  },

  /** 解散群组 */
  async dissolveGroup(groupId: string): Promise<{ success: boolean }> {
    const res = await api.delete<{ success: boolean }>(`/group/${groupId}`);
    return res.data;
  },
};
