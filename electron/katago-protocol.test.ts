import { describe, expect, it } from 'vitest';
import {
  buildGenmoveCommand,
  buildKataAnalyzeCommand,
  buildPlayCommand,
  parseGtpResponse,
  parseKataAnalyze,
  pointFromGtpMove,
  pointFromVertex,
  vertexFromPoint,
} from './katago-protocol';
import { BLACK, WHITE } from '../src/core/types';

describe('KataGo GTP 协议', () => {
  it('坐标与顶点互转（19 路）', () => {
    expect(vertexFromPoint({ x: 0, y: 0 }, 19)).toBe('A19');
    expect(vertexFromPoint({ x: 18, y: 18 }, 19)).toBe('T1');
    expect(vertexFromPoint({ x: 9, y: 9 }, 19)).toBe('K10');
    expect(pointFromVertex('A19', 19)).toEqual({ x: 0, y: 0 });
    expect(pointFromVertex('t1', 19)).toEqual({ x: 18, y: 18 });
    expect(pointFromVertex('K10', 19)).toEqual({ x: 9, y: 9 });
    // 跳过 I：J = 8
    expect(pointFromVertex('J5', 19)).toEqual({ x: 8, y: 14 });
    // 非法
    expect(pointFromVertex('I3', 19)).toBeNull();
    expect(pointFromVertex('A99', 19)).toBeNull();
    expect(pointFromVertex('x1', 19)).toBeNull();
  });

  it('9 路与 13 路坐标', () => {
    expect(vertexFromPoint({ x: 4, y: 4 }, 9)).toBe('E5');
    expect(pointFromVertex('E5', 9)).toEqual({ x: 4, y: 4 });
    expect(pointFromVertex('N6', 13)).toEqual({ x: 12, y: 7 });
  });

  it('提子解析与 play/genmove 命令', () => {
    expect(pointFromGtpMove('D4', 19)).toEqual({ x: 3, y: 15 });
    expect(pointFromGtpMove('pass', 19)).toBeNull();
    expect(pointFromGtpMove('resign', 19)).toBeNull();
    expect(buildPlayCommand(BLACK, { x: 3, y: 15 }, 19)).toBe('play B D4');
    expect(buildPlayCommand(WHITE, null, 19)).toBe('play W pass');
    expect(buildGenmoveCommand(BLACK)).toBe('genmove B');
    expect(buildGenmoveCommand(WHITE)).toBe('genmove W');
    expect(buildKataAnalyzeCommand(10, 1)).toBe('kata-analyze 10 1');
  });

  it('kata-analyze 响应解析', () => {
    const sample = [
      'info move K10 visits 234 winrate 0.6213 scoreLead 2.4 pv K10 Q16 D4',
      'info move D4 visits 210 winrate 0.6011 scoreLead 1.9 pv D4 Q16 C4',
      'info move pass visits 12 winrate 0.52 scoreLead 0.5',
    ];
    const moves = parseKataAnalyze(sample, 19);
    expect(moves.length).toBe(3);
    expect(moves[0].point).toEqual({ x: 9, y: 9 });
    expect(moves[0].winrate).toBeCloseTo(0.6213, 4);
    expect(moves[0].scoreLead).toBeCloseTo(2.4, 4);
    expect(moves[2].point).toBeNull(); // pass
  });

  it('GTP 响应头解析', () => {
    expect(parseGtpResponse('= D4')).toEqual({ ok: true, lines: [] });
    expect(parseGtpResponse('? unknown command')).toEqual({ ok: false, lines: [] });
    const multi = '=\ninfo move K10 visits 1 winrate 0.5 scoreLead 0\n\n';
    const r = parseGtpResponse(multi);
    expect(r.ok).toBe(true);
    expect(r.lines.length).toBe(1);
    expect(parseKataAnalyze(r.lines, 19).length).toBe(1);
  });
});
