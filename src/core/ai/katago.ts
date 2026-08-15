import { Board } from '../board';
import { applyMove } from '../rules';
import { buildMoveReasons, type AnalysisResult, type MoveAnalysis, type MoveReason } from '../analysis';
import type { Color, Point } from '../types';
import type { GoEngine, Move, MoveSuggestion } from './engine';

/** KataGo 设置（渲染进程 → 主进程） */
export interface KatagoSettings {
  enginePath: string;
  weightsPath: string;
  visits: number;
}

/**
 * 渲染进程 → Electron 主进程的 KataGo 桥（由 preload 暴露；Web 端为 undefined）。
 * 主进程负责 spawn 引擎进程与 GTP 通信。
 */
export interface KatagoBridge {
  configure(opts: KatagoSettings): Promise<{ ok: boolean; error?: string; version?: string }>;
  close(): Promise<void>;
  setup(params: { size: number; komi: number }): Promise<{ ok: boolean; error?: string }>;
  play(
    params: { color: Color; x: number; y: number } | { color: Color; pass: true },
  ): Promise<{ ok: boolean; error?: string }>;
  genmove(params: { color: Color }): Promise<{ ok: boolean; error?: string; point: Point | null }>;
  analyze(params: {
    color: Color;
    moves?: number;
  }): Promise<{
    ok: boolean;
    error?: string;
    moves: { point: Point | null; winrate: number; scoreLead: number }[];
  }>;
  setVisits(visits: number): Promise<{ ok: boolean; error?: string }>;
}

/**
 * KataGo 引擎（渲染进程侧）：通过 KatagoBridge 与主进程通信。
 * - 每次 suggest/analyze 前回放完整棋谱（boardsize/komi/clear_board/play...），
 *   天然支持悔棋、打谱、分支等场景；
 * - 分析结果 = KataGo 胜率/目差 + 规则引擎的「人话理由」混合。
 */
export class KataGoEngine implements GoEngine {
  readonly name = 'KataGo';

  private ready = false;

  constructor(
    private bridge: KatagoBridge,
    private settings: KatagoSettings,
  ) {}

  /** 动态调整思考量（visits），已在运行则即时生效 */
  async setVisits(visits: number): Promise<void> {
    this.settings = { ...this.settings, visits };
    if (this.ready) {
      await this.bridge.setVisits(visits);
    }
  }

  private async ensureConfigured(): Promise<void> {
    if (this.ready) return;
    const r = await this.bridge.configure(this.settings);
    if (!r.ok) throw new Error(r.error ?? 'KataGo 引擎启动失败');
    this.ready = true;
  }

  /** 回放棋谱到指定局面（清盘 + 依序落子） */
  private async replay(board: Board, komi: number, history: Move[]): Promise<void> {
    await this.ensureConfigured();
    const s = await this.bridge.setup({ size: board.size, komi });
    if (!s.ok) throw new Error(s.error ?? 'KataGo 棋盘设置失败');
    for (const m of history) {
      const r = m.point
        ? await this.bridge.play({ color: m.color, x: m.point.x, y: m.point.y })
        : await this.bridge.play({ color: m.color, pass: true });
      if (!r.ok) throw new Error(r.error ?? 'KataGo 棋谱回放失败');
    }
  }

  async suggest(
    board: Board,
    color: Color,
    _moveCount: number,
    komi = 7.5,
    history: Move[] = [],
  ): Promise<MoveSuggestion> {
    await this.replay(board, komi, history);
    const g = await this.bridge.genmove({ color });
    if (!g.ok) throw new Error(g.error ?? 'KataGo 行棋失败');
    return {
      point: g.point,
      description: g.point
        ? `KataGo 推荐（${board.size} 路 · 思考量 ${this.settings.visits}）`
        : 'KataGo 建议提子',
    };
  }

  async analyze(
    board: Board,
    color: Color,
    komi: number,
    topN = 3,
    history: Move[] = [],
  ): Promise<AnalysisResult> {
    await this.replay(board, komi, history);
    const a = await this.bridge.analyze({ color, moves: Math.max(topN, 3) });
    if (!a.ok) throw new Error(a.error ?? 'KataGo 分析失败');

    const moves: MoveAnalysis[] = [];
    let bestWinrate = 0;
    let bestLead = 0;
    for (const m of a.moves) {
      if (!m.point) continue; // 提子候选不进入列表展示
      const reasons: MoveReason[] = [];
      const probe = board.clone();
      const res = applyMove(probe, m.point, color);
      if (res.legal) {
        reasons.push(...buildMoveReasons(board, color, m.point, res, probe, 0));
      }
      const leadText = m.scoreLead >= 0 ? `+${m.scoreLead.toFixed(1)}` : m.scoreLead.toFixed(1);
      reasons.push({ kind: 'winrate', text: `KataGo 胜率 ${(m.winrate * 100).toFixed(0)}%，目差 ${leadText}` });
      if (m.winrate > bestWinrate) {
        bestWinrate = m.winrate;
        bestLead = m.scoreLead;
      }
      moves.push({ point: m.point, score: m.winrate, reasons });
    }
    moves.sort((x, y) => y.score - x.score);

    const side = color === 1 ? '黑' : '白';
    const leadText = bestLead >= 0 ? `+${bestLead.toFixed(1)}` : bestLead.toFixed(1);
    const assessment = {
      report: {
        blackPoints: 0,
        whitePoints: 0,
        blackStones: 0,
        whiteStones: 0,
        blackTerritory: 0,
        whiteTerritory: 0,
        komi,
        winner: 0 as const,
        margin: 0,
        detail: 'KataGo 评估',
      },
      text: moves.length > 0
        ? `形势（KataGo）：执${side}胜率 ${(bestWinrate * 100).toFixed(0)}%，目差 ${leadText}`
        : '形势（KataGo）：暂无可分析着法',
    };

    return {
      moves: moves.slice(0, topN),
      assessment,
      suggested: moves[0]?.point ?? null,
    };
  }
}
