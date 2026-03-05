import axios from 'axios';

/**
 * 共享 Axios 实例
 *
 * 所有模块的 API 请求都通过此实例发送。
 * 自动附加 Session ID 到请求头，自动处理 401 认证失效。
 * 401 时自动尝试用 token 重建 session，失败则跳转登录页。
 */
/** Electron 打包后从本地文件加载，API 需指向服务端地址 */
const serverUrl = (window as any).electronAPI?.serverUrl || '';

const api = axios.create({
  baseURL: `${serverUrl}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动附加 Session ID 到请求头
api.interceptors.request.use((config) => {
  const sessionId = sessionStorage.getItem('sessionId');
  if (sessionId) {
    config.headers['x-session-id'] = sessionId;
  }
  return config;
});

/** 跳转到登录页 */
function redirectToLogin() {
  sessionStorage.removeItem('sessionId');
  localStorage.removeItem('token');
  window.location.href = (window as any).electronAPI?.isElectron ? '#/login' : '/login';
}

/** 防止并发 session 刷新 */
let refreshingSession: Promise<string | null> | null = null;

/**
 * 用 localStorage 中的 token 重建 session
 * 返回新 sessionId，失败返回 null
 */
async function refreshSession(): Promise<string | null> {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    // 直接用 axios 调用，避免触发拦截器循环
    const res = await axios.post(`${serverUrl}/api/auth/session`, { token });
    const { sessionId } = res.data;
    sessionStorage.setItem('sessionId', sessionId);
    return sessionId;
  } catch {
    return null;
  }
}

// 响应拦截器：401 时自动重建 session 并重试请求
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retried) {
      originalRequest._retried = true;
      sessionStorage.removeItem('sessionId');

      // 复用同一个刷新 promise，防止并发请求同时刷新
      if (!refreshingSession) {
        refreshingSession = refreshSession().finally(() => { refreshingSession = null; });
      }
      const newSessionId = await refreshingSession;

      if (newSessionId) {
        // 用新 session 重试原始请求
        originalRequest.headers['x-session-id'] = newSessionId;
        return api(originalRequest);
      }

      // token 也无效，跳转登录页
      redirectToLogin();
    }
    return Promise.reject(error);
  },
);

export { api };
