import { describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createLanServer } from '../../server/lan-server.mjs';
import { decodeMsg } from './network';

function connect(port: number, size: number, komi: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', size, komi }));
      resolve(ws);
    });
    ws.on('error', reject);
  });
}

function nextMsg(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(decodeMsg(String(data))));
  });
}

describe('局域网服务器（真实 ws 双客户端）', () => {
  it('配对（先连执黑、参数以先连者为准）并转发落子', async () => {
    const { wss } = createLanServer({ port: 0 });
    await new Promise<void>((r) => wss.once('listening', () => r()));
    const port = (wss.address() as { port: number }).port;
    try {
      const a = await connect(port, 9, 7.5); // 先连：黑
      const b = await connect(port, 13, 6.5); // 后连：白
      const pairedA = await nextMsg(a);
      const pairedB = await nextMsg(b);
      expect(pairedA).toEqual({ type: 'paired', color: 1, size: 9, komi: 7.5 });
      expect(pairedB).toEqual({ type: 'paired', color: 2, size: 9, komi: 7.5 });

      // A 落子 → B 收到
      a.send(JSON.stringify({ type: 'move', x: 3, y: 3 }));
      expect(await nextMsg(b)).toEqual({ type: 'move', x: 3, y: 3 });

      // B 提子 → A 收到
      b.send(JSON.stringify({ type: 'pass' }));
      expect(await nextMsg(a)).toEqual({ type: 'pass' });

      // B 断开 → A 收到 opponent-left
      b.close();
      const left = await nextMsg(a);
      expect(left).toMatchObject({ type: 'opponent-left' });
    } finally {
      wss.close();
    }
  });

  it('第三位客户端不会被配对', async () => {
    const { wss } = createLanServer({ port: 0 });
    await new Promise<void>((r) => wss.once('listening', () => r()));
    const port = (wss.address() as { port: number }).port;
    try {
      const a = await connect(port, 9, 7.5);
      const b = await connect(port, 9, 7.5);
      await nextMsg(a);
      await nextMsg(b);
      const c = await connect(port, 9, 7.5);
      // 前两位保持配对；第三位不应收到 paired
      let gotMsg = false;
      c.on('message', () => {
        gotMsg = true;
      });
      await new Promise((r) => setTimeout(r, 300));
      expect(gotMsg).toBe(false);
      c.close();
    } finally {
      wss.close();
    }
  });
});
