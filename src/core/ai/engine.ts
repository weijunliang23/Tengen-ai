import type { Board } from '../board';
import type { Color, Point } from '../types';

export interface MoveSuggestion {
  /** null = 提子（pass） */
  point: Point | null;
  description?: string;
}

/**
 * 围棋引擎统一接口。
 * 启发式 AI 与 KataGo 均实现此接口，UI 层不关心具体引擎。
 */
export interface GoEngine {
  readonly name: string;
  /** 建议一手棋；moveCount 为当前手数（可作开局启发） */
  suggest(board: Board, color: Color, moveCount: number): Promise<MoveSuggestion>;
}
