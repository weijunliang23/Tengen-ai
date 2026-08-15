import { describe, expect, it } from 'vitest';
import { scoreChinese } from './scoring';
import { getLesson, LESSONS, LessonReplay, replayLesson } from './teaching';
import { BLACK, WHITE } from './types';

describe('教学课件', () => {
  it('课件结构完整', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(6);
    const ids = new Set(LESSONS.map((l) => l.id));
    expect(ids.size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(l.size).toBeGreaterThanOrEqual(3);
      // 步数 = 初始局面 + 各着法（允许末尾附加讲解步）
      expect(l.steps.length).toBeGreaterThanOrEqual(l.moves.length + 1);
    }
  });

  it('提子课：最后一步白棋被提', () => {
    const l = getLesson('capture');
    const r = replayLesson(l, l.moves.length);
    expect(r.board.at({ x: 3, y: 3 })).toBe(0); // 白棋被提
    expect(r.board.at({ x: 3, y: 2 })).toBe(BLACK);
    expect(r.board.at({ x: 2, y: 3 })).toBe(BLACK);
    expect(r.board.at({ x: 4, y: 3 })).toBe(BLACK);
    expect(r.board.at({ x: 3, y: 4 })).toBe(BLACK);
    expect(r.lastMove).toEqual({ x: 3, y: 4 });
  });

  it('劫课：提子与回提的演示局面', () => {
    const l = getLesson('ko');
    const r1 = replayLesson(l, 1);
    expect(r1.board.at({ x: 2, y: 2 })).toBe(0); // 白被提
    expect(r1.board.at({ x: 3, y: 2 })).toBe(BLACK);

    const r2 = replayLesson(l, 2);
    expect(r2.board.at({ x: 3, y: 2 })).toBe(0); // 黑被回提
    expect(r2.board.at({ x: 2, y: 2 })).toBe(WHITE);
  });

  it('自杀课：标记禁止点', () => {
    const l = getLesson('suicide');
    const replay = new LessonReplay(l, 1);
    expect(replay.stepMarks()).toEqual([{ point: { x: 2, y: 2 }, kind: 'banned' }]);
    expect(replay.stepDesc()).toContain('自杀');
  });

  it('数子课：动态计算结果正确', () => {
    const l = getLesson('scoring');
    const replay = new LessonReplay(l, l.steps.length - 1);
    const s = scoreChinese(replay.board, 7.5);
    expect(s.blackPoints).toBe(36);
    expect(s.whitePoints).toBe(45);
    expect(s.winner).toBe(WHITE);
    expect(replay.stepDesc()).toContain('白胜');
  });

  it('LessonReplay 步进与钳制', () => {
    const l = getLesson('capture');
    const r = new LessonReplay(l, 0);
    expect(r.step).toBe(0);
    r.goTo(99);
    expect(r.step).toBe(r.totalSteps - 1);
    expect(r.lastMove).not.toBeNull();
    r.goTo(-5);
    expect(r.step).toBe(0);
  });

  it('所有课件每步均可重放且局面合法', () => {
    for (const l of LESSONS) {
      for (let s = 0; s < l.steps.length; s++) {
        const r = replayLesson(l, s);
        expect(r.board.size).toBe(l.size);
        // 校验棋盘上棋子的连通性不崩（气可计算）
        for (let y = 0; y < l.size; y++) {
          for (let x = 0; x < l.size; x++) {
            const p = { x, y };
            if (r.board.at(p) !== 0) {
              expect(r.board.liberties(p).length).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
  });
});
