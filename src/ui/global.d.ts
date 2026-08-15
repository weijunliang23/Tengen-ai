import type { KatagoBridge } from '../core/ai/katago';

declare global {
  /** Electron preload 暴露的桥接口 */
  interface GoBoardBridge {
    platform: string;
    versions: { electron: string; chrome: string; node: string };
    /** KataGo 桥（仅 Electron 桌面端存在；Web 端为 undefined） */
    katago?: KatagoBridge;
  }

  interface Window {
    goBoard?: GoBoardBridge;
  }
}

export {};
