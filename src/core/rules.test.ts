import { describe, expect, it } from 'vitest';
import { Board } from './board';
import { applyMove, forcePlay } from './rules';
import { BLACK, WHITE } from './types';

const X = BLACK;
const O = WHITE;

/** 点排序比较器 */
const cmp = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x - b.x || a.y - b.y;

function boardFromGrid(rows: (0 | 1 | 2)[][]): Board {
  const size = rows.length;
  const b = new Board(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = rows[y][x];
      if (c !== 0) b.set({ x, y }, c);
    }
  }
  return b;
}

describe('提子', () => {
  it('提掉无气的单子', () => {
    // 白 (1,1) 只有一气 (1,0)
    const b = boardFromGrid([
      [0, 0, 0],
      [X, O, X],
      [0, X, 0],
    ]);
    const res = applyMove(b, { x: 1, y: 0 }, X);
    expect(res.legal).toBe(true);
    expect(res.captured).toEqual([{ x: 1, y: 1 }]);
    expect(res.koPoint).toEqual({ x: 1, y: 1 });
    expect(b.at({ x: 1, y: 1 })).toBe(0);
  });

  it('一次提掉整串', () => {
    // 白串 (1,1),(2,1) 只有一气 (3,1)
    const b = boardFromGrid([
      [0, X, X, 0],
      [X, O, O, 0],
      [X, X, X, 0],
      [0, 0, 0, 0],
    ]);
    const res = applyMove(b, { x: 3, y: 1 }, X);
    expect(res.legal).toBe(true);
    expect([...res.captured].sort(cmp)).toEqual(
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ].sort(cmp),
    );
  });

  it('一着可同时提多个棋串', () => {
    // 白 (1,1) 与白 (3,1) 各只剩一气 (2,1)；黑下 (2,1) 同时提两串
    const b = boardFromGrid([
      [0, X, 0, X],
      [X, O, 0, O],
      [0, X, O, X],
      [0, 0, 0, 0],
    ]);
    const res = applyMove(b, { x: 2, y: 1 }, X);
    expect(res.legal).toBe(true);
    expect([...res.captured].sort(cmp)).toEqual(
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
      ].sort(cmp),
    );
    expect(res.koPoint).toBeNull(); // 提了 2 子，非劫
  });
});

describe('落子合法性', () => {
  it('占点非法', () => {
    const b = boardFromGrid([
      [X, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    const res = applyMove(b, { x: 0, y: 0 }, O);
    expect(res.legal).toBe(false);
    expect(res.reason).toBe('occupied');
  });

  it('自杀非法', () => {
    const b = boardFromGrid([
      [0, O, 0],
      [O, 0, O],
      [0, O, 0],
    ]);
    // 中心被白包围，黑下中心 → 自杀
    const res = applyMove(b, { x: 1, y: 1 }, X);
    expect(res.legal).toBe(false);
    expect(res.reason).toBe('suicide');
    expect(b.at({ x: 1, y: 1 })).toBe(0); // 棋盘恢复
  });

  it('打吃（只剩一气）合法', () => {
    const b = boardFromGrid([
      [0, O, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    // 黑下 (0,0)，邻白 (0,1)，黑只有一气 (1,0) —— 自打吃，合法
    const res = applyMove(b, { x: 0, y: 0 }, X);
    expect(res.legal).toBe(true);
  });

  it('提子使己方有气则不判自杀', () => {
    // 黑落入白环中心：落子即提掉整环，己方有气，合法
    const b = boardFromGrid([
      [O, O, O],
      [O, 0, O],
      [O, O, O],
    ]);
    const res = applyMove(b, { x: 1, y: 1 }, X);
    expect(res.legal).toBe(true);
    expect(res.captured.length).toBe(8);
    expect(b.at({ x: 1, y: 1 })).toBe(X);
  });
});

describe('劫与禁全同（superko）', () => {
  it('简单劫：立即回提被禁止', () => {
    // 经典简单劫（5x5）
    // 黑 P=(3,2) 提白 Q=(2,2)；白回提 P 后黑不得立即回提
    const b = boardFromGrid([
      [0, 0, 0, 0, 0],
      [0, 0, X, O, 0],
      [0, X, O, 0, O],
      [0, 0, X, O, 0],
      [0, 0, 0, 0, 0],
    ]);
    const counts = new Map<string, number>();
    counts.set(new Board(5).signature(), 1);

    // 黑提
    const r1 = applyMove(b, { x: 3, y: 2 }, X, counts);
    expect(r1.legal).toBe(true);
    expect(r1.captured).toEqual([{ x: 2, y: 2 }]);
    counts.set(b.signature(), 1);

    // 白回提
    const r2 = applyMove(b, { x: 2, y: 2 }, O, counts);
    expect(r2.legal).toBe(true);
    expect(r2.captured).toEqual([{ x: 3, y: 2 }]);
    counts.set(b.signature(), 1);

    // 黑立即回提 → 禁全同
    const r3 = applyMove(b, { x: 3, y: 2 }, X, counts);
    expect(r3.legal).toBe(false);
    expect(r3.reason).toBe('superko');
    expect(b.at({ x: 3, y: 2 })).toBe(0);
    expect(b.at({ x: 2, y: 2 })).toBe(O);
  });

  it('隔一手后可回提（局面不同则允许）', () => {
    const b = boardFromGrid([
      [0, 0, 0, 0, 0],
      [0, 0, X, O, 0],
      [0, X, O, 0, O],
      [0, 0, X, O, 0],
      [0, 0, 0, 0, 0],
    ]);
    const counts = new Map<string, number>();
    counts.set(new Board(5).signature(), 1);

    applyMove(b, { x: 3, y: 2 }, X, counts);
    counts.set(b.signature(), 1);
    applyMove(b, { x: 2, y: 2 }, O, counts);
    counts.set(b.signature(), 1);

    // 黑先在别处落子（局面改变）
    const elsewhere = applyMove(b, { x: 0, y: 0 }, X, counts);
    expect(elsewhere.legal).toBe(true);
    counts.set(b.signature(), 1);

    // 再回提劫点 → 新局面（含 (0,0) 黑子），合法
    const recapture = applyMove(b, { x: 3, y: 2 }, X, counts);
    expect(recapture.legal).toBe(true);
    expect(recapture.captured).toEqual([{ x: 2, y: 2 }]);
  });
});

describe('forcePlay 重放', () => {
  it('按历史重放得到相同局面', () => {
    const b1 = new Board(5);
    const b2 = new Board(5);
    const moves: { p: { x: number; y: number }; c: 1 | 2 }[] = [
      { p: { x: 2, y: 2 }, c: X },
      { p: { x: 3, y: 3 }, c: O },
      { p: { x: 2, y: 3 }, c: X },
    ];
    for (const m of moves) {
      const res = applyMove(b1, m.p, m.c);
      expect(res.legal).toBe(true);
      forcePlay(b2, m.p, m.c);
    }
    expect(b2.equals(b1)).toBe(true);
  });
});
