import { describe, expect, it } from 'vitest';
import { KataGoEngine, type KatagoBridge } from './katago';
import { Board } from '../board';
import { BLACK, WHITE } from '../types';

function fakeBridge(): { bridge: KatagoBridge; log: string[] } {
  const log: string[] = [];
  const bridge: KatagoBridge = {
    configure: async (opts) => {
      log.push(`configure:${opts.enginePath}`);
      return { ok: true, version: 'KataGo v1.15' };
    },
    close: async () => {
      log.push('close');
    },
    setup: async (p) => {
      log.push(`setup:${p.size}/${p.komi}`);
      return { ok: true };
    },
    play: async (p) => {
      log.push('pass' in p && p.pass ? 'play:pass' : `play:${(p as { x: number }).x},${(p as { y: number }).y}`);
      return { ok: true };
    },
    genmove: async () => {
      log.push('genmove');
      return { ok: true, point: { x: 3, y: 3 } };
    },
    analyze: async (p) => {
      log.push(`analyze:${p.moves}`);
      return {
        ok: true,
        moves: [
          { point: { x: 9, y: 9 }, winrate: 0.62, scoreLead: 2.4 },
          { point: { x: 3, y: 15 }, winrate: 0.6, scoreLead: 1.9 },
          { point: null, winrate: 0.5, scoreLead: 0 },
        ],
      };
    },
    setVisits: async (v) => {
      log.push(`visits:${v}`);
      return { ok: true };
    },
  };
  return { bridge, log };
}

describe('KataGoEngine（渲染进程桥）', () => {
  it('suggest 前回放棋谱并调用 genmove', async () => {
    const { bridge, log } = fakeBridge();
    const eng = new KataGoEngine(bridge, { enginePath: 'kata', weightsPath: 'w.bin', visits: 160 });
    const b = new Board(9);
    const mv = await eng.suggest(b, BLACK, 0, 7.5, [
      { point: { x: 4, y: 4 }, color: BLACK },
      { point: { x: 3, y: 3 }, color: WHITE },
    ]);
    expect(mv.point).toEqual({ x: 3, y: 3 });
    expect(log).toEqual(['configure:kata', 'setup:9/7.5', 'play:4,4', 'play:3,3', 'genmove']);
  });

  it('analyze 返回候选与胜率理由，忽略提子候选', async () => {
    const { bridge } = fakeBridge();
    const eng = new KataGoEngine(bridge, { enginePath: 'kata', weightsPath: 'w.bin', visits: 160 });
    const b = new Board(19);
    const res = await eng.analyze(b, BLACK, 7.5, 3, []);
    expect(res.moves.length).toBe(2);
    expect(res.moves[0].point).toEqual({ x: 9, y: 9 });
    expect(res.moves[0].reasons.some((r) => r.kind === 'winrate')).toBe(true);
    expect(res.moves[0].reasons.some((r) => r.text.includes('62%'))).toBe(true);
    expect(res.assessment.text).toContain('KataGo');
    expect(res.suggested).toEqual({ x: 9, y: 9 });
  });

  it('setVisits 在运行后即时生效', async () => {
    const { bridge, log } = fakeBridge();
    const eng = new KataGoEngine(bridge, { enginePath: 'kata', weightsPath: 'w.bin', visits: 160 });
    await eng.suggest(new Board(9), BLACK, 0, 7.5, []);
    await eng.setVisits(400);
    expect(log).toContain('visits:400');
  });
});
