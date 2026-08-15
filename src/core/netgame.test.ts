import { describe, expect, it } from 'vitest';
import { NetGame, type NetTransport } from './netgame';
import { BLACK, WHITE } from './types';
import type { NetMsg } from './network';

/** 测试回环传输：link 后 send 直达对端 */
class LoopbackTransport implements NetTransport {
  onMsg: ((m: NetMsg) => void) | null = null;
  onCloseCb: (() => void) | null = null;
  peer: LoopbackTransport | null = null;

  link(other: LoopbackTransport): void {
    this.peer = other;
  }

  send(msg: NetMsg): void {
    this.peer?.onMsg?.(msg);
  }

  onMessage(cb: (m: NetMsg) => void): void {
    this.onMsg = cb;
  }

  onClose(cb: () => void): void {
    this.onCloseCb = cb;
  }

  close(): void {
    this.peer?.onCloseCb?.();
  }
}

function setup() {
  const a = new NetGame();
  const b = new NetGame();
  const ta = new LoopbackTransport();
  const tb = new LoopbackTransport();
  ta.link(tb);
  tb.link(ta);
  a.connect(ta, { size: 9, komi: 7.5, mode: 'lan', humanColor: BLACK });
  b.connect(tb, { size: 9, komi: 7.5, mode: 'lan', humanColor: WHITE });
  // 模拟服务器配对
  ta.onMsg!({ type: 'paired', color: BLACK, size: 9, komi: 7.5 });
  tb.onMsg!({ type: 'paired', color: WHITE, size: 9, komi: 7.5 });
  return { a, b };
}

describe('NetGame 联机对弈', () => {
  it('配对后创建对局并分配执子', () => {
    const { a, b } = setup();
    expect(a.myColor).toBe(BLACK);
    expect(b.myColor).toBe(WHITE);
    expect(a.status).toBe('playing');
    expect(a.game!.options.size).toBe(9);
    expect(a.isMyTurn).toBe(true); // 黑先行
    expect(b.isMyTurn).toBe(false);
  });

  it('本地落子经传输到达对方并应用', () => {
    const { a, b } = setup();
    expect(a.localPlay({ x: 3, y: 3 })).toBe(true);
    // 双方棋盘一致
    expect(a.game!.board.at({ x: 3, y: 3 })).toBe(BLACK);
    expect(b.game!.board.at({ x: 3, y: 3 })).toBe(BLACK);
    expect(b.isMyTurn).toBe(true); // 轮到白
  });

  it('轮次纪律：非己方回合落子被拒绝', () => {
    const { a, b } = setup();
    expect(b.localPlay({ x: 3, y: 3 })).toBe(false); // 黑先行，白不能动
    expect(a.localPlay({ x: 3, y: 3 })).toBe(true);
    expect(a.localPlay({ x: 4, y: 4 })).toBe(false); // 黑不能连走
    // 非法（占点）也不发送
    expect(b.localPlay({ x: 3, y: 3 })).toBe(false); // 白想下被黑占的点
  });

  it('提子转发', () => {
    const { a, b } = setup();
    a.localPass();
    expect(b.game!.history[b.game!.history.length - 1].point).toBeNull();
    expect(b.isMyTurn).toBe(true);
  });

  it('认输：对方收到并判定胜方', () => {
    const { a, b } = setup();
    a.localResign();
    expect(a.status).toBe('ended');
    expect(b.status).toBe('ended');
    expect(b.game!.ended).toBe(true);
    expect(b.game!.resignColor).toBe(BLACK); // 黑认输
    expect(b.statusText).toContain('你赢了');
  });

  it('再来一局：双方同意后新开一局', () => {
    const { a, b } = setup();
    a.localResign();
    expect(a.status).toBe('ended');
    b.requestRematch();
    a.requestRematch();
    // 双方都同意 → 各自新开一局
    expect(a.status).toBe('playing');
    expect(b.status).toBe('playing');
    expect(a.game!.moveNumber).toBe(0);
    expect(a.myColor).toBe(BLACK);
    expect(b.myColor).toBe(WHITE);
    expect(a.isMyTurn).toBe(true);
  });

  it('断开连接进入 disconnected', () => {
    const { a } = setup();
    a.disconnect();
    expect(a.status).toBe('idle');
    expect(a.game).toBeNull();
  });
});
