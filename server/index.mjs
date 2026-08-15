/**
 * 局域网对战服务器入口：
 *   npm run server            # 默认端口 8080
 *   npm run server -- 9000    # 指定端口
 */
import { createLanServer } from './lan-server.mjs';
import { networkInterfaces } from 'node:os';

const port = Number(process.argv[2] || process.env.PORT || 8080);
const { wss } = createLanServer({ port });

wss.on('listening', () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log('围棋 · 局域网对战服务器已启动');
  console.log(`端口: ${port}`);
  for (const ip of ips) {
    console.log(`连接地址: ws://${ip}:${port}`);
  }
  console.log('两台设备连接后自动配对：先连 = 执黑，后连 = 执白');
  console.log('（对局参数以先连接一方的设置为准）');
});

wss.on('error', (err) => {
  console.error('服务器错误：', err.message);
  process.exit(1);
});
