import type { Board } from '../board';
import type { Color, Point } from '../types';
import type { AnalysisResult } from '../analysis';

export interface MoveSuggestion {
  /** null = 提子（pass） */
  point: Point | null;
  description?: string;
}

/** 一手棋（用于向引擎回放历史） */
export interface Move {
  point: Point | null; // null = 提子
  color: Color;
}

/**
 * 围棋引擎统一接口。
 * 启发式 AI 与 KataGo 均实现此接口，UI 层不关心具体引擎。
 */
export interface GoEngine {
  readonly name: string;
  /**
   * 建议一手棋。
   * @param komi 贴目（KataGo 需要）；规则引擎忽略
   * @param history 到当前局面为止的着法历史（KataGo 需要回放）
   */
  suggest(
    board: Board,
    color: Color,
    moveCount: number,
    komi?: number,
    history?: Move[],
  ): Promise<MoveSuggestion>;
  /** 智能分析：Top-N 候选着法 + 形势判断 */
  analyze(
    board: Board,
    color: Color,
    komi: number,
    topN?: number,
    history?: Move[],
  ): Promise<AnalysisResult>;
}
