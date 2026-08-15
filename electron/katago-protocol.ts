/**
 * KataGo GTP 协议：纯字符串构造与解析（不依赖 Node API，可单测）。
 * 坐标约定：内部 (x, y) 左上原点；GTP 为 列字母(A..T 跳过 I) + 行号(自下而上 1 起)。
 */
import type { Color, Point } from '../src/core/types';

/** GTP 列字母（跳过 I），支持最大 25 路 */
export const GTP_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

export function vertexFromPoint(p: Point, size: number): string {
  return `${GTP_LETTERS[p.x] ?? '?'}${size - p.y}`;
}

export function pointFromVertex(vertex: string, size: number): Point | null {
  const m = /^([A-Za-z])(\d+)$/.exec(vertex.trim());
  if (!m) return null;
  const x = GTP_LETTERS.indexOf(m[1].toUpperCase());
  if (x < 0 || x >= size) return null;
  const row = Number(m[2]);
  if (!Number.isInteger(row) || row < 1 || row > size) return null;
  return { x, y: size - row };
}

/** 'pass' / 'resign' → null，否则解析为坐标 */
export function pointFromGtpMove(text: string, size: number): Point | null {
  const t = text.trim().toLowerCase();
  if (t === 'pass' || t === 'resign') return null;
  return pointFromVertex(t, size);
}

export function buildPlayCommand(color: Color, point: Point | null, size: number): string {
  const stone = color === 1 ? 'B' : 'W';
  return point ? `play ${stone} ${vertexFromPoint(point, size)}` : `play ${stone} pass`;
}

export function buildGenmoveCommand(color: Color): string {
  return `genmove ${color === 1 ? 'B' : 'W'}`;
}

export function buildKataAnalyzeCommand(moves: number, interval = 1): string {
  return `kata-analyze ${Math.max(1, moves)} ${Math.max(1, interval)}`;
}

export interface KataAnalyzeMove {
  point: Point | null;
  winrate: number;
  scoreLead: number;
}

/** 解析 kata-analyze 的多行响应（每行以 info 开头） */
export function parseKataAnalyze(lines: string[], size: number): KataAnalyzeMove[] {
  const out: KataAnalyzeMove[] = [];
  for (const line of lines) {
    const m = /^info\s+move\s+(\S+).*?\bwinrate\s+([-+0-9.eE]+).*?\bscoreLead\s+([-+0-9.eE]+)/.exec(line);
    if (!m) continue;
    const winrate = Number.parseFloat(m[2]);
    const scoreLead = Number.parseFloat(m[3]);
    if (!Number.isFinite(winrate) || !Number.isFinite(scoreLead)) continue;
    out.push({ point: pointFromGtpMove(m[1], size), winrate, scoreLead });
  }
  return out;
}

/**
 * 解析一次 GTP 交互的原始响应：
 * 成功 = 以 '=' 开头；失败 = 以 '?' 开头。
 * 返回 ok 与响应体（多行时为各行文本数组，供 kata-analyze 使用）。
 */
export function parseGtpResponse(raw: string): { ok: boolean; lines: string[] } {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { ok: false, lines: [] };
  const head = lines[0];
  if (head.startsWith('=')) {
    return { ok: true, lines: lines.slice(1) };
  }
  return { ok: false, lines: lines.slice(1) };
}
