import { Board } from './board';
import { forcePlay } from './rules';
import { scoreChinese } from './scoring';
import { BLACK, WHITE, type BoardView, type Cell, type Color, type Point, type PointMark } from './types';

export type { PointMark };

export interface TeachingStep {
  title: string;
  /** 说明文字；可为函数，在展示时动态生成（如数子结果） */
  desc: string | ((board: Board, step: number) => string);
  mark?: PointMark | null;
}

export interface TeachingLesson {
  id: string;
  title: string;
  summary: string;
  size: number;
  /** 起始棋形（直接摆放，不走规则），行优先 rows[y][x] */
  start?: Cell[][];
  /** 演示着法；point 为 null 表示提子 */
  moves: { point: Point | null; color: Color }[];
  /** steps[i] 对应「应用 moves[0..i-1] 之后」的局面；steps[0] 即初始局面 */
  steps: TeachingStep[];
}

const X = BLACK;
const O = WHITE;

export const LESSONS: TeachingLesson[] = [
  {
    id: 'capture',
    title: '提子 · 气与吃子',
    summary: '把对方的「气」全部堵死，就能吃掉它',
    size: 7,
    moves: [
      { point: { x: 3, y: 3 }, color: O },
      { point: { x: 3, y: 2 }, color: X },
      { point: { x: 2, y: 3 }, color: X },
      { point: { x: 4, y: 3 }, color: X },
      { point: { x: 3, y: 4 }, color: X },
    ],
    steps: [
      { title: '空棋盘', desc: '这是 7 路棋盘，白棋先落子。' },
      { title: '白棋落子', desc: '白棋下天元 (3,3)。' },
      { title: '逼近', desc: '黑棋贴住白棋。白棋的「气」（相邻空点）还剩 3 个。' },
      { title: '再堵一气', desc: '黑棋从左侧逼近：白棋只剩 2 气了。' },
      { title: '打吃！', desc: '只剩 1 气了！这叫「打吃」（也叫叫吃）。下一手白棋不逃，就会被提掉。' },
      { title: '提子！', desc: '黑棋堵死最后一口气：白棋无气，被从棋盘上拿掉。吃子就是这么来的——把对方的气全部堵死。' },
    ],
  },
  {
    id: 'atari-escape',
    title: '打吃与逃跑',
    summary: '被打吃时，向外逃跑或反提是最佳应对',
    size: 9,
    moves: [
      { point: { x: 4, y: 4 }, color: O },
      { point: { x: 4, y: 3 }, color: X },
      { point: { x: 3, y: 4 }, color: X },
      { point: { x: 5, y: 4 }, color: X },
      { point: { x: 4, y: 5 }, color: O },
    ],
    steps: [
      { title: '空棋盘', desc: '这是 9 路棋盘，白棋先落子。' },
      { title: '白棋落子', desc: '白棋下 (4,4)。' },
      { title: '逼近', desc: '黑棋从下方逼近白棋。' },
      { title: '围堵', desc: '黑棋再从左侧围堵：白棋只剩 2 气了。' },
      { title: '打吃！', desc: '黑棋从右侧叫吃：白棋只剩 (4,5) 一口气，再不逃就被提。' },
      {
        title: '逃跑成功',
        desc: '白棋向外长出一手：棋串变长、气也变多，黑棋暂时吃不掉了。记住：被打吃时，「向外逃跑」或「反提对方」是最佳应对。',
      },
    ],
  },
  {
    id: 'ko',
    title: '劫争与禁全同',
    summary: '劫：来回提同一个子；禁全同：不能立刻回提',
    size: 5,
    start: [
      [0, 0, 0, 0, 0],
      [0, 0, X, O, 0],
      [0, X, O, 0, O],
      [0, 0, X, O, 0],
      [0, 0, 0, 0, 0],
    ],
    moves: [
      { point: { x: 3, y: 2 }, color: X },
      { point: { x: 2, y: 2 }, color: O },
      { point: { x: 0, y: 0 }, color: X },
      { point: { x: 0, y: 1 }, color: O },
      { point: { x: 3, y: 2 }, color: X },
    ],
    steps: [
      { title: '劫争前夜', desc: '白棋 (2,2) 只剩 (3,2) 一口气。黑棋若能提子，这手很有价值。' },
      { title: '提子！', desc: '黑棋下 (3,2)：提掉白棋 1 子。此时黑棋也只剩 (2,2) 一口气。' },
      { title: '白棋回提', desc: '白棋立刻下 (2,2) 回提，又把黑棋提了回来。双方来回提同一个子——这就是「劫」。' },
      {
        title: '禁全同！',
        desc: '黑棋现在不能马上回提 (3,2)：那会让局面与刚才完全重复，违反「禁全同」（全局同形再现禁止）规则。黑棋只能先去别处落子，这叫「找劫材」。',
      },
      { title: '黑棋找劫材', desc: '黑棋在 (0,0) 落子，制造新的威胁（劫材）。' },
      {
        title: '应劫与回提',
        desc: '白棋在 (0,1) 应劫。现在局面已与之前不同，黑棋回提 (3,2) 就完全合法了！劫争继续，双方轮流找劫材。',
      },
    ],
  },
  {
    id: 'suicide',
    title: '自杀规则',
    summary: '落子后无气且不能提子 = 自杀，禁止',
    size: 5,
    start: [
      [0, 0, 0, 0, 0],
      [0, O, O, O, 0],
      [0, O, 0, O, 0],
      [0, O, O, O, 0],
      [0, 0, 0, 0, 0],
    ],
    moves: [{ point: { x: 0, y: 0 }, color: X }],
    steps: [
      { title: '白棋的包围圈', desc: '白棋八子围住中心 (2,2)，黑棋看起来无处可下。' },
      {
        title: '自杀，禁止！',
        desc: '如果黑棋硬下 (2,2)：落子后黑棋无气，又提不掉白棋（白环还有外气）→ 这就是「自杀」，规则禁止。（此处仅演示说明，未真正落子）',
        mark: { point: { x: 2, y: 2 }, kind: 'banned' },
      },
      { title: '换个地方下', desc: '自杀只是禁止「无气而死」的着法，黑棋下别处完全合法，比如 (0,0)。' },
    ],
  },
  {
    id: 'capture-saves',
    title: '提子救命',
    summary: '能提子就不算自杀——这是规则的例外与精髓',
    size: 3,
    start: [
      [O, O, O],
      [O, 0, O],
      [O, O, O],
    ],
    moves: [{ point: { x: 1, y: 1 }, color: X }],
    steps: [
      {
        title: '没有外气的环',
        desc: '同样是白棋围住中心，但这次白棋的环「没有外气」——中心 (1,1) 是整环唯一的气。',
      },
      {
        title: '提子救命！',
        desc: '黑棋下中心：落子即提掉白棋 8 子，之后黑棋有气，不算自杀。规则的精髓：「能提子就不算自杀」。',
        mark: { point: { x: 1, y: 1 }, kind: 'highlight' },
      },
    ],
  },
  {
    id: 'scoring',
    title: '数子终局',
    summary: '中国规则：子 + 空 = 地盘，贴 7.5 目',
    size: 9,
    start: Array.from({ length: 9 }, () => [0, 0, 0, X, O, 0, 0, 0, 0]),
    moves: [
      { point: null, color: X },
      { point: null, color: O },
    ],
    steps: [
      { title: '终局局面', desc: '一局棋下到尾声：黑棋围住左边三列，白棋围住右边四列，中间再无争夺。' },
      { title: '黑棋提子', desc: '黑棋认为无利可图，选择「提子」（pass）。' },
      { title: '白棋提子', desc: '白棋也提子：双方连续提子，对局结束，开始数子。' },
      {
        title: '数子法计算',
        desc: (board) => {
          const s = scoreChinese(board, 7.5);
          const need = (board.size * board.size + 7.5) / 2;
          const winner = s.winner === 0 ? '和棋' : s.winner === X ? '黑胜' : '白胜';
          return (
            `数子法（中国规则）：黑 ${s.blackPoints} 子 = ${s.blackStones} 子 + ${s.blackTerritory} 空；` +
            `白 ${s.whitePoints} 子 = ${s.whiteStones} 子 + ${s.whiteTerritory} 空。` +
            `贴 7.5 目后黑需超过 ${need} 子 → 本局${winner} ${s.margin.toFixed(2)} 子。`
          );
        },
      },
    ],
  },
];

