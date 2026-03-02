import { Router } from 'express';
import type { ServerModule, ModuleContext, ModuleRegistration, TypedIO, TypedSocket } from '../../core/types';
import { TOKENS } from '../../core/tokens';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import { GroupService } from './GroupService';
import { createSessionMiddleware, type AuthenticatedRequest } from '../auth';

/**
 * 群组模块
 *
 * 提供群组创建、成员管理功能。
 * REST API 挂载到 /api/group/*，Socket.IO 用于广播群组变更事件。
 */
export class GroupModule implements ServerModule {
  name = 'group';

  register(ctx: ModuleContext): ModuleRegistration {
    const userRepo = ctx.resolve<IUserRepository>(TOKENS.UserRepository);
    const sessionRepo = ctx.resolve<ISessionRepository>(TOKENS.SessionRepository);
    const messageRepo = ctx.resolve<IMessageRepository>(TOKENS.MessageRepository);

    const groupService = new GroupService(messageRepo, userRepo);
    const sessionMiddleware = createSessionMiddleware(sessionRepo, userRepo);

    // 捕获 Socket.IO 实例用于 REST 路由中广播事件
    let ioRef: TypedIO | null = null;

    const router = Router();

    // POST /api/group — 创建群组
    router.post('/', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const { name, memberIds } = req.body;

        if (!name || typeof name !== 'string') {
          res.status(400).json({ error: '请输入群组名称' });
          return;
        }

        if (!Array.isArray(memberIds) || memberIds.length === 0) {
          res.status(400).json({ error: '请选择群组成员' });
          return;
        }

        const { group, conversation } = await groupService.createGroup(
          req.userId!,
          name,
          memberIds,
        );

        // 解析所有成员用户名
        const participantNames: Record<string, string> = {};
        for (const memberId of group.members) {
          const user = await userRepo.findById(memberId);
          participantNames[memberId] = user?.username || memberId;
        }

        // 通知其他成员被邀请加入群组
        if (ioRef) {
          for (const memberId of memberIds) {
            if (memberId !== req.userId) {
              ioRef.to(`user:${memberId}`).emit('group:invited', { group, conversation });
            }
          }
        }

        res.json({ group, conversation, participantNames });
      } catch (err: any) {
        if (err.message === 'GROUP_NAME_TOO_SHORT') {
          res.status(400).json({ error: '群组名称太短' });
          return;
        }
        if (err.message === 'GROUP_NAME_TOO_LONG') {
          res.status(400).json({ error: '群组名称太长' });
          return;
        }
        if (err.message === 'MEMBER_NOT_FOUND') {
          res.status(404).json({ error: '成员用户不存在' });
          return;
        }
        if (err.message === 'TOO_MANY_MEMBERS') {
          res.status(400).json({ error: '群组成员数超过上限' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // GET /api/group/:id — 获取群组信息
    router.get('/:id', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const group = await groupService.getGroup(id);
        if (!group) {
          res.status(404).json({ error: '群组不存在' });
          return;
        }

        // 解析成员用户名
        const memberNames: Record<string, string> = {};
        for (const memberId of group.members) {
          const user = await userRepo.findById(memberId);
          memberNames[memberId] = user?.username || memberId;
        }

        res.json({ group, memberNames });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/group/:id/members — 邀请成员
    router.post('/:id/members', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const groupId = req.params.id as string;
        const { userId } = req.body;

        if (!userId) {
          res.status(400).json({ error: '请指定用户' });
          return;
        }

        const updatedGroup = await groupService.addMember(groupId, userId, req.userId!);

        // 获取新成员用户名
        const user = await userRepo.findById(userId);
        const username = user?.username || userId;

        // 广播事件
        if (ioRef) {
          // 通知新成员
          const conversation = await messageRepo.getConversation(groupId);
          if (conversation) {
            ioRef.to(`user:${userId}`).emit('group:invited', { group: updatedGroup, conversation });
          }

          // 通知群内其他成员
          ioRef.to(groupId).emit('group:member_added', {
            groupId,
            userId,
            username,
          });

          // 让新成员的 socket 加入会话房间
          const sockets = await ioRef.in(`user:${userId}`).fetchSockets();
          for (const s of sockets) {
            s.join(groupId);
          }
        }

        res.json({ group: updatedGroup });
      } catch (err: any) {
        if (err.message === 'GROUP_NOT_FOUND') {
          res.status(404).json({ error: '群组不存在' });
          return;
        }
        if (err.message === 'NOT_GROUP_OWNER') {
          res.status(403).json({ error: '只有群主才能邀请成员' });
          return;
        }
        if (err.message === 'USER_NOT_FOUND') {
          res.status(404).json({ error: '用户不存在' });
          return;
        }
        if (err.message === 'ALREADY_MEMBER') {
          res.status(409).json({ error: '该用户已是群成员' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // DELETE /api/group/:id/members/:userId — 移除成员
    router.delete('/:id/members/:userId', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const groupId = req.params.id as string;
        const targetUserId = req.params.userId as string;

        const updatedGroup = await groupService.removeMember(
          groupId,
          targetUserId,
          req.userId!,
        );

        // 广播事件
        if (ioRef) {
          // 通知被移除的成员
          ioRef.to(`user:${targetUserId}`).emit('group:kicked', {
            groupId,
            conversationId: groupId,
          });

          // 通知群内其他成员
          ioRef.to(groupId).emit('group:member_removed', {
            groupId,
            userId: targetUserId,
          });

          // 让被移除成员的 socket 离开会话房间
          const sockets = await ioRef.in(`user:${targetUserId}`).fetchSockets();
          for (const s of sockets) {
            s.leave(groupId);
          }
        }

        res.json({ group: updatedGroup });
      } catch (err: any) {
        if (err.message === 'GROUP_NOT_FOUND') {
          res.status(404).json({ error: '群组不存在' });
          return;
        }
        if (err.message === 'NOT_GROUP_OWNER') {
          res.status(403).json({ error: '只有群主才能移除成员' });
          return;
        }
        if (err.message === 'CANNOT_REMOVE_OWNER') {
          res.status(400).json({ error: '不能移除群主' });
          return;
        }
        if (err.message === 'NOT_A_MEMBER') {
          res.status(404).json({ error: '该用户不是群成员' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/group/:id/leave — 退出群聊
    router.post('/:id/leave', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const groupId = req.params.id as string;

        const updatedGroup = await groupService.leaveGroup(groupId, req.userId!);

        // 广播事件
        if (ioRef) {
          // 通知群内成员
          ioRef.to(groupId).emit('group:member_removed', {
            groupId,
            userId: req.userId!,
          });

          // 让退出者的 socket 离开会话房间
          const sockets = await ioRef.in(`user:${req.userId}`).fetchSockets();
          for (const s of sockets) {
            s.leave(groupId);
          }
        }

        res.json({ group: updatedGroup });
      } catch (err: any) {
        if (err.message === 'GROUP_NOT_FOUND') {
          res.status(404).json({ error: '群组不存在' });
          return;
        }
        if (err.message === 'NOT_A_MEMBER') {
          res.status(404).json({ error: '你不是群成员' });
          return;
        }
        if (err.message === 'OWNER_CANNOT_LEAVE') {
          res.status(400).json({ error: '群主不能退出群聊，请先解散群组' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // DELETE /api/group/:id — 解散群组
    router.delete('/:id', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const groupId = req.params.id as string;

        const members = await groupService.dissolveGroup(groupId, req.userId!);

        // 通知所有成员群组已解散
        if (ioRef) {
          for (const memberId of members) {
            ioRef.to(`user:${memberId}`).emit('group:dissolved', {
              groupId,
              conversationId: groupId,
            });
          }

          // 所有成员 socket 离开会话房间
          const sockets = await ioRef.in(groupId).fetchSockets();
          for (const s of sockets) {
            s.leave(groupId);
          }
        }

        res.json({ success: true });
      } catch (err: any) {
        if (err.message === 'GROUP_NOT_FOUND') {
          res.status(404).json({ error: '群组不存在' });
          return;
        }
        if (err.message === 'NOT_GROUP_OWNER') {
          res.status(403).json({ error: '只有群主才能解散群组' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // Socket.IO 事件处理器 — 捕获 io 引用
    const socketHandler = (io: TypedIO, _socket: TypedSocket) => {
      ioRef = io;
    };

    return { router, socketHandler };
  }
}
