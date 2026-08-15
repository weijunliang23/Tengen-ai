import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 使构建产物可用 file:// 协议加载（Electron 需要）
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    strictPort: true,
    // host: true = 监听所有网卡，同局域网设备可通过 http://<本机IP>:5173 访问
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
});