export function getLesson(id: string): TeachingLesson {
  const l = LESSONS.find((x) => x.id === id);
  if (!l) throw new Error(`未知课件: ${id}`);
  return l;
}

/** 按步重放课件：摆好起始棋形，再依次应用 moves[0..step-1] */
export function replayLesson(
  lesson: TeachingLesson,
  step: number,
): { board: Board; lastMove: Point | null } {
  const board = new Board(lesson.size);
  const start = lesson.start ?? [];
  for (let y = 0; y < lesson.size; y++) {
    for (let x = 0; x < lesson.size; x++) {
      const c = start[y]?.[x] ?? 0;
      if (c !== 0) board.set({ x, y }, c);
    }
  }
  let lastMove: Point | null = null;
  const count = Math.max(0, Math.min(lesson.moves.length, step));
  for (let i = 0; i < count; i++) {
    const m = lesson.moves[i];
    if (m.point) {
      forcePlay(board, m.point, m.color);
      lastMove = m.point;
    }
  }
  return { board, lastMove };
}

/** 教学重放视图：实现 BoardView 接口，供 Board 组件直接渲染 */
export class LessonReplay implements BoardView {
  board: Board;
  lastMove: Point | null;
  step: number;
  readonly lesson: TeachingLesson;

  constructor(lesson: TeachingLesson, step = 0) {
    this.lesson = lesson;
    this.step = Math.max(0, Math.min(lesson.steps.length - 1, step));
    const r = replayLesson(lesson, this.step);
    this.board = r.board;
    this.lastMove = r.lastMove;
  }

  get currentColor(): Color {
    return BLACK;
  }

  get moveNumber(): number {
    return this.step;
  }

  isAITurn(): boolean {
    return false;
  }

  get status(): 'playing' | 'ended' {
    return 'playing';
  }

  get isReviewing(): boolean {
    return false;
  }

  legalPoints(): Point[] {
    return [];
  }

  get totalSteps(): number {
    return this.lesson.steps.length;
  }

  stepTitle(): string {
    return this.lesson.steps[this.step].title;
  }

  stepDesc(): string {
    const s = this.lesson.steps[this.step];
    return typeof s.desc === 'function' ? s.desc(this.board, this.step) : s.desc;
  }

  stepMarks(): PointMark[] {
    const m = this.lesson.steps[this.step].mark;
    return m ? [m] : [];
  }

  goTo(step: number): void {
    this.step = Math.max(0, Math.min(this.lesson.steps.length - 1, step));
    const r = replayLesson(this.lesson, this.step);
    this.board = r.board;
    this.lastMove = r.lastMove;
  }
}
