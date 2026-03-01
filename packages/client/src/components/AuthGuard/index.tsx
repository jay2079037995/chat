/**
 * 认证路由守卫
 *
 * 包裹需要登录才能访问的页面：
 * - 初始化期间显示全屏加载动画
 * - 未登录用户重定向到 /login
 * - 已登录用户正常渲染子组件
 */
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../../modules/auth/stores/useAuthStore';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  const initAuth = useAuthStore((s) => s.initAuth);

  // 组件挂载时触发认证初始化
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // 初始化或加载中，显示 loading
  if (!initialized || loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  // 未登录，跳转到登录页
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
