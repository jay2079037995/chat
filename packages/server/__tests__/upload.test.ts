import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app';
import { getRedisClient, closeRedisClient } from '../src/repositories/redis/RedisClient';

describe('File Upload API (v0.4.0)', () => {
  let sessionId: string;

  beforeEach(async () => {
    const redis = getRedisClient();
    await redis.flushdb();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'uploaduser', password: 'password123' });
    sessionId = res.body.sessionId;
  });

  afterAll(async () => {
    // 清理测试上传文件
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }
    await closeRedisClient();
  });

  describe('POST /api/chat/upload/image', () => {
    it('should upload a valid image', async () => {
      // 创建一个最小的 PNG 文件 (1x1 pixel)
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      const res = await request(app)
        .post('/api/chat/upload/image')
        .set('x-session-id', sessionId)
        .attach('file', pngBuffer, { filename: 'test.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.url).toMatch(/^\/uploads\/images\//);
      expect(res.body.fileName).toBe('test.png');
      expect(res.body.fileSize).toBeGreaterThan(0);
      expect(res.body.mimeType).toBe('image/png');
    });

    it('should reject unsupported file types', async () => {
      const textBuffer = Buffer.from('hello world');

      const res = await request(app)
        .post('/api/chat/upload/image')
        .set('x-session-id', sessionId)
        .attach('file', textBuffer, { filename: 'test.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('不支持的文件类型');
    });

    it('should reject without authentication', async () => {
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      const res = await request(app)
        .post('/api/chat/upload/image')
        .attach('file', pngBuffer, { filename: 'test.png', contentType: 'image/png' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/chat/upload/file', () => {
    it('should upload a generic file', async () => {
      const buffer = Buffer.from('test file content');

      const res = await request(app)
        .post('/api/chat/upload/file')
        .set('x-session-id', sessionId)
        .attach('file', buffer, { filename: 'document.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(200);
      expect(res.body.url).toMatch(/^\/uploads\/files\//);
      expect(res.body.fileName).toBe('document.pdf');
      expect(res.body.fileSize).toBeGreaterThan(0);
      expect(res.body.mimeType).toBe('application/pdf');
    });

    it('should upload an audio file to audio directory', async () => {
      const buffer = Buffer.from('fake audio data');

      const res = await request(app)
        .post('/api/chat/upload/file')
        .set('x-session-id', sessionId)
        .attach('file', buffer, { filename: 'recording.webm', contentType: 'audio/webm' });

      expect(res.status).toBe(200);
      expect(res.body.url).toMatch(/^\/uploads\/audio\//);
      expect(res.body.mimeType).toBe('audio/webm');
    });

    it('should reject without authentication', async () => {
      const buffer = Buffer.from('test');

      const res = await request(app)
        .post('/api/chat/upload/file')
        .attach('file', buffer, { filename: 'test.txt', contentType: 'text/plain' });

      expect(res.status).toBe(401);
    });

    it('should preserve Chinese characters in fileName', async () => {
      const buffer = Buffer.from('fake pdf content');

      const res = await request(app)
        .post('/api/chat/upload/file')
        .set('x-session-id', sessionId)
        .attach('file', buffer, { filename: '测试文档.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(200);
      expect(res.body.fileName).toBe('测试文档.pdf');
    });
  });
});
