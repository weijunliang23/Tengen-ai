import type { WebSocketServer } from 'ws';

/** 局域网对战服务器（纯 JS 实现，见 lan-server.mjs） */
export declare function createLanServer(opts?: { port?: number }): {
  wss: WebSocketServer;
};
