/**
 * 持久化配置存储
 *
 * 使用 electron-store 保存窗口位置、尺寸等用户配置。
 * 数据存储在系统用户目录下（macOS: ~/Library/Application Support/Chat/）。
 */
import Store from 'electron-store';

/** 窗口状态配置接口 */
interface WindowState {
  /** 窗口 X 坐标 */
  x?: number;
  /** 窗口 Y 坐标 */
  y?: number;
  /** 窗口宽度 */
  width: number;
  /** 窗口高度 */
  height: number;
  /** 是否最大化 */
  isMaximized: boolean;
}

/** 默认窗口状态 */
const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1200,
  height: 800,
  isMaximized: false,
};

const store = new Store({
  defaults: {
    windowState: DEFAULT_WINDOW_STATE,
  },
});

/** 获取保存的窗口状态 */
export function getWindowState(): WindowState {
  return store.get('windowState', DEFAULT_WINDOW_STATE) as WindowState;
}

/** 保存窗口状态 */
export function saveWindowState(state: WindowState): void {
  store.set('windowState', state);
}

export { DEFAULT_WINDOW_STATE };
export type { WindowState };
