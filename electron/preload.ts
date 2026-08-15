import { contextBridge, ipcRenderer } from 'electron';
import type { KatagoBridge } from '../src/core/ai/katago';

// 渲染进程可通过 window.goBoard 访问（contextIsolation 下安全暴露最小信息）
const katago: KatagoBridge = {
  configure: (opts) => ipcRenderer.invoke('katago:configure', opts),
  close: () => ipcRenderer.invoke('katago:close'),
  setup: (params) => ipcRenderer.invoke('katago:setup', params),
  play: (params) => ipcRenderer.invoke('katago:play', params),
  genmove: (params) => ipcRenderer.invoke('katago:genmove', params),
  analyze: (params) => ipcRenderer.invoke('katago:analyze', params),
  setVisits: (visits) => ipcRenderer.invoke('katago:setVisits', visits),
};

contextBridge.exposeInMainWorld('goBoard', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  katago,
});
