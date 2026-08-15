import { Board } from './board';
import { scoreChinese, type ScoreReport } from './scoring';
import { BLACK, WHITE, colorName, type Color, type Point } from './types';

/** 走子理由的类型 */
export type ReasonKind =
  | 'capture' // 提子
  | 'atari' // 打吃
  | 'save' // 救活被打吃的己方棋
  | 'connect' // 与己方棋串连气
  | 'cut' // 分断对方
  | 'threat' // 落子后己方仍有棋可被提
  | 'danger' // 落子后己方只剩 1 气
  | 'big-point' // 空旷大场
  | 'expand'; // 扩张势力

export interface MoveReason {
  kind: ReasonKind;
  text: string;
}

export interface PositionAssessment {
  report: ScoreReport;
  /** 一句话形势判断 */
  text: string;
}

/** 数子法形势判断：粗略估计双方地盘（子+空），含贴目 */
export function assessPosition(board: Board, komi: number): PositionAssessment {
  const report = scoreChinese(board, komi);
  const lead =
    report.winner === 0
      ? '双方接近'
      : `${colorName(report.winner)}方领先（按数子法估算，约 ${Math.abs(report.margin).toFixed(1)} 子）`;
  return {
    report,
    text: `形势：黑约 ${report.blackPoints} 点（${report.blackStones} 子 + ${report.blackTerritory} 空），白约 ${report.whitePoints} 点（${report.whiteStones} 子 + ${report.whiteTerritory} 空），贴目 ${komi}，${lead}。`,
  };
}

/**
 * 为某一手棋生成结构化理由。
 * 调用方需先克隆棋盘并执行该手（probe 为落子后的棋盘，res 为其结果）。
 */
export function buildMoveReasons(
  board: Board,
  color: Color,
  point: Point,
  res: { legal: boolean; captured: Point[] },
  probe: Board,
  threatened: number,
): MoveReason[] {
  const reasons: MoveReason[] = [];
  const oppName = colorName(color === BLACK ? WHITE : BLACK);

  if (res.captured.length > 0) {
    reasons.push({
      kind: 'capture',
      text: `可提掉${oppName}棋 ${res.captured.length} 子`,
    });
  }

  const libs = probe.liberties(point).length;
  if (libs === 1 && res.captured.length === 0) {
    reasons.push({ kind: 'danger', text: '落子后己方只剩 1 气，非常危险' });
  }

  if (threatened > 0) {
    reasons.push({
      kind: 'threat',
      text: `落子后己方仍有 ${threatened} 子可被对方提掉`,
    });
  }

  // 打吃 / 救活 / 连接 / 分断
  let atariHit = false;
  let cut = 0;
  let savedAtari = false;
  const oppGroups = probe.adjacentOpponentGroups(point, color);
  for (const rep of oppGroups) {
    if (probe.liberties(rep).length === 1) {
      atariHit = true;
    }
    cut++;
  }
  if (res.captured.length === 0) {
    for (const n of board.neighbors(point)) {
      if (board.at(n) === color && board.liberties(n).length === 1) {
        savedAtari = true;
        break;
      }
    }
  }
  if (savedAtari && libs > 1) {
    reasons.push({ kind: 'save', text: '救活被打吃的己方棋串' });
  } else if (res.captured.length === 0) {
    const ownGroup = probe.group(point);
    if (ownGroup.length > 1) {
      reasons.push({ kind: 'connect', text: `与己方 ${ownGroup.length} 子连气，棋串更结实` });
    }
  }
  if (atariHit && res.captured.length === 0) {
    reasons.push({ kind: 'atari', text: `打吃${oppName}棋（只剩 1 气）` });
  }
  if (cut >= 2) {
    reasons.push({ kind: 'cut', text: `分断${oppName}棋 ${cut} 串的连接` });
  }

  // 默认：空旷大场 / 扩张
  if (reasons.length === 0 || reasons.every((r) => r.kind === 'danger' || r.kind === 'threat')) {
    const openCount = board.neighbors(point).filter((n) => board.isEmpty(n)).length;
    if (openCount >= 3) {
      reasons.push({ kind: 'big-point', text: '处于空旷地带，是发展势力的大场' });
    } else {
      reasons.push({ kind: 'expand', text: '扩张己方势力' });
    }
  }

  return reasons;
}
