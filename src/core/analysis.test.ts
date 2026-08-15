import { describe, expect, it } from 'vitest';
import { Board } from './board';
import { assessPosition, buildMoveReasons } from './analysis';
import { applyMove } from './rules';
import { BLACK, WHITE } from './types';

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

describe('分析模块', () => {
  it('形势判断：双方子+空与领先方', () => {
    // 黑左三列 vs 白右四列（教学数子课局面）
    const b = new Board(9);
    for (let y = 0; y < 9; y++) {
      b.set({ x: 3, y }, BLACK);
      b.set({ x: 4, y }, WHITE);
    }
    const a = assessPosition(b, 7.5);
    expect(a.report.blackPoints).toBe(36);
    expect(a.report.whitePoints).toBe(45);
    expect(a.report.winner).toBe(WHITE);
    expect(a.text).toContain('白方领先');
    expect(a.text).toContain('黑约 36 点');
  });

  it('走子理由：提子着法返回提子理由', () => {
    // 白 (2,2) 只剩一气 (2,3)
    const b = boardFromGrid([
      [0, 0, 0, 0, 0],
      [0, 0, X, 0, 0],
      [0, X, O, X, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const probe = b.clone();
    const res = applyMove(probe, { x: 2, y: 3 }, BLACK);
    const reasons = buildMoveReasons(b, BLACK, { x: 2, y: 3 }, res, probe, 0);
    expect(reasons.some((r) => r.kind === 'capture')).toBe(true);
    expect(reasons.some((r) => r.text.includes('提掉白棋 1 子'))).toBe(true);
  });

  it('走子理由：打吃与危险', () => {
    // 白 (3,2) 有两气 (3,1) 与 (3,3)；黑下 (3,3) 后白只剩 (3,1) 一气 → 打吃（不构成提子）
    const b = new Board(7);
    b.set({ x: 3, y: 2 }, WHITE);
    b.set({ x: 2, y: 2 }, BLACK);
    b.set({ x: 4, y: 2 }, BLACK);
    const probe = b.clone();
    const res = applyMove(probe, { x: 3, y: 3 }, BLACK);
    expect(res.captured.length).toBe(0);
    const reasons = buildMoveReasons(b, BLACK, { x: 3, y: 3 }, res, probe, 0);
    expect(reasons.some((r) => r.kind === 'atari')).toBe(true);
    expect(reasons.some((r) => r.text.includes('打吃白棋'))).toBe(true);
  });

  it('走子理由：空旷地带为“大场”', () => {
    const b = new Board(9);
    const probe = b.clone();
    const res = applyMove(probe, { x: 4, y: 4 }, BLACK);
    const reasons = buildMoveReasons(b, BLACK, { x: 4, y: 4 }, res, probe, 0);
    expect(reasons.some((r) => r.kind === 'big-point')).toBe(true);
  });
});
