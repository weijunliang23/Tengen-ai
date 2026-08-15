/** Electron preload 暴露的桥接口 */
interface GoBoardBridge {
  platform: string;
  versions: { electron: string; chrome: string; node: string };
}

interface Window {
  goBoard?: GoBoardBridge;
}
