import { Board } from './board';
import { otherColor, type Color, type Point } from './types';

export type IllegalReason = 'occupied' | 'suicide' | 'superko' | 'ended';

export interface MoveResult {
  legal: boolean;
  reason?: IllegalReason;
  /** 被提掉的子 */
  captured: Point[];
  /** 恰好提掉一子时，该子位置（即劫争点） */
  koPoint: Point | null;
}

/**
 * 在棋盘上执行一手（会修改 board）。
 *
 * 规则：
 * 1. 落点必须为空；
 * 2. 落子后先提掉无气的对方棋串；
 * 3. 若己方棋串仍无气 → 自杀，非法；
 * 4. 禁全同（superko）：落子后的局面不得与当前棋谱线路中任何历史局面相同。
 *
 * @param positionCounts 当前棋谱线路各局面的计数（signature -> count）。
 *                       传入 null 则跳过禁全同检查（如 AI 评估、历史重放）。
 */
export function applyMove(
  board: Board,
  point: Point,
  color: Color,
  positionCounts?: Map<string, number> | null,
): MoveResult {
  if (!board.inBounds(point) || !board.isEmpty(point)) {
    return { legal: false, reason: 'occupied', captured: [], koPoint: null };
  }

  board.set(point, color);
  const captured = simulateCapture(board, point, color);

  // 自杀检查
  if (board.liberties(point).length === 0) {
    undoPlacement(board, point, color, captured);
    return { legal: false, reason: 'suicide', captured: [], koPoint: null };
  }

  const koPoint = captured.length === 1 ? captured[0] : null;

  if (positionCounts) {
    const sig = board.signature();
    if ((positionCounts.get(sig) ?? 0) > 0) {
      undoPlacement(board, point, color, captured);
      return { legal: false, reason: 'superko', captured: [], koPoint: null };
    }
  }

  return { legal: true, captured, koPoint };
}

/** 落子已放置的前提下，提掉无气的对方棋串 */
export function simulateCapture(board: Board, point: Point, color: Color): Point[] {
  const captured: Point[] = [];
  for (const rep of board.adjacentOpponentGroups(point, color)) {
    if (board.liberties(rep).length === 0) {
      captured.push(...board.removeGroup(rep));
    }
  }
  return captured;
}

/** 回滚一次落子（用于非法判定后恢复棋盘） */
function undoPlacement(board: Board, point: Point, color: Color, captured: Point[]): void {
  board.set(point, 0);
  const capturedColor = otherColor(color);
  for (const c of captured) board.set(c, capturedColor);
}

/**
 * 强制落子（不做合法性检查，用于按历史重放局面）。
 * 调用方须保证该手在历史上是合法的。
 */
export function forcePlay(board: Board, point: Point, color: Color): void {
  board.set(point, color);
  simulateCapture(board, point, color);
}
