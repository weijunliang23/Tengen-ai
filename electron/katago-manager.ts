import type { Color, Point } from '../src/core/types';
import { KataGoProcess, type KatagoProcessOptions } from './katago';

/** KataGo 单例管理器：进程生命周期 + 当前棋盘参数 */
export class KataGoManager {
  private proc: KataGoProcess | null = null;
  private size = 19;

  async configure(opts: KatagoProcessOptions): Promise<{ ok: boolean; error?: string; version?: string }> {
    await this.close();
    const proc = new KataGoProcess(opts);
    this.proc = proc;
    const r = await proc.start();
    if (!r.ok) {
      this.proc = null;
      return { ok: false, error: r.error };
    }
    return { ok: true, version: proc.version };
  }

  async close(): Promise<void> {
    if (this.proc) {
      await this.proc.stop();
      this.proc = null;
    }
  }

  async setup(params: { size: number; komi: number }): Promise<{ ok: boolean; error?: string }> {
    const proc = this.requireProc();
    if (!proc) return { ok: false, error: 'KataGo 未启动，请先在设置中配置并启用' };
    this.size = params.size;
    for (const cmd of [
      () => proc.boardsize(params.size),
      () => proc.komi(params.komi),
      () => proc.clearBoard(),
    ]) {
      const r = await cmd();
      if (!r.ok) return { ok: false, error: r.lines[0] ?? 'KataGo 棋盘设置失败' };
    }
    return { ok: true };
  }

  async play(params: { color: Color; x: number; y: number } | { color: Color; pass: true }): Promise<{ ok: boolean; error?: string }> {
    const proc = this.requireProc();
    if (!proc) return { ok: false, error: 'KataGo 未启动' };
    const point = 'pass' in params && params.pass ? null : { x: (params as { x: number }).x, y: (params as { y: number }).y };
    const r = await proc.play(params.color, point, this.size);
    return r.ok ? { ok: true } : { ok: false, error: r.lines[0] ?? 'KataGo 落子失败' };
  }

  async genmove(color: Color): Promise<{ ok: boolean; error?: string; point: Point | null }> {
    const proc = this.requireProc();
    if (!proc) return { ok: false, error: 'KataGo 未启动', point: null };
    return proc.genmove(color, this.size);
  }

  async analyze(params: { color: Color; moves?: number }): Promise<{
    ok: boolean;
    error?: string;
    moves: { point: Point | null; winrate: number; scoreLead: number }[];
  }> {
    const proc = this.requireProc();
    if (!proc) return { ok: false, error: 'KataGo 未启动', moves: [] };
    return proc.analyze(params.color, this.size, params.moves ?? 3);
  }

  async setVisits(visits: number): Promise<{ ok: boolean; error?: string }> {
    const proc = this.requireProc();
    if (!proc) return { ok: false, error: 'KataGo 未启动' };
    const r = await proc.setVisits(visits);
    return r.ok ? { ok: true } : { ok: false, error: r.lines[0] ?? '设置思考量失败' };
  }

  private requireProc(): KataGoProcess | null {
    return this.proc?.running ? this.proc : null;
  }
}
