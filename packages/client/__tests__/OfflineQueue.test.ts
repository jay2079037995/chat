/**
 * offlineQueue 单元测试 (v1.9.0)
 *
 * 验证离线消息队列的入队、出队、刷新和持久化逻辑。
 */
import { offlineQueue } from '../src/services/offlineQueue';

describe('OfflineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('enqueue / getAll', () => {
    it('should enqueue and retrieve a message', () => {
      offlineQueue.enqueue({
        conversationId: 'conv-1',
        type: 'text',
        content: '你好',
      });

      const queue = offlineQueue.getAll();
      expect(queue).toHaveLength(1);
      expect(queue[0].conversationId).toBe('conv-1');
      expect(queue[0].content).toBe('你好');
      expect(queue[0].type).toBe('text');
      expect(queue[0].id).toMatch(/^oq_/);
      expect(queue[0].queuedAt).toBeGreaterThan(0);
    });

    it('should enqueue multiple messages in order', () => {
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: '消息1' });
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: '消息2' });
      offlineQueue.enqueue({ conversationId: 'c2', type: 'image', content: '/img.png' });

      const queue = offlineQueue.getAll();
      expect(queue).toHaveLength(3);
      expect(queue[0].content).toBe('消息1');
      expect(queue[1].content).toBe('消息2');
      expect(queue[2].conversationId).toBe('c2');
    });

    it('should include optional metadata', () => {
      offlineQueue.enqueue({
        conversationId: 'c1',
        type: 'file',
        content: '/file.pdf',
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        replyTo: 'msg-123',
      });

      const queue = offlineQueue.getAll();
      expect(queue[0].fileName).toBe('test.pdf');
      expect(queue[0].fileSize).toBe(1024);
      expect(queue[0].mimeType).toBe('application/pdf');
      expect(queue[0].replyTo).toBe('msg-123');
    });
  });

  describe('remove', () => {
    it('should remove a specific message', () => {
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'A' });
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'B' });

      const queue = offlineQueue.getAll();
      offlineQueue.remove(queue[0].id);

      const remaining = offlineQueue.getAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].content).toBe('B');
    });
  });

  describe('clear', () => {
    it('should clear all queued messages', () => {
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'A' });
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'B' });

      offlineQueue.clear();
      expect(offlineQueue.getAll()).toHaveLength(0);
    });
  });

  describe('isEmpty / size', () => {
    it('should return true/0 when empty', () => {
      expect(offlineQueue.isEmpty()).toBe(true);
      expect(offlineQueue.size()).toBe(0);
    });

    it('should return false/count when has items', () => {
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'A' });
      expect(offlineQueue.isEmpty()).toBe(false);
      expect(offlineQueue.size()).toBe(1);
    });
  });

  describe('flush', () => {
    it('should send all messages and clear queue', async () => {
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'A' });
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'B' });

      const sendFn = jest.fn().mockResolvedValue(true);
      const sentCount = await offlineQueue.flush(sendFn);

      expect(sentCount).toBe(2);
      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(offlineQueue.getAll()).toHaveLength(0);
    });

    it('should stop on failure and keep remaining', async () => {
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'A' });
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'B' });
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'C' });

      const sendFn = jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const sentCount = await offlineQueue.flush(sendFn);

      expect(sentCount).toBe(1);
      expect(offlineQueue.getAll()).toHaveLength(2);
      expect(offlineQueue.getAll()[0].content).toBe('B');
    });

    it('should return 0 for empty queue', async () => {
      const sendFn = jest.fn();
      const sentCount = await offlineQueue.flush(sendFn);
      expect(sentCount).toBe(0);
      expect(sendFn).not.toHaveBeenCalled();
    });

    it('should stop on exception and keep remaining', async () => {
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'A' });
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'B' });

      const sendFn = jest.fn()
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('network'));

      const sentCount = await offlineQueue.flush(sendFn);
      expect(sentCount).toBe(1);
      expect(offlineQueue.getAll()).toHaveLength(1);
    });
  });

  describe('persistence', () => {
    it('should persist to localStorage', () => {
      offlineQueue.enqueue({ conversationId: 'c1', type: 'text', content: 'A' });

      const raw = localStorage.getItem('offline_queue');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].content).toBe('A');
    });
  });
});
