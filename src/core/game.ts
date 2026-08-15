import { Board } from './board';
import { applyMove, forcePlay } from './rules';
import { scoreChinese, type ScoreReport } from './scoring';
import { BLACK, WHITE, otherColor, type Color, type Point } from './types';

export type GameMode = 'human-human' | 'human-ai' | 'lan';
export type GameStatus = 'playing' | 'ended';

export interface GameOptions {
  size: number;
  komi: number;
  mode: GameMode;
  /** human-ai 模式下人类执子颜色 */
  humanColor: Color;
}

export interface MoveRecord {
  color: Color;
  /** null = 提子（pass） */
  point: Point | null;
  captured: Point[];
  koPoint: Point | null;
  /** 落子后的局面指纹（提子不记录，局面未变） */
  signatureAfter: string | null;
}

export interface GamePlayResult {
  legal: boolean;
  reason?: 'occupied' | 'suicide' | 'superko' | 'ended' | 'review' | 'turn';
  captured: Point[];
  koPoint: Point | null;
}

/**
 * 对局状态机：负责对局进行、悔棋、打谱导航与分支。
 * 棋谱线路以 history[0..position) 表示；position < history.length 时处于打谱模式，
 * 此时落子会截断未来的棋谱（形成分支）。
 */
export class Game {
  readonly options: GameOptions;
  readonly board: Board;
  history: MoveRecord[] = [];
  /** 当前导航位置（打谱） */
  position = 0;
  /** 对局是否已终局（数子或认输） */
  ended = false;
  /** 终局数子结果（认输时为空） */
  score: ScoreReport | null = null;
  /** 认输方（认输时非空） */
  resignColor: Color | null = null;

  private lastMovePoint: Point | null = null;
  private consecutivePasses = 0;

  constructor(options: GameOptions) {
    this.options = { ...options };
    this.board = new Board(options.size);
  }

  /** 当前行棋方 */
  get currentColor(): Color {
    const last = this.history[this.position - 1];
    return last ? otherColor(last.color) : BLACK;
  }

  get moveNumber(): number {
    return this.position;
  }

  get lastMove(): Point | null {
    return this.lastMovePoint;
  }

  get isReviewing(): boolean {
    return this.position < this.history.length;
  }

  get status(): GameStatus {
    return this.ended && this.position === this.history.length ? 'ended' : 'playing';
  }

  /** 是否轮到 AI（或联机对手）行棋 */
  isAITurn(): boolean {
    if (this.options.mode === 'human-ai' || this.options.mode === 'lan') {
      return this.currentColor !== this.options.humanColor;
    }
    return false;
  }

  /** 当前行棋方执行一手（双人 / 人机 / AI 调用） */
  play(point: Point): GamePlayResult {
    return this.playAs(this.currentColor, point);
  }

  /** 以指定颜色执行一手（联机对弈：应用对方落子）；校验轮次与合法性 */
  playAs(color: Color, point: Point): GamePlayResult {
    if (this.status === 'ended') {
      return { legal: false, reason: 'ended', captured: [], koPoint: null };
    }
    if (color !== this.currentColor) {
      return { legal: false, reason: 'turn', captured: [], koPoint: null };
    }
    if (!this.board.inBounds(point) || !this.board.isEmpty(point)) {
      return { legal: false, reason: 'occupied', captured: [], koPoint: null };
    }
    // 打谱位置落子 → 截断未来棋谱（分支）
    if (this.isReviewing) this.truncate();

    const counts = this.buildCounts(this.position);
    const res = applyMove(this.board, point, color, counts);
    if (!res.legal) return res;

    this.pushMove({
      color,
      point,
      captured: res.captured,
      koPoint: res.koPoint,
      signatureAfter: this.board.signature(),
    });
    return { legal: true, captured: res.captured, koPoint: res.koPoint };
  }

  /** 提子（pass） */
  pass(): GamePlayResult {
    return this.passAs(this.currentColor);
  }

  /** 以指定颜色提子（联机对弈：应用对方提子） */
  passAs(color: Color): GamePlayResult {
    if (this.status === 'ended') {
      return { legal: false, reason: 'ended', captured: [], koPoint: null };
    }
    if (color !== this.currentColor) {
      return { legal: false, reason: 'turn', captured: [], koPoint: null };
    }
    if (this.isReviewing) this.truncate();
    this.pushMove({
      color,
      point: null,
      captured: [],
      koPoint: null,
      signatureAfter: null,
    });
    return { legal: true, captured: [], koPoint: null };
  }

  /** 认输 */
  resign(): void {
    if (this.status === 'ended') return;
    this.ended = true;
    this.resignColor = this.currentColor;
    this.score = null;
  }

  /** 双方提子或手动结束数子 */
  finish(): ScoreReport {
    if (this.status !== 'ended') {
      this.ended = true;
      this.resignColor = null;
    }
    this.score = scoreChinese(this.board, this.options.komi);
    return this.score;
  }

