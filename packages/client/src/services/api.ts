import axios from 'axios';

/**
 * 共享 Axios 实例
 *
 * 所有模块的 API 请求都通过此实例发送。
 * 自动附加 Session ID 到请求头，自动处理 401 认证失效。
 */
const api = axios.create({
  baseURL: '/api',
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

// 响应拦截器：401 时清除 Session，无 Token 时跳转登录页
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('sessionId');
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export { api };
