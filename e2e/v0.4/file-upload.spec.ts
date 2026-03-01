import { test, expect, request } from '@playwright/test';
import { flushTestData, closeRedis } from '../helpers/redis';
import { registerUser } from '../helpers/api';
import { TEST_USERS } from '../fixtures/test-data';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3001';

test.describe('v0.4 - 文件上传 API', () => {
  let sessionId: string;

  test.beforeEach(async () => {
    await flushTestData();
    const user = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    sessionId = user.sessionId;
  });

  test.afterAll(async () => {
    await closeRedis();
  });

  test('1.1: 上传合法图片 → 200 + URL', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });

    // Create a minimal valid PNG (1x1 pixel)
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    const res = await ctx.post('/api/chat/upload/image', {
      headers: { 'x-session-id': sessionId },
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('/uploads/images/');
    expect(body.fileName).toBe('test.png');
    expect(body.mimeType).toBe('image/png');
    expect(body.fileSize).toBeGreaterThan(0);
    await ctx.dispose();
  });

  test('1.3: 上传不支持的类型 → 400', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });

    const res = await ctx.post('/api/chat/upload/image', {
      headers: { 'x-session-id': sessionId },
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('hello'),
        },
      },
    });

    expect(res.status()).toBe(400);
    await ctx.dispose();
  });

  test('1.4: 未登录时上传 → 401', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });

    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    const res = await ctx.post('/api/chat/upload/image', {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
      },
    });

    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('1.5: 上传通用文件 → 200', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });

    const res = await ctx.post('/api/chat/upload/file', {
      headers: { 'x-session-id': sessionId },
      multipart: {
        file: {
          name: 'document.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 fake pdf content'),
        },
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('/uploads/files/');
    expect(body.fileName).toBe('document.pdf');
    expect(body.fileSize).toBeGreaterThan(0);
    await ctx.dispose();
  });

  test('1.6: 上传中文文件名文件 → fileName 正确保留中文', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });

    const res = await ctx.post('/api/chat/upload/file', {
      headers: { 'x-session-id': sessionId },
      multipart: {
        file: {
          name: '测试文档.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 fake pdf content'),
        },
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.fileName).toBe('测试文档.pdf');
    await ctx.dispose();
  });
});
