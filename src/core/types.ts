/** 围棋基础类型定义 */

import type { Board } from './board';

/** 1 = 黑，2 = 白 */
export type Color = 1 | 2;
/** 0 = 空，1 = 黑，2 = 白 */
export type Cell = 0 | Color;

export const BLACK: Color = 1;
export const WHITE: Color = 2;

/** 棋盘坐标 */
export interface Point {
  x: number;
  y: number;
}

export const pointKey = (p: Point): string => `${p.x},${p.y}`;

export const otherColor = (c: Color): Color => (c === BLACK ? WHITE : BLACK);

export const colorName = (c: Color): string => (c === BLACK ? '黑' : '白');

/** 棋盘点标记：banned = 禁止落点（红 X），highlight = 高亮（朱红环） */
export interface PointMark {
  point: Point;
  kind: 'banned' | 'highlight';
}

/** Board 组件所需的只读视图接口（Game 与教学重放均实现） */
export interface BoardView {
  board: Board;
  lastMove: Point | null;
  currentColor: Color;
  moveNumber: number;
  isAITurn(): boolean;
  status: 'playing' | 'ended';
  isReviewing: boolean;
  legalPoints(): Point[];
}

/** 各尺寸棋盘的星位（天元 + 星） */
export function starPoints(size: number): Point[] {
  if (size === 19) {
    return [
      { x: 3, y: 3 }, { x: 9, y: 3 }, { x: 15, y: 3 },
      { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 15, y: 9 },
      { x: 3, y: 15 }, { x: 9, y: 15 }, { x: 15, y: 15 },
    ];
  }
  const edge = size >= 13 ? 3 : 2;
  const center = Math.floor(size / 2);
  const pts: Point[] = [
    { x: edge, y: edge }, { x: size - 1 - edge, y: edge },
    { x: edge, y: size - 1 - edge }, { x: size - 1 - edge, y: size - 1 - edge },
  ];
  // 奇数的中间行/列加天元
  if (size % 2 === 1) pts.push({ x: center, y: center });
  return pts;
}
