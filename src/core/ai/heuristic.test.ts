import { describe, expect, it } from 'vitest';
import { HeuristicEngine } from './heuristic';
import { Board } from '../board';
import { BLACK, WHITE } from '../types';

const X = BLACK;
const O = WHITE;

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

describe('启发式 AI', () => {
  it('空盘给出合法着点', async () => {
    const engine = new HeuristicEngine(() => 0.5);
    const b = new Board(9);
    const m = await engine.suggest(b, BLACK, 0);
    expect(m.point).not.toBeNull();
    expect(b.inBounds(m.point!)).toBe(true);
  });

  it('满盘时提子', async () => {
    const engine = new HeuristicEngine(() => 0.5);
    const b = new Board(3);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) b.set({ x, y }, (x + y) % 2 === 0 ? BLACK : WHITE);
    }
    const m = await engine.suggest(b, BLACK, 8);
    expect(m.point).toBeNull();
  });

  it('能提子时优先提子', async () => {
    const engine = new HeuristicEngine(() => 0.5);
    // 白 (2,2) 只剩一气 (2,3)，黑应下 (2,3) 提掉
    const b = boardFromGrid([
      [0, 0, 0, 0, 0],
      [0, 0, X, 0, 0],
      [0, X, O, X, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const m = await engine.suggest(b, BLACK, 3);
    expect(m.point).toEqual({ x: 2, y: 3 });
  });

  it('不填自己的眼', async () => {
    const engine = new HeuristicEngine(() => 0.5);
    // 黑已围出 (2,2) 单点眼（四邻全黑），AI 不应下进去
    const b = boardFromGrid([
      [0, 0, 0, 0, 0],
      [0, 0, X, 0, 0],
      [0, X, 0, X, 0],
      [0, 0, X, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const m = await engine.suggest(b, BLACK, 5);
    expect(m.point).not.toEqual({ x: 2, y: 2 });
  });

  it('一步搜索：救活被打吃的己方大棋（避免送吃）', async () => {
    const engine = new HeuristicEngine(() => 0.5);
    // 黑棋串 (2,2),(3,2) 只剩 (3,3) 一口气；黑若乱下别处，白可提 2 子
    const b = boardFromGrid([
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, O, O, 0, 0, 0],
      [0, O, X, X, O, 0, 0],
      [0, 0, O, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ]);
    const m = await engine.suggest(b, BLACK, 4);
    expect(m.point).toEqual({ x: 3, y: 3 });
    expect(m.description).toContain('救活');
  });
});
