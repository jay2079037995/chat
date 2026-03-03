import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './registerSW';
import './styles/global.less';

// --- vConsole 调试面板（Electron 环境，通过 ~/.chat-debug 控制） ---
interface ElectronAPI {
  isElectron: boolean;
  getDebugStatus: () => Promise<boolean>;
  onDebugStatus: (cb: (enabled: boolean) => void) => void;
}

let vConsoleInstance: any = null;

function toggleVConsole(enabled: boolean): void {
  if (enabled && !vConsoleInstance) {
    import('vconsole').then(({ default: VConsole }) => {
      vConsoleInstance = new VConsole();
    });
  } else if (!enabled && vConsoleInstance) {
    vConsoleInstance.destroy();
    vConsoleInstance = null;
  }
}

const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;
if (electronAPI?.isElectron) {
  electronAPI.getDebugStatus().then(toggleVConsole);
  electronAPI.onDebugStatus(toggleVConsole);
}

// --- 应用渲染 ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// --- PWA Service Worker 注册 + 网络监听 ---
registerServiceWorker();
import('./modules/chat/stores/useSocketStore').then(({ useSocketStore }) => {
  useSocketStore.getState().startNetworkListener();
});
