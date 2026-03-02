/**
 * cacheService 单元测试
 *
 * 使用 jsdom 环境下的 localStorage 来验证缓存读写和清除逻辑。
 */

import { cacheService } from '../src/services/cacheService';

describe('CacheService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('User Info', () => {
    it('should save and retrieve user info', () => {
      const user = { id: 'u1', username: 'alice', createdAt: Date.now(), updatedAt: Date.now() };
      cacheService.saveUserInfo(user);

      const cached = cacheService.getUserInfo();
      expect(cached).toEqual(user);
    });

    it('should return null when no user cached', () => {
      expect(cacheService.getUserInfo()).toBeNull();
    });
  });

  describe('Conversations', () => {
    it('should save and retrieve conversations with names', () => {
      const data = {
        conversations: [
          { id: 'conv1', type: 'private' as const, participants: ['u1', 'u2'], updatedAt: Date.now(), unreadCount: 2 },
        ],
        participantNames: { u1: 'Alice', u2: 'Bob' },
        groupNames: { 'group:g1': '测试群' },
      };
      cacheService.saveConversations(data);

      const cached = cacheService.getConversations();
      expect(cached).not.toBeNull();
      expect(cached!.conversations).toEqual(data.conversations);
      expect(cached!.participantNames).toEqual(data.participantNames);
      expect(cached!.groupNames).toEqual(data.groupNames);
    });

    it('should return null when no conversations cached', () => {
      expect(cacheService.getConversations()).toBeNull();
    });
  });

  describe('Messages', () => {
    it('should save and retrieve messages', () => {
      const messages = [
        { id: 'msg1', conversationId: 'conv1', senderId: 'u1', type: 'text' as const, content: '你好', createdAt: Date.now() },
        { id: 'msg2', conversationId: 'conv1', senderId: 'u2', type: 'text' as const, content: '世界', createdAt: Date.now() + 1 },
      ];
      cacheService.saveMessages('conv1', messages);

      const cached = cacheService.getMessages('conv1');
      expect(cached).toEqual(messages);
    });

    it('should limit cached messages to 50', () => {
      const messages = Array.from({ length: 80 }, (_, i) => ({
        id: `msg-${i}`,
        conversationId: 'conv1',
        senderId: 'u1',
        type: 'text' as const,
        content: `消息${i}`,
        createdAt: Date.now() + i,
      }));
      cacheService.saveMessages('conv1', messages);

      const cached = cacheService.getMessages('conv1');
      expect(cached).not.toBeNull();
      expect(cached!.length).toBe(50);
      // 应该保留最新的 50 条（slice(-50)）
      expect(cached![0].id).toBe('msg-30');
      expect(cached![49].id).toBe('msg-79');
    });

    it('should return null when no messages cached', () => {
      expect(cacheService.getMessages('nonexistent')).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('should clear all cache keys', () => {
      cacheService.saveUserInfo({ id: 'u1', username: 'alice', createdAt: Date.now(), updatedAt: Date.now() });
      cacheService.saveConversations({
        conversations: [],
        participantNames: {},
        groupNames: {},
      });
      cacheService.saveMessages('conv1', []);

      // 确认缓存已写入
      expect(cacheService.getUserInfo()).not.toBeNull();
      expect(cacheService.getConversations()).not.toBeNull();

      cacheService.clearAll();

      expect(cacheService.getUserInfo()).toBeNull();
      expect(cacheService.getConversations()).toBeNull();
      expect(cacheService.getMessages('conv1')).toBeNull();
    });

    it('should not remove non-cache keys', () => {
      localStorage.setItem('token', 'my-jwt-token');
      cacheService.saveUserInfo({ id: 'u1', username: 'alice', createdAt: Date.now(), updatedAt: Date.now() });

      cacheService.clearAll();

      // token 不以 cache: 开头，应保留
      expect(localStorage.getItem('token')).toBe('my-jwt-token');
    });
  });
});
