import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { KataGoManager } from './katago-manager';

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const katago = new KataGoManager();

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
    void win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

/** KataGo IPC 桥（渲染进程经 preload 调用） */
function registerKatagoIpc(): void {
  ipcMain.handle('katago:configure', (_e, opts) => katago.configure(opts));
  ipcMain.handle('katago:close', () => katago.close());
  ipcMain.handle('katago:setup', (_e, params) => katago.setup(params));
  ipcMain.handle('katago:play', (_e, params) => katago.play(params));
  ipcMain.handle('katago:genmove', (_e, params) => katago.genmove(params.color));
  ipcMain.handle('katago:analyze', (_e, params) => katago.analyze(params));
  ipcMain.handle('katago:setVisits', (_e, visits) => katago.setVisits(visits));
}

app.whenReady().then(() => {
  registerKatagoIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  void katago.close();
});
