import { describe, expect, it } from 'vitest';
import { Board } from './board';
import { scoreChinese } from './scoring';
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

describe('中国规则数子法', () => {
  it('空盘贴 7.5 目 → 白胜', () => {
    const b = new Board(19);
    const s = scoreChinese(b, 7.5);
    expect(s.winner).toBe(WHITE);
    expect(s.blackPoints).toBe(0);
    expect(s.whitePoints).toBe(0);
    expect(s.margin).toBeCloseTo(184.25, 5);
  });

  it('黑围住中央一目', () => {
    // 黑子围 (2,2) 一目（5x5）
    const b = boardFromGrid([
      [0, 0, 0, 0, 0],
      [0, 0, X, 0, 0],
      [0, X, 0, X, 0],
      [0, 0, X, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const s = scoreChinese(b, 0);
    expect(s.blackStones).toBe(4);
    expect(s.blackTerritory).toBe(21); // 环外一整片 + 中央一目
    expect(s.blackPoints).toBe(25);
    expect(s.winner).toBe(BLACK);
  });

  it('死子标记后按被提处理', () => {
    // 黑 (2,2) 被白包围，气为 0（死子）
    const b = boardFromGrid([
      [0, 0, 0, 0, 0],
      [0, 0, O, 0, 0],
      [0, O, X, O, 0],
      [0, 0, O, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const withoutDead = scoreChinese(b, 0);
    expect(withoutDead.blackPoints).toBe(1);

    const withDead = scoreChinese(b, 0, [{ x: 2, y: 2 }]);
    expect(withDead.blackPoints).toBe(0);
    expect(withDead.whiteTerritory).toBe(withoutDead.whiteTerritory + 1);
    expect(withDead.winner).toBe(WHITE);
  });

  it('黑满盘必胜', () => {
    const b = new Board(9);
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) b.set({ x, y }, BLACK);
    }
    const s = scoreChinese(b, 7.5);
    expect(s.blackPoints).toBe(81);
    expect(s.winner).toBe(BLACK);
  });

  it('19 路贴 7.5 目黑需 185 子', () => {
    // 黑 184 子（其余全白填满，无空点）→ 白胜；黑 185 子 → 黑胜
    const make = (blackCount: number) => {
      const b = new Board(19);
      for (let y = 0; y < 19; y++) {
        for (let x = 0; x < 19; x++) {
          b.set({ x, y }, x + y * 19 < blackCount ? BLACK : WHITE);
        }
      }
      return b;
    };
    expect(scoreChinese(make(184), 7.5).winner).toBe(WHITE);
    expect(scoreChinese(make(185), 7.5).winner).toBe(BLACK);
  });
});
