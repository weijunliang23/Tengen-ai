import { Board } from './board';
import { BLACK, WHITE, type Color, type Point } from './types';

export interface ScoreReport {
  blackStones: number;
  whiteStones: number;
  blackTerritory: number;
  whiteTerritory: number;
  /** 数子法得分 = 子 + 空 */
  blackPoints: number;
  whitePoints: number;
  komi: number;
  /** 胜方：BLACK / WHITE / 0（和棋） */
  winner: Color | 0;
  /** 黑方领先（或落后）的子数，含贴目换算 */
  margin: number;
  detail: string;
}

/**
 * 中国规则数子法：
 * - 子空皆地：地盘 = 己方棋子数 + 己方围住的空点
 * - 贴 7.5 目（换算成子）：黑方得分需超过 (N² + 贴目) / 2
 * - 死子由调用方通过 dead 参数标记（UI 终局标记死子），标记后按被提处理
 */
export function scoreChinese(board: Board, komi: number, dead: Point[] = []): ScoreReport {
  const b = board.clone();
  for (const p of dead) {
    if (b.inBounds(p)) b.set(p, 0);
  }

  let blackStones = 0;
  let whiteStones = 0;
  let blackTerritory = 0;
  let whiteTerritory = 0;

  b.forEach((_p, c) => {
    if (c === BLACK) blackStones++;
    else if (c === WHITE) whiteStones++;
  });

  // 空区域灌水：只与一种颜色相邻 → 该色领地
  const visited = new Set<number>();
  for (let y = 0; y < b.size; y++) {
    for (let x = 0; x < b.size; x++) {
      const p = { x, y };
      if (!b.isEmpty(p) || visited.has(b.index(p))) continue;

      const stack: Point[] = [p];
      visited.add(b.index(p));
      let regionSize = 0;
      let blackEdge = false;
      let whiteEdge = false;

      while (stack.length > 0) {
        const cur = stack.pop()!;
        regionSize++;
        for (const n of b.neighbors(cur)) {
          const c = b.at(n);
          if (c === 0) {
            if (!visited.has(b.index(n))) {
              visited.add(b.index(n));
              stack.push(n);
            }
          } else if (c === BLACK) {
            blackEdge = true;
          } else {
            whiteEdge = true;
          }
        }
      }

      if (blackEdge && !whiteEdge) blackTerritory += regionSize;
      else if (whiteEdge && !blackEdge) whiteTerritory += regionSize;
    }
  }

  const blackPoints = blackStones + blackTerritory;
  const whitePoints = whiteStones + whiteTerritory;
  const total = b.size * b.size;
  const blackNeeds = (total + komi) / 2;

  const winner: Color | 0 = blackPoints > blackNeeds ? BLACK : blackPoints === blackNeeds ? 0 : WHITE;
  const margin = Math.abs(blackPoints - blackNeeds);

  const detail =
    `黑 ${blackPoints} 子（${blackStones} 子 + ${blackTerritory} 空） ` +
    `白 ${whitePoints} 子（${whiteStones} 子 + ${whiteTerritory} 空）`;

  return {
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    blackPoints,
    whitePoints,
    komi,
    winner,
    margin,
    detail,
  };
}

/** 数子法胜子数换算：黑方得分超出部分即胜子数（含贴目） */
export function marginInStones(report: ScoreReport): number {
  return report.margin;
}
