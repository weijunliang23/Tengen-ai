import { app, BrowserWindow } from 'electron';
import * as path from 'path';

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 940,
    minHeight: 660,
    title: '围棋',
    backgroundColor: '#16120d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ------------------------------------------------------------------
 * KataGo 引擎桥（预留）
 *
 * 渲染进程无法直接启动子进程（contextIsolation + sandbox），需经主进程。
 * 启用步骤：
 *   1. 下载 KataGo：https://github.com/lightvector/KataGo/releases
 *   2. 下载权重：  *.bin.gz
 *   3. 设置环境变量 KATAGO_PATH / KATAGO_MODEL
 *   4. 注册 ipcMain.handle('ai:suggest', ...)：
 *      - spawn(KATAGO_PATH, ['gtp', '-model', KATAGO_MODEL])
 *      - 按 GTP 协议 boardsize / komi / play / genmove
 *      - 渲染进程通过 window.goBoard.suggest() 调用
 * ------------------------------------------------------------------ */
