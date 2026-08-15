import { describe, expect, it } from 'vitest';
import { parseSgf, pointToSgf, sgfToPoint, toSgf } from './sgf';
import { BLACK, WHITE } from './types';

describe('SGF', () => {
  it('解析基本棋谱', () => {
    const g = parseSgf('(;GM[1]FF[4]SZ[9]KM[7.5]PB[黑]PW[白];B[dd];W[cc];B[])');
    expect(g.size).toBe(9);
    expect(g.komi).toBe(7.5);
    expect(g.playerBlack).toBe('黑');
    expect(g.playerWhite).toBe('白');
    expect(g.moves).toEqual([
      { x: 3, y: 3 },
      { x: 2, y: 2 },
      null, // 提子
    ]);
    expect(g.colors).toEqual([BLACK, WHITE, BLACK]);
  });

  it('坐标映射跳过 i（与 GTP 一致：a..t 对应 0..18）', () => {
    expect(sgfToPoint('aa')).toEqual({ x: 0, y: 0 });
    expect(sgfToPoint('jj')).toEqual({ x: 8, y: 8 }); // 9 路角
    expect(sgfToPoint('tt')).toEqual({ x: 18, y: 18 }); // 19 路角
    expect(sgfToPoint('kk')).toEqual({ x: 9, y: 9 }); // 19 路天元
    expect(pointToSgf({ x: 18, y: 18 })).toBe('tt');
    expect(pointToSgf({ x: 8, y: 8 })).toBe('jj');
    expect(pointToSgf({ x: 9, y: 9 })).toBe('kk');
  });

  it('分支取第一个（主变）', () => {
    const g = parseSgf('(;GM[1]SZ[19];B[dd];(;W[cc])(;W[qq]))');
    expect(g.moves).toEqual([
      { x: 3, y: 3 },
      { x: 2, y: 2 },
    ]);
  });

  it('导出后重新解析一致（roundtrip）', () => {
    const sgf = toSgf({
      size: 13,
      komi: 7.5,
      moves: [
        { x: 3, y: 3 },
        { x: 9, y: 9 },
        null,
      ],
      colors: [BLACK, WHITE, BLACK],
      playerBlack: '黑棋',
      playerWhite: '白棋',
    });
    const g = parseSgf(sgf);
    expect(g.size).toBe(13);
    expect(g.komi).toBe(7.5);
    expect(g.moves).toEqual([
      { x: 3, y: 3 },
      { x: 9, y: 9 },
      null,
    ]);
    expect(g.colors).toEqual([BLACK, WHITE, BLACK]);
  });

  it('缺省尺寸为 19', () => {
    const g = parseSgf('(;GM[1];B[dd])');
    expect(g.size).toBe(19);
    expect(g.komi).toBeNull();
  });
});
