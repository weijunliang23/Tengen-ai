import { BLACK, WHITE, type Color, type Point } from './types';

/** SGF 坐标字母表（跳过 'i'，19 路时 'a'..'s'） */
const COORDS = 'abcdefghjklmnopqrstuvwxyz';

export interface SgfGame {
  size: number;
  komi: number | null;
  playerBlack: string | null;
  playerWhite: string | null;
  gameName: string | null;
  /** 主变着法；null = 提子 */
  moves: (Point | null)[];
  /** 各手执子颜色，与 moves 等长 */
  colors: Color[];
}

export function pointToSgf(p: Point): string {
  return COORDS[p.x] + COORDS[p.y];
}

export function sgfToPoint(s: string): Point {
  return { x: COORDS.indexOf(s[0]), y: COORDS.indexOf(s[1]) };
}

interface SgfNodeData {
  props: Map<string, string[]>;
  children: SgfNodeData[][];
}

/**
 * 解析 SGF 文本，提取主变（第一个分支）的着法与元信息。
 * 支持常见的 B/W 落子、SZ/KM/PB/PW/GN 属性；AB/AW 等摆子属性忽略（主变解析）。
 */
export function parseSgf(text: string): SgfGame {
  const nodes = parseTree(text);
  const mainLine = mainLineNodes(nodes);

  const first = mainLine[0];
  const get = (key: string): string | null => {
    const v = first?.props.get(key);
    return v && v.length > 0 ? v[0] : null;
  };

  const sizeRaw = get('SZ');
  const size = sizeRaw ? parseInt(sizeRaw, 10) : 19;
  const komiRaw = get('KM');
  const komi = komiRaw !== null && komiRaw !== '' && !Number.isNaN(parseFloat(komiRaw)) ? parseFloat(komiRaw) : null;

  const moves: (Point | null)[] = [];
  const colors: Color[] = [];

  for (const node of mainLine) {
    const prop = node.props.has('B') ? 'B' : node.props.has('W') ? 'W' : null;
    if (!prop) continue;
    const value = node.props.get(prop)?.[0] ?? '';
    const color: Color = prop === 'B' ? BLACK : WHITE;
    if (value.length >= 2 && COORDS.includes(value[0]) && COORDS.includes(value[1])) {
      moves.push(sgfToPoint(value.slice(0, 2)));
    } else {
      moves.push(null); // 提子
    }
    colors.push(color);
  }

  return {
    size,
    komi,
    playerBlack: get('PB'),
    playerWhite: get('PW'),
    gameName: get('GN'),
    moves,
    colors,
  };
}

/** 序列化为主变棋谱（不含分支） */
export function toSgf(opts: {
  size: number;
  komi: number;
  moves: (Point | null)[];
  colors: Color[];
  playerBlack?: string;
  playerWhite?: string;
  gameName?: string;
}): string {
  const parts: string[] = [];
  parts.push(`(;GM[1]FF[4]CA[UTF-8]AP[go-board:0.1]SZ[${opts.size}]KM[${opts.komi}]RU[Chinese]`);
  if (opts.gameName) parts.push(`GN[${opts.gameName}]`);
  if (opts.playerBlack) parts.push(`PB[${opts.playerBlack}]`);
  if (opts.playerWhite) parts.push(`PW[${opts.playerWhite}]`);
  for (let i = 0; i < opts.moves.length; i++) {
    const m = opts.moves[i];
    const prop = opts.colors[i] === BLACK ? 'B' : 'W';
    parts.push(`;${prop}[${m ? pointToSgf(m) : ''}]`);
  }
  parts.push(')');
  return parts.join('');
}

// ---------- 解析器 ----------

function parseTree(text: string): SgfNodeData[] {
  let i = 0;
  const n = text.length;
  const skipWs = (): void => {
    while (i < n && /\s/.test(text[i])) i++;
  };

  const parseValue = (): string => {
    i++; // consume '['
    let out = '';
    while (i < n && text[i] !== ']') {
      if (text[i] === '\\' && i + 1 < n) {
        out += text[i + 1];
        i += 2;
      } else {
        out += text[i];
        i++;
      }
    }
    i++; // consume ']'
    return out;
  };

  const parseNode = (): SgfNodeData => {
    i++; // consume ';'
    const props = new Map<string, string[]>();
    skipWs();
    while (i < n && /[A-Z]/.test(text[i])) {
      let ident = '';
      while (i < n && /[A-Z]/.test(text[i])) {
        ident += text[i];
        i++;
      }
      const values: string[] = [];
      skipWs();
      while (i < n && text[i] === '[') values.push(parseValue());
      props.set(ident, values);
      skipWs();
    }
    return { props, children: [] };
  };

  const parseTreeInner = (): SgfNodeData[] => {
    i++; // consume '('
    const nodes: SgfNodeData[] = [];
    skipWs();
    while (i < n && text[i] !== ')') {
      if (text[i] === ';') {
        const node = parseNode();
        skipWs();
        while (i < n && text[i] === '(') {
          node.children.push(parseTreeInner());
        }
        nodes.push(node);
        skipWs();
      } else if (text[i] === '(') {
        nodes.push(...parseTreeInner());
      } else {
        i++;
      }
      skipWs();
    }
    if (i < n) i++; // consume ')'
    return nodes;
  };

  return parseTreeInner();
}

/** 沿第一个分支提取主变节点序列 */
function mainLineNodes(tree: SgfNodeData[]): SgfNodeData[] {
  const out: SgfNodeData[] = [];
  let seq = tree;
  for (;;) {
    if (seq.length === 0) break;
    for (const node of seq) out.push(node);
    const last = seq[seq.length - 1];
    if (last.children.length === 0) break;
    seq = last.children[0];
  }
  return out;
}
