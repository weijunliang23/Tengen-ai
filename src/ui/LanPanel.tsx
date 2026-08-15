import { useState } from 'react';
import type { GameOptions } from '../core/game';
import type { NetGame } from '../core/netgame';
import { decodeMsg, encodeMsg } from '../core/network';
import { colorName } from '../core/types';

/** 联机对弈面板：连接服务器 / 状态 / 执子 / 再来一局 */
export function LanPanel({
  net,
  options,
  onExit,
}: {
  net: NetGame;
  options: GameOptions;
  onExit: () => void;
}) {
  const [addr, setAddr] = useState(() => {
    const host = typeof location !== 'undefined' ? location.hostname : 'localhost';
    return `ws://${host || 'localhost'}:8080`;
  });

  const connecting = net.status === 'connecting';
  const connected = net.status !== 'idle' && net.status !== 'connecting';

  const connect = () => {
    if (connecting) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(addr.trim());
    } catch {
      return;
    }
    net.connect(
      {
        send: (m) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(encodeMsg(m));
        },
        onMessage: (cb) => {
          ws.onmessage = (e) => {
            const m = decodeMsg(String(e.data));
            if (m) cb(m);
          };
        },
        onClose: (cb) => {
          ws.onclose = () => cb();
        },
        close: () => ws.close(),
      },
      options,
    );
  };

  return (
    <section className="card lan-card">
      <h2 className="card-title">
        <span className="card-icon">联</span>
        联机对弈
      </h2>

      {!connected ? (
        <>
          <div className="field">
            <span className="field-label">服务器地址</span>
            <input
              className="num-input"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="ws://192.168.x.x:8080"
            />
          </div>
          <button type="button" className="btn primary" onClick={connect} disabled={connecting}>
            {connecting ? '连接中…' : '连接服务器'}
          </button>
          <p className="card-note">
            需有一台设备运行 <code>npm run server</code>；两台设备连接后自动配对，先连执黑。手机需与电脑同一 Wi-Fi。
          </p>
        </>
      ) : (
        <>
          <div className={`lan-status${net.status === 'disconnected' ? ' error' : ''}`}>
            {net.statusText || '已连接'}
          </div>
          {net.myColor && <div className="lan-color">你执 {colorName(net.myColor)}</div>}
          {net.game && net.game.isAITurn() && <div className="lan-color dim">等待对方落子…</div>}
          {net.status === 'ended' && (
            <button
              type="button"
              className="btn"
              onClick={() => net.requestRematch()}
              disabled={net.rematchWaiting}
            >
              {net.rematchWaiting ? '等待对方同意…' : '再来一局'}
            </button>
          )}
          <button type="button" className="btn danger" onClick={onExit}>
            退出联机
          </button>
        </>
      )}
    </section>
  );
}
