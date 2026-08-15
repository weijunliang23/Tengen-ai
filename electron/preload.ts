import { contextBridge } from 'electron';

// 渲染进程可通过 window.goBoard 访问（contextIsolation 下安全暴露最小信息）
contextBridge.exposeInMainWorld('goBoard', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
