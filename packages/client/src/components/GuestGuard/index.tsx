/**
 * 访客路由守卫
 *
 * 包裹仅允许未登录用户访问的页面（如登录、注册）：
 * - 初始化期间显示全屏加载动画
 * - 已登录用户重定向到首页 /
 * - 未登录用户正常渲染子组件
 */
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../../modules/auth/stores/useAuthStore';

interface GuestGuardProps {
  children: React.ReactNode;
}

const GuestGuard: React.FC<GuestGuardProps> = ({ children }) => {
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

  // 已登录，跳转到首页
  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default GuestGuard;
