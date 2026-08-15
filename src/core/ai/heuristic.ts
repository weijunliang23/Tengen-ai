import { Board } from '../board';
import { applyMove } from '../rules';
import type { Color, Point } from '../types';
import { assessPosition, buildMoveReasons, type MoveReason, type PositionAssessment } from '../analysis';
import type { GoEngine, MoveSuggestion } from './engine';

export interface MoveAnalysis {
  point: Point;
  score: number;
  reasons: MoveReason[];
}

export interface AnalysisResult {
  /** 按评分从高到低的前 N 个候选着法 */
  moves: MoveAnalysis[];
  /** 形势判断 */
  assessment: PositionAssessment;
  /** 推荐着法（评分最高） */
  suggested: Point;
}

interface Candidate {
  point: Point;
  score: number;
  reasons: MoveReason[];
}

/** 落子后己方仍有棋串只剩 1 气（对手可提）的惩罚基数 */
const THREAT_PENALTY = 120;

/**
 * 启发式 AI（加强版）：
 * - 提子优先（按提子数加权）
 * - 一步防御：对每个候选着法检查「落子后己方是否仍有棋串只剩 1 气」，
 *   若会留下可被对手提掉的棋串（含未救活的），按棋串大小重罚——避免送吃
 * - 扩大己方气、不填自己的眼、救活被打吃的己方棋串
 * - 偏好 3、4 线（开局常用着点）
 * - 为每个候选生成结构化理由（提子/打吃/救活/连接/分断/大场/危险），
 *   供「智能提示」的 Top-3 候选分析与形势判断使用
 */
export class HeuristicEngine implements GoEngine {
  readonly name = '启发式 AI';

  constructor(private rng: () => number = Math.random) {}

  async suggest(board: Board, color: Color, _moveCount: number): Promise<MoveSuggestion> {
    const candidates = this.evaluate(board, color);
    if (candidates.length === 0) {
      return { point: null, description: '无处可下' };
    }
    const best = candidates.reduce((a, b) => (a.score > b.score ? a : b));
    return { point: best.point, description: best.reasons.map((r) => r.text).join('；') || undefined };
  }

  /** 智能分析：Top-N 候选着法 + 形势判断（供教学提示面板使用） */
  analyze(board: Board, color: Color, komi: number, topN = 3): AnalysisResult {
    const candidates = this.evaluate(board, color);
    if (candidates.length === 0) {
      throw new Error('当前局面无处可下');
    }
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    return {
      moves: sorted.slice(0, topN).map((c) => ({ point: c.point, score: c.score, reasons: c.reasons })),
      assessment: assessPosition(board, komi),
      suggested: sorted[0].point,
    };
  }

  private evaluate(board: Board, color: Color): Candidate[] {
    const out: Candidate[] = [];

    for (let y = 0; y < board.size; y++) {
      for (let x = 0; x < board.size; x++) {
        const p = { x, y };
        if (!board.isEmpty(p)) continue;

        // 不填自己的眼（单点眼：四邻均为己方）
        const neighbors = board.neighbors(p);
        const isOwnEye = neighbors.length > 0 && neighbors.every((n) => board.at(n) === color);
        if (isOwnEye) continue;

        // 在克隆棋盘上试下，得到提子数与落子后气
        const probe = board.clone();
        const res = applyMove(probe, p, color);
        if (!res.legal) continue;

        let score = 0;

        const cap = res.captured.length;
        if (cap > 0) score += cap * 150;

        const libs = probe.liberties(p).length;
        score += libs * 9;

        // 一步防御：落子后己方是否仍有棋串只剩 1 气（对手下一手可提）
        const threatened = this.countThreatenedGroups(probe, color);
        if (threatened > 0) score -= threatened * THREAT_PENALTY;

        // 打吃对方棋串（只剩一气）
        for (const rep of probe.adjacentOpponentGroups(p, color)) {
          if (probe.liberties(rep).length === 1) {
            score += 12;
            break;
          }
        }

        // 救活己方被打吃的棋串 / 与己方棋串连气
        if (cap === 0) {
          const ownAfter = probe.group(p);
          const ownLibsAfter = probe.liberties(ownAfter[0]).length;
          let savedAtari = false;
          for (const n of board.neighbors(p)) {
            if (board.at(n) === color && board.liberties(n).length === 1) {
              savedAtari = true;
              break;
            }
          }
          if (savedAtari && ownLibsAfter > 1) {
            score += 45;
          } else if (ownAfter.length > 1) {
            score += Math.min(ownAfter.length, 10);
          }
        }

        // 边线偏好：3、4 线最佳
        const d = Math.min(x + 1, y + 1, board.size - x, board.size - y);
        const ideal = board.size >= 13 ? 3.5 : 2;
        score -= Math.abs(d - ideal) * 2;

        score += this.rng() * 4;

        const reasons = buildMoveReasons(board, color, p, res, probe, threatened);
        out.push({ point: p, score, reasons });
      }
    }
    return out;
  }

  /** 统计 color 方所有只剩 1 气的棋串的棋子总数 */
  private countThreatenedGroups(board: Board, color: Color): number {
    let total = 0;
    const seen = new Set<number>();
    for (let y = 0; y < board.size; y++) {
      for (let x = 0; x < board.size; x++) {
        const p = { x, y };
        const idx = board.index(p);
        if (seen.has(idx) || board.at(p) !== color) continue;
        const group = board.group(p);
        for (const g of group) seen.add(board.index(g));
        if (board.liberties(p).length === 1) total += group.length;
      }
    }
    return total;
  }
}
