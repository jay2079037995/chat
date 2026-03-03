/**
 * PWA 安装提示组件
 *
 * 监听浏览器的 beforeinstallprompt 事件，
 * 当应用可安装时显示"添加到主屏幕"提示条。
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from 'antd';
import { DownloadOutlined, CloseOutlined } from '@ant-design/icons';
import styles from './index.module.less';

/** beforeinstallprompt 事件接口 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 24 小时内关闭过则不再提示
    const dismissedAt = localStorage.getItem('pwa_install_dismissed');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 24 * 60 * 60 * 1000) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA]', outcome === 'accepted' ? '用户接受安装' : '用户取消安装');
    setDeferredPrompt(null);
    setVisible(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDeferredPrompt(null);
    localStorage.setItem('pwa_install_dismissed', String(Date.now()));
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.container} data-testid="install-prompt">
      <div className={styles.content}>
        <DownloadOutlined className={styles.icon} />
        <span className={styles.text}>将 Chat 添加到主屏幕，获得更好体验</span>
      </div>
      <div className={styles.actions}>
        <Button type="primary" size="small" onClick={handleInstall} data-testid="install-button">
          安装
        </Button>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleDismiss}
          data-testid="dismiss-button"
        />
      </div>
    </div>
  );
};

export default InstallPrompt;
