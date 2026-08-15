import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { BLACK, WHITE } from './types';

const opts = (partial: Partial<Game['options']> = {}) => ({
  size: 9,
  komi: 7.5,
  mode: 'human-human' as const,
  humanColor: BLACK,
  ...partial,
});

describe('对局状态机', () => {
  it('黑先白后，交替行棋', () => {
    const g = new Game(opts());
    expect(g.currentColor).toBe(BLACK);
    expect(g.play({ x: 4, y: 4 }).legal).toBe(true);
    expect(g.currentColor).toBe(WHITE);
    expect(g.play({ x: 3, y: 3 }).legal).toBe(true);
    expect(g.currentColor).toBe(BLACK);
  });

  it('双提子自动终局并数子', () => {
    const g = new Game(opts());
    g.play({ x: 4, y: 4 });
    g.pass();
    expect(g.status).toBe('playing');
    g.pass();
    expect(g.status).toBe('ended');
    expect(g.score).not.toBeNull();
    expect(g.play({ x: 3, y: 3 }).legal).toBe(false);
    expect(g.play({ x: 3, y: 3 }).reason).toBe('ended');
  });

  it('悔棋（双人撤一步）并可重新落子', () => {
    const g = new Game(opts());
    g.play({ x: 4, y: 4 });
    g.play({ x: 3, y: 3 });
    expect(g.history.length).toBe(2);
    expect(g.undo()).toBe(true);
    expect(g.history.length).toBe(1);
    expect(g.currentColor).toBe(WHITE);
    expect(g.board.at({ x: 3, y: 3 })).toBe(0);
  });

  it('人机模式悔棋回到人类行棋前', () => {
    const g = new Game(opts({ mode: 'human-ai', humanColor: BLACK }));
    g.play({ x: 4, y: 4 }); // 人（黑）
    g.play({ x: 3, y: 3 }); // AI（白）
    g.play({ x: 4, y: 5 }); // 人（黑）
    g.play({ x: 3, y: 4 }); // AI（白）
    expect(g.history.length).toBe(4);
    expect(g.undo()).toBe(true);
    expect(g.history.length).toBe(2); // 撤掉 AI+人 各一手
    expect(g.currentColor).toBe(BLACK);
  });

  it('打谱导航与分支', () => {
    const g = new Game(opts());
    g.play({ x: 4, y: 4 });
    g.play({ x: 3, y: 3 });
    g.play({ x: 5, y: 5 });
    expect(g.history.length).toBe(3);

    g.goTo(1);
    expect(g.isReviewing).toBe(true);
    expect(g.moveNumber).toBe(1);
    expect(g.board.at({ x: 4, y: 4 })).toBe(BLACK);
    expect(g.board.at({ x: 3, y: 3 })).toBe(0);

    // 从打谱位置落子 → 截断未来
    g.play({ x: 6, y: 6 });
    expect(g.history.length).toBe(2);
    expect(g.isReviewing).toBe(false);
    expect(g.currentColor).toBe(BLACK); // 白落子后轮到黑
  });

  it('认输', () => {
    const g = new Game(opts());
    g.play({ x: 4, y: 4 });
    g.resign();
    expect(g.status).toBe('ended');
    expect(g.resignColor).toBe(WHITE);
    expect(g.score).toBeNull();
  });

  it('合法落点提示', () => {
    const g = new Game(opts());
    g.play({ x: 0, y: 0 });
    g.play({ x: 1, y: 0 });
    const pts = g.legalPoints();
    expect(pts).toContainEqual({ x: 0, y: 1 });
    expect(pts).not.toContainEqual({ x: 0, y: 0 });
    expect(pts).not.toContainEqual({ x: 1, y: 0 });
  });

  it('悔棋后终局状态解除', () => {
    const g = new Game(opts());
    g.play({ x: 4, y: 4 });
    g.pass();
    g.pass();
    expect(g.status).toBe('ended');
    expect(g.undo()).toBe(true);
    expect(g.status).toBe('playing');
  });
});
