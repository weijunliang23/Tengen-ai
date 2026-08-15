import { useEffect, useRef, useState } from 'react';
import type { BoardView, Color, Point, PointMark } from '../core/types';
import { BLACK, WHITE, pointKey, starPoints } from '../core/types';

const COLS = 'abcdefghjklmnopqrstuvwxyz';

export interface SelectInfo {
  point: Point;
  color: Color;
  group: Point[];
  liberties: Point[];
}

interface BoardProps {
  view: BoardView;
  tick: number;
  /** 教学模式等只读场景传 false */
  interactive?: boolean;
  showHints?: boolean;
  markingDead?: boolean;
  deadPoints?: ReadonlySet<string>;
  /** AI 建议落点（教学提示） */
  hintMove?: Point | null;
  /** 被打吃棋串的点集合（打吃提示） */
  atariPoints?: ReadonlySet<string>;
  /** 教学标记 */
  marks?: PointMark[];
  onPlay?: (p: Point) => void;
  onSelect?: (info: SelectInfo | null) => void;
}

/** 画一枚棋子（含阴影、高光、透明度与缩放动画） */
function drawStone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: Color,
  scale = 1,
  alpha = 1,
): void {
  const rr = r * scale;
  ctx.save();
  ctx.globalAlpha = alpha;

  // 投影
  ctx.beginPath();
  ctx.arc(cx + r * 0.06, cy + r * 0.1, rr * 0.98, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fill();

  // 棋身：左上高光的径向渐变
  const grad = ctx.createRadialGradient(cx - rr * 0.38, cy - rr * 0.42, rr * 0.12, cx, cy, rr * 1.06);
  if (color === BLACK) {
    grad.addColorStop(0, '#6a6a6a');
    grad.addColorStop(0.45, '#2b2b2b');
    grad.addColorStop(1, '#0b0b0b');
  } else {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.62, '#f4f1e9');
    grad.addColorStop(1, '#c6bfb2');
  }
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  if (color === WHITE) {
    ctx.strokeStyle = 'rgba(70, 55, 35, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

/** 死子标记 / 禁止落点（红色 X） */
function drawCross(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, strong = false): void {
  ctx.save();
  ctx.strokeStyle = strong ? 'rgba(200, 69, 46, 0.95)' : 'rgba(200, 69, 46, 0.75)';
  ctx.lineWidth = strong ? 2.6 : 2;
  ctx.lineCap = 'round';
  const d = r * 0.45;
  ctx.beginPath();
  ctx.moveTo(cx - d, cy - d);
  ctx.lineTo(cx + d, cy + d);
  ctx.moveTo(cx + d, cy - d);
  ctx.lineTo(cx - d, cy + d);
  ctx.stroke();
  ctx.restore();
}

/** 高亮环（教学 highlight / AI 建议） */
function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  width = 2.5,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function Board({
  view,
  tick,
  interactive = true,
  showHints = false,
  markingDead = false,
  deadPoints,
  hintMove,
  atariPoints,
  marks,
  onPlay,
  onSelect,
}: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [sel, setSel] = useState<Point | null>(null);
  const lastMoveAtRef = useRef<number>(0);
  const prevMovesRef = useRef<number>(view.moveNumber);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const board = view.board;
  const size = board.size;
  const CELL = 42;
  const MARGIN = Math.round(CELL * 1.5);
  const canvasSize = MARGIN * 2 + (size - 1) * CELL;
  const gx = (x: number) => MARGIN + x * CELL;
  const gy = (y: number) => MARGIN + y * CELL;

  const draw = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const now = performance.now();
    const animElapsed = now - lastMoveAtRef.current;
    const animating = animElapsed < 260;

    // ---- 木纹底色 ----
    const wood = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
    wood.addColorStop(0, '#e8c080');
    wood.addColorStop(0.55, '#dbaa63');
    wood.addColorStop(1, '#c3904e');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.strokeStyle = '#7a4f1f';
    ctx.lineWidth = 1;
    for (let i = -canvasSize; i < canvasSize * 2; i += 9) {
      ctx.beginPath();
      ctx.moveTo(i + 4, 0);
      ctx.lineTo(i - 30, canvasSize);
      ctx.stroke();
    }
    ctx.restore();

    // 边缘暗角
    const vignette = ctx.createRadialGradient(
      canvasSize / 2, canvasSize / 2, canvasSize * 0.2,
      canvasSize / 2, canvasSize / 2, canvasSize * 0.78,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(60, 35, 10, 0.22)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // 外框
    ctx.strokeStyle = 'rgba(52, 33, 14, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(MARGIN - 7, MARGIN - 7, (size - 1) * CELL + 14, (size - 1) * CELL + 14);

    // 网格
    ctx.strokeStyle = 'rgba(45, 28, 12, 0.8)';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < size; i++) {
      ctx.beginPath();
      ctx.moveTo(gx(i), gy(0));
      ctx.lineTo(gx(i), gy(size - 1));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx(0), gy(i));
      ctx.lineTo(gx(size - 1), gy(i));
      ctx.stroke();
    }

    // 星位
    ctx.fillStyle = 'rgba(45, 28, 12, 0.95)';
    for (const s of starPoints(size)) {
      ctx.beginPath();
      ctx.arc(gx(s.x), gy(s.y), CELL * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    // 坐标标签
    ctx.fillStyle = 'rgba(70, 45, 20, 0.72)';
    ctx.font = `600 ${Math.round(CELL * 0.32)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < size; i++) {
      ctx.fillText(COLS[i], gx(i), MARGIN - CELL * 0.55);
      ctx.fillText(String(size - i), MARGIN - CELL * 0.55, gy(i));
    }

    // 可落点提示
    if (showHints && interactive && view.status === 'playing' && !view.isAITurn()) {
      const hints = view.legalPoints();
      ctx.save();
      ctx.fillStyle = view.currentColor === BLACK ? 'rgba(25, 25, 25, 0.45)' : 'rgba(248, 248, 245, 0.55)';
      for (const h of hints) {
        ctx.beginPath();
        ctx.arc(gx(h.x), gy(h.y), CELL * 0.085, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 棋子
    board.forEach((p, c) => {
      if (c === 0) return;
      let scale = 1;
      if (animating && view.lastMove && p.x === view.lastMove.x && p.y === view.lastMove.y) {
        const t = Math.min(1, animElapsed / 220);
        scale = 0.5 + 0.5 * (1 - Math.pow(1 - t, 3)); // easeOutCubic 落子
      }
      drawStone(ctx, gx(p.x), gy(p.y), CELL * 0.46, c, scale);
      if (deadPoints?.has(pointKey(p))) drawCross(ctx, gx(p.x), gy(p.y), CELL * 0.46);
    });

    // 最后一手：朱红标记 + 呼吸环
    const last = view.lastMove;
    if (last) {
      const lx = gx(last.x);
      const ly = gy(last.y);
      if (animating) {
        const pulse = 1 - animElapsed / 260;
        ctx.save();
        ctx.strokeStyle = `rgba(200, 69, 46, ${0.55 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lx, ly, CELL * 0.46 * (1.1 + (1 - pulse) * 0.5), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.fillStyle = '#c8452e';
      ctx.beginPath();
      ctx.arc(lx, ly, CELL * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 打吃高亮：红环圈住被打吃的棋串
    if (atariPoints && atariPoints.size > 0) {
      for (const key of atariPoints) {
        const [x, y] = key.split(',').map(Number);
        drawRing(ctx, gx(x), gy(y), CELL * 0.5, 'rgba(200, 69, 46, 0.85)', 2.2);
      }
    }

    // 选中的棋串：高亮 + 气点
    if (sel && interactive) {
      const c = board.at(sel);
      if (c !== 0) {
        const group = board.group(sel);
        ctx.save();
        ctx.fillStyle = c === BLACK ? 'rgba(20, 20, 20, 0.22)' : 'rgba(255, 255, 255, 0.35)';
        for (const g of group) {
          ctx.beginPath();
          ctx.arc(gx(g.x), gy(g.y), CELL * 0.46, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        const libs = board.liberties(sel);
        ctx.save();
        ctx.fillStyle = 'rgba(72, 148, 72, 0.95)';
        for (const l of libs) {
          ctx.beginPath();
          ctx.arc(gx(l.x), gy(l.y), CELL * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // AI 建议落点：幽灵子 + 双环
    if (hintMove && interactive && board.isEmpty(hintMove)) {
      drawStone(ctx, gx(hintMove.x), gy(hintMove.y), CELL * 0.46, view.currentColor, 1, 0.42);
      drawRing(ctx, gx(hintMove.x), gy(hintMove.y), CELL * 0.56, 'rgba(96, 175, 90, 0.95)', 2.5);
      drawRing(ctx, gx(hintMove.x), gy(hintMove.y), CELL * 0.68, 'rgba(96, 175, 90, 0.5)', 1.5);
    }

    // 教学标记
    if (marks) {
      for (const m of marks) {
        if (m.kind === 'banned') {
          drawCross(ctx, gx(m.point.x), gy(m.point.y), CELL * 0.5, true);
        } else {
          drawRing(ctx, gx(m.point.x), gy(m.point.y), CELL * 0.55, 'rgba(232, 122, 75, 0.95)', 2.6);
          drawRing(ctx, gx(m.point.x), gy(m.point.y), CELL * 0.7, 'rgba(232, 122, 75, 0.5)', 1.5);
        }
      }
    }

    // 悬停
    if (hover && interactive) {
      if (board.isEmpty(hover) && view.status === 'playing' && !view.isAITurn()) {
        drawStone(ctx, gx(hover.x), gy(hover.y), CELL * 0.46, view.currentColor, 1, 0.4);
      } else if (markingDead && view.status === 'ended' && !board.isEmpty(hover)) {
        drawCross(ctx, gx(hover.x), gy(hover.y), CELL * 0.46, true);
      }
    }
  };

  // 落子动画触发
  useEffect(() => {
    if (view.moveNumber !== prevMovesRef.current) {
      prevMovesRef.current = view.moveNumber;
      lastMoveAtRef.current = performance.now();
    }
  }, [view.moveNumber]);

  // 局面变化时清除选中
  useEffect(() => {
    setSel(null);
    onSelectRef.current?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, board.signature()]);

  // 绘制主循环（含落子动画帧）
  useEffect(() => {
    let raf = 0;
    const render = () => {
      draw();
      if (performance.now() - lastMoveAtRef.current < 260) {
        raf = requestAnimationFrame(render);
      }
    };
    render();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tick, hover, showHints, markingDead, deadPoints, hintMove, atariPoints, marks, sel, size]);

  const toPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const k = canvasSize / rect.width;
    const mx = (e.clientX - rect.left) * k;
    const my = (e.clientY - rect.top) * k;
    const x = Math.round((mx - MARGIN) / CELL);
    const y = Math.round((my - MARGIN) / CELL);
    if (x < 0 || x >= size || y < 0 || y >= size) return null;
    if (Math.abs(mx - gx(x)) > CELL * 0.45 || Math.abs(my - gy(y)) > CELL * 0.45) return null;
    return { x, y };
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!interactive) return;
    const p = toPoint(e);
    if (!p) return;
    // 终局标记死子：交回 App 处理
    if (markingDead && view.status === 'ended') {
      onPlay?.(p);
      return;
    }
    const c = board.at(p);
    if (c === 0) {
      setSel(null);
      onSelectRef.current?.(null);
      onPlay?.(p);
    } else if (sel && sel.x === p.x && sel.y === p.y) {
      setSel(null);
      onSelectRef.current?.(null);
    } else {
      setSel(p);
      onSelectRef.current?.({
        point: p,
        color: c,
        group: board.group(p),
        liberties: board.liberties(p),
      });
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="board-canvas"
      width={canvasSize}
      height={canvasSize}
      style={{ width: '100%', height: 'auto', aspectRatio: `${canvasSize} / ${canvasSize}` }}
      onMouseMove={interactive ? (e) => setHover(toPoint(e)) : undefined}
      onMouseLeave={interactive ? () => setHover(null) : undefined}
      onClick={interactive ? handleClick : undefined}
    />
  );
}
