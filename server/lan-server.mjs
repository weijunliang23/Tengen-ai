/**
 * 局域网对战服务器：只做配对与转发，规则校验在双方客户端进行。
 * 可被独立运行（index.mjs）或测试引用（createLanServer）。
 */
import { WebSocketServer } from 'ws';

export const BLACK = 1;
export const WHITE = 2;

export function createLanServer({ port = 0 } = {}) {
  const wss = new WebSocketServer({ port });
  /** ws -> { helloed, size, komi, peer } */
  const clients = new Map();

  const send = (socket, msg) => {
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify(msg));
    }
  };

  wss.on('connection', (ws) => {
    const info = { helloed: false, size: 19, komi: 7.5, peer: null };
    clients.set(ws, info);

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;

      if (msg.type === 'hello') {
        if (Number.isFinite(msg.size)) info.size = msg.size;
        if (Number.isFinite(msg.komi)) info.komi = msg.komi;
        info.helloed = true;

        // 寻找已 hello 且未配对的对端（先到者执黑并决定对局参数）
        let mate = null;
        for (const [sock, other] of clients) {
          if (sock !== ws && other.helloed && !other.peer) {
            mate = sock;
            break;
          }
        }
        if (mate) {
          const other = clients.get(mate);
          info.peer = mate;
          other.peer = ws;
          const size = other.size;
          const komi = other.komi;
          send(mate, { type: 'paired', color: BLACK, size, komi });
          send(ws, { type: 'paired', color: WHITE, size, komi });
        }
        return;
      }

      // 其余消息（move/pass/resign/rematch）：转发给对端
      if (info.peer) {
        send(info.peer, msg);
      }
    });

    ws.on('close', () => {
      if (info.peer) {
        const peerInfo = clients.get(info.peer);
        if (peerInfo) {
          peerInfo.peer = null;
          send(info.peer, { type: 'opponent-left', reason: '对手已断开' });
        }
      }
      clients.delete(ws);
    });
  });

  return { wss };
}