  /**
   * 悔棋：回到对局最新处。
   * - 双人模式：撤一步；
   * - 人机模式：撤到人类行棋前（通常撤两步：AI 一着 + 人类一着）。
   */
  undo(): boolean {
    if (this.history.length === 0) return false;
    if (this.isReviewing) return false;

    let target: number;
    if (this.options.mode === 'human-ai') {
      // 撤到人类上一次行棋前：即人类最后一手所在位置
      target = 0;
      for (let i = this.history.length - 1; i >= 0; i--) {
        if (this.history[i].color === this.options.humanColor) {
          target = i;
          break;
        }
      }
    } else {
      target = this.history.length - 1;
    }

    this.history.length = target;
    this.position = target;
    this.ended = false;
    this.resignColor = null;
    this.score = null;
    this.rebuildState();
    return true;
  }

  /** 打谱导航 */
  goTo(index: number): void {
    const target = Math.max(0, Math.min(this.history.length, index));
    this.position = target;
    this.rebuildState();
  }

  goToStart(): void {
    this.goTo(0);
  }

  goToEnd(): void {
    this.goTo(this.history.length);
  }

  stepBack(): void {
    this.goTo(this.position - 1);
  }

  stepForward(): void {
    this.goTo(this.position + 1);
  }

  /** 当前局面下所有合法落点（用于落点提示） */
  legalPoints(): Point[] {
    if (this.status === 'ended') return [];
    const counts = this.buildCounts(this.position);
    const out: Point[] = [];
    const probe = this.board.clone();
    for (let y = 0; y < this.board.size; y++) {
      for (let x = 0; x < this.board.size; x++) {
        const p = { x, y };
        if (!probe.isEmpty(p)) continue;
        const res = applyMove(probe, p, this.currentColor, counts);
        if (res.legal) out.push(p);
      }
    }
    return out;
  }

  /**
   * 指定颜色（或缺省双方）所有被打吃的棋串（只剩 1 气）。
   * 用于「打吃提示」教学功能。
   */
  atariGroups(color?: Color): { color: Color; group: Point[]; liberty: Point }[] {
    const targets: Color[] = color ? [color] : [BLACK, WHITE];
    const out: { color: Color; group: Point[]; liberty: Point }[] = [];
    const seen = new Set<number>();
    for (const target of targets) {
      for (let y = 0; y < this.board.size; y++) {
        for (let x = 0; x < this.board.size; x++) {
          const p = { x, y };
          const idx = this.board.index(p);
          if (seen.has(idx) || this.board.at(p) !== target) continue;
          const group = this.board.group(p);
          for (const g of group) seen.add(this.board.index(g));
          const libs = this.board.liberties(p);
          if (libs.length === 1) {
            out.push({ color: target, group, liberty: libs[0] });
          }
        }
      }
    }
    return out;
  }

  /** 查看某点所在棋串的信息（教学：点击棋子看气） */
  groupInfo(point: Point): { color: Color; group: Point[]; liberties: Point[] } | null {
    if (!this.board.inBounds(point)) return null;
    const c = this.board.at(point);
    if (c === 0) return null;
    return {
      color: c,
      group: this.board.group(point),
      liberties: this.board.liberties(point),
    };
  }

  // ---------- 内部 ----------

  private truncate(): void {
    this.history.length = this.position;
  }

  /** 当前线路中各局面的计数（含空盘），用于禁全同 */
  private buildCounts(to: number): Map<string, number> {
    const m = new Map<string, number>();
    const emptySig = new Board(this.options.size).signature();
    m.set(emptySig, 1);
    for (let i = 0; i < to; i++) {
      const rec = this.history[i];
      if (rec.signatureAfter) {
        m.set(rec.signatureAfter, (m.get(rec.signatureAfter) ?? 0) + 1);
      }
    }
    return m;
  }

  private pushMove(rec: MoveRecord): void {
    this.history.push(rec);
    this.position++;
    this.consecutivePasses = rec.point ? 0 : this.consecutivePasses + 1;
    this.lastMovePoint = rec.point;
    if (this.consecutivePasses >= 2) this.finish();
  }

  /** 按 history[0..position) 重建棋盘与状态 */
  private rebuildState(): void {
    for (let y = 0; y < this.board.size; y++) {
      for (let x = 0; x < this.board.size; x++) {
        this.board.set({ x, y }, 0);
      }
    }
    this.lastMovePoint = null;
    this.consecutivePasses = 0;
    for (let i = 0; i < this.position; i++) {
      const rec = this.history[i];
      if (rec.point) {
        forcePlay(this.board, rec.point, rec.color);
        this.lastMovePoint = rec.point;
        this.consecutivePasses = 0;
      } else {
        this.consecutivePasses++;
      }
    }
  }
}
