import { spawn, type ChildProcess } from 'node:child_process';
import type { Color, Point } from '../src/core/types';
import {
  buildGenmoveCommand,
  buildKataAnalyzeCommand,
  buildPlayCommand,
  parseGtpResponse,
  parseKataAnalyze,
  pointFromGtpMove,
} from './katago-protocol';

export interface KatagoProcessOptions {
  enginePath: string;
  weightsPath: string;
  visits: number;
}

interface GtpReply {
  ok: boolean;
  lines: string[];
}

/** KataGo GTP 进程封装：串行命令队列 + 按空行分帧的响应读取 */
export class KataGoProcess {
  private proc: ChildProcess | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private buffer = '';
  private pending: ((r: GtpReply) => void) | null = null;
  private exited = false;
  private stderrTail = '';
  private spawnError = '';
  version = '';

  /** 进程是否在运行 */
  get running(): boolean {
    return !!this.proc && !this.exited;
  }

  constructor(private opts: KatagoProcessOptions) {}

  async start(): Promise<{ ok: boolean; error?: string }> {
    if (this.proc && !this.exited) return { ok: true };
    await this.stop();
    try {
      const proc = spawn(
        this.opts.enginePath,
        ['gtp', '-model', this.opts.weightsPath],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
      this.proc = proc;
      this.exited = false;
      this.spawnError = '';
      this.stderrTail = '';
      this.buffer = '';

      proc.stderr?.on('data', (d) => {
        this.stderrTail = (this.stderrTail + String(d)).slice(-2000);
      });
      proc.stdout?.on('data', (d) => this.onData(String(d)));
      proc.on('error', (e) => {
        this.spawnError = e.message;
        this.exited = true;
      });
      proc.on('exit', () => {
        this.exited = true;
        this.flushPending();
      });

      const nameReply = await this.withTimeout(this.command('name'), 20000);
      if (!nameReply) {
        await this.stop();
        return { ok: false, error: this.failText('KataGo 启动超时（检查引擎与权重路径）') };
      }
      if (!nameReply.ok || this.spawnError) {
        await this.stop();
        return { ok: false, error: this.failText(this.spawnError ? `无法启动 KataGo：${this.spawnError}` : 'KataGo 未响应') };
      }
      this.version = (nameReply.lines[0] || 'KataGo').trim();
      await this.command(`kata-set-param visits ${Math.max(1, this.opts.visits)}`);
      return { ok: true };
    } catch (err) {
      await this.stop();
      return { ok: false, error: String(err) };
    }
  }

  async stop(): Promise<void> {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    this.exited = true;
    this.flushPending();
  }

  async boardsize(size: number): Promise<GtpReply> {
    return this.command(`boardsize ${size}`);
  }

  async komi(value: number): Promise<GtpReply> {
    return this.command(`komi ${value}`);
  }

  async clearBoard(): Promise<GtpReply> {
    return this.command('clear_board');
  }

  async play(color: Color, point: Point | null, size: number): Promise<GtpReply> {
    return this.command(buildPlayCommand(color, point, size));
  }

  async genmove(color: Color, size: number): Promise<{ ok: boolean; point: Point | null; error?: string }> {
    const r = await this.command(buildGenmoveCommand(color));
    if (!r.ok) return { ok: false, point: null, error: r.lines[0] ?? 'genmove 失败' };
    return { ok: true, point: pointFromGtpMove(r.lines[0] ?? '', size) };
  }

  async analyze(color: Color, size: number, moves: number): Promise<{ ok: boolean; error?: string; moves: { point: Point | null; winrate: number; scoreLead: number }[] }> {
    const r = await this.command(buildKataAnalyzeCommand(moves, 1));
    if (!r.ok) return { ok: false, error: r.lines[0] ?? 'kata-analyze 失败', moves: [] };
    return { ok: true, moves: parseKataAnalyze(r.lines, size) };
  }

  async setVisits(visits: number): Promise<GtpReply> {
    return this.command(`kata-set-param visits ${Math.max(1, visits)}`);
  }

  // ---------- 内部 ----------

  private command(cmd: string): Promise<GtpReply> {
    const run = async (): Promise<GtpReply> => {
      if (!this.proc || this.exited) throw new Error('KataGo 进程未运行');
      return new Promise<GtpReply>((resolve) => {
        this.pending = resolve;
        this.proc!.stdin!.write(cmd + '\n');
      });
    };
    const p = this.queue.then(run, run);
    this.queue = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    for (;;) {
      const idx = this.buffer.indexOf('\n\n');
      if (idx < 0) break;
      const block = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      this.settle(block);
    }
    // 防卡死：无空行但内容过大时按单帧处理
    if (this.buffer.length > 1 << 16) {
      const block = this.buffer;
      this.buffer = '';
      this.settle(block);
    }
  }

  private settle(block: string): void {
    const parsed = parseGtpResponse(block);
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      p(parsed);
    }
  }

  private flushPending(): void {
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      p({ ok: false, lines: ['KataGo 进程已退出'] });
    }
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      p.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
      );
    });
  }

  private failText(fallback: string): string {
    const tail = this.stderrTail.trim().split(/\r?\n/).slice(-2).join('；');
    return tail ? `${fallback}：${tail}` : fallback;
  }
}
