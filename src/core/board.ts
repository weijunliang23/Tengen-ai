import type { Cell, Color, Point } from './types';

/**
 * 围棋棋盘：纯数据结构，不包含规则逻辑。
 * 采用一维 Uint8Array（行优先）存储，支持任意 2~25 路。
 */
export class Board {
  readonly size: number;
  private cells: Uint8Array;

  constructor(size: number) {
    if (!Number.isInteger(size) || size < 2 || size > 25) {
      throw new Error(`不支持的棋盘尺寸: ${size}`);
    }
    this.size = size;
    this.cells = new Uint8Array(size * size);
  }

  index(p: Point): number {
    return p.y * this.size + p.x;
  }

  inBounds(p: Point): boolean {
    return p.x >= 0 && p.x < this.size && p.y >= 0 && p.y < this.size;
  }

  at(p: Point): Cell {
    return this.cells[this.index(p)] as Cell;
  }

  set(p: Point, c: Cell): void {
    this.cells[this.index(p)] = c;
  }

  isEmpty(p: Point): boolean {
    return this.at(p) === 0;
  }

  /** 上下左右四个邻居 */
  neighbors(p: Point): Point[] {
    const { x, y } = p;
    const out: Point[] = [];
    if (x > 0) out.push({ x: x - 1, y });
    if (x < this.size - 1) out.push({ x: x + 1, y });
    if (y > 0) out.push({ x, y: y - 1 });
    if (y < this.size - 1) out.push({ x, y: y + 1 });
    return out;
  }

  forEach(fn: (p: Point, c: Cell) => void): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        fn({ x, y }, this.at({ x, y }));
      }
    }
  }

  /** p 所在同色棋串的所有点 */
  group(p: Point): Point[] {
    const color = this.at(p);
    if (color === 0) return [];
    const seen = new Set<number>([this.index(p)]);
    const stack: Point[] = [p];
    const out: Point[] = [p];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const n of this.neighbors(cur)) {
        const i = this.index(n);
        if (!seen.has(i) && this.at(n) === color) {
          seen.add(i);
          stack.push(n);
          out.push(n);
        }
      }
    }
    return out;
  }

  /** 棋串的气（相邻空点，去重） */
  liberties(p: Point): Point[] {
    const color = this.at(p);
    if (color === 0) return [];
    const seen = new Set<number>();
    const libs: Point[] = [];
    const visited = new Set<number>([this.index(p)]);
    const stack: Point[] = [p];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const n of this.neighbors(cur)) {
        const c = this.at(n);
        if (c === 0) {
          const i = this.index(n);
          if (!seen.has(i)) {
            seen.add(i);
            libs.push(n);
          }
        } else if (c === color && !visited.has(this.index(n))) {
          visited.add(this.index(n));
          stack.push(n);
        }
      }
    }
    return libs;
  }

  /** p 周围相邻的对方棋串（每串返回一个代表点） */
  adjacentOpponentGroups(p: Point, color: Color): Point[] {
    const reps: Point[] = [];
    const seen = new Set<number>();
    for (const n of this.neighbors(p)) {
      const c = this.at(n);
      if (c === 0 || c === color) continue;
      const g = this.group(n);
      for (const gp of g) seen.add(this.index(gp));
      reps.push(g[0]);
    }
    return reps;
  }

  /** 移除 p 所在棋串，返回被移除的点 */
  removeGroup(p: Point): Point[] {
    const g = this.group(p);
    for (const q of g) this.set(q, 0);
    return g;
  }

  clone(): Board {
    const b = new Board(this.size);
    b.cells.set(this.cells);
    return b;
  }

  equals(other: Board): boolean {
    if (this.size !== other.size) return false;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== other.cells[i]) return false;
    }
    return true;
  }

  /** 局面指纹（用于禁全同 superko 判断） */
  signature(): string {
    let out = '';
    for (let i = 0; i < this.cells.length; i++) out += this.cells[i].toString(36);
    return out;
  }
}
