import { request } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

export async function registerUser(username: string, password: string) {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post('/api/auth/register', { data: { username, password } });
  const body = await res.json();
  await ctx.dispose();
  return body as { token: string; sessionId: string; user: { id: string; username: string } };
}

export async function loginUser(username: string, password: string) {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post('/api/auth/login', { data: { username, password } });
  const body = await res.json();
  await ctx.dispose();
  return body as { token: string; sessionId: string; user: { id: string; username: string } };
}

export async function createGroup(sessionId: string, name: string, memberIds: string[]) {
  const ctx = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'x-session-id': sessionId },
  });
  const res = await ctx.post('/api/group', { data: { name, memberIds } });
  const body = await res.json();
  await ctx.dispose();
  return body as { group: any; conversation: any; participantNames: Record<string, string> };
}
