import { Game, type GameOptions } from './game';
import { colorName, otherColor, type Color, type Point } from './types';
import type { NetMsg } from './network';

/** 联机状态 */
export type LanStatus = 'idle' | 'connecting' | 'waiting' | 'playing' | 'ended' | 'disconnected';

/** 传输层抽象：浏览器 WebSocket / Node ws / 测试回环均可实现 */
export interface NetTransport {
  send(msg: NetMsg): void;
  onMessage(cb: (msg: NetMsg) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

/**
 * 局域网对弈状态机：
 * - connect(transport, options) 发起连接（上报己方对局参数，主机参数作为对局标准）
 * - 配对成功后创建 Game（mode: 'lan'，humanColor = 己方颜色）
 * - 本地落子走 localPlay / localPass / localResign；对方着法经 onMessage 应用
 * - 再来一局：双方都同意后自动新开一局（同参数同执子）
 */
export class NetGame {
  game: Game | null = null;
  myColor: Color | null = null;
  status: LanStatus = 'idle';
  statusText = '';
  /** 本端是否已同意再来一局 */
  rematchSent = false;

  private transport: NetTransport | null = null;
  private oppRematch = false;
  onUpdate: () => void = () => {};

  get isMyTurn(): boolean {
    return this.game !== null && this.status === 'playing' && this.game.currentColor === this.myColor;
  }

  /** 已请求再来一局、等待对方同意 */
  get rematchWaiting(): boolean {
    return this.rematchSent && !this.oppRematch;
  }

  connect(transport: NetTransport, options: GameOptions): void {
    this.transport = transport;
    this.status = 'connecting';
    this.statusText = '连接服务器…';
    transport.onMessage((m) => this.handleMessage(m));
    transport.onClose(() => {
      if (this.status !== 'idle') {
        this.status = 'disconnected';
        this.statusText = '连接已断开';
        this.notify();
      }
    });
    transport.send({ type: 'hello', size: options.size, komi: options.komi });
    this.notify();
  }

  disconnect(): void {
    this.transport?.close();
    this.transport = null;
    this.game = null;
    this.myColor = null;
    this.status = 'idle';
    this.statusText = '';
    this.rematchSent = false;
    this.oppRematch = false;
    this.notify();
  }

  /** 本地落子 */
  localPlay(point: Point): boolean {
    if (!this.isMyTurn || !this.game) return false;
    const res = this.game.play(point);
    if (!res.legal) return false;
    this.transport?.send({ type: 'move', x: point.x, y: point.y });
    this.notify();
    return true;
  }

  localPass(): boolean {
    if (!this.isMyTurn || !this.game) return false;
    this.game.pass();
    this.transport?.send({ type: 'pass' });
    this.notify();
    return true;
  }

  localResign(): void {
    if (!this.game || this.status !== 'playing') return;
    this.game.resign();
    this.transport?.send({ type: 'resign' });
    this.status = 'ended';
    this.statusText = '你认输了';
    this.notify();
  }

  /** 请求再来一局 */
  requestRematch(): void {
    if (!this.game) return;
    this.rematchSent = true;
    this.transport?.send({ type: 'rematch', accept: true });
    this.tryRematch();
    this.notify();
  }

  private handleMessage(m: NetMsg): void {
    switch (m.type) {
      case 'paired': {
        const opts: GameOptions = {
          size: m.size,
          komi: m.komi,
          mode: 'lan',
          humanColor: m.color,
        };
        this.myColor = m.color;
        this.game = new Game(opts);
        this.status = 'playing';
        this.statusText = `对局开始：你执${colorName(m.color)}（${colorName(m.color)}先行）`;
        break;
      }
      case 'move': {
        if (!this.game || !this.myColor) break;
        this.game.playAs(otherColor(this.myColor), { x: m.x, y: m.y });
        break;
      }
      case 'pass': {
        if (!this.game || !this.myColor) break;
        this.game.passAs(otherColor(this.myColor));
        break;
      }
      case 'resign': {
        if (!this.game || !this.myColor) break;
        this.game.ended = true;
        this.game.resignColor = otherColor(this.myColor);
        this.game.score = null;
        this.status = 'ended';
        this.statusText = '对方认输，你赢了';
        break;
      }
      case 'rematch': {
        this.oppRematch = m.accept;
        this.tryRematch();
        break;
      }
      case 'opponent-left': {
        this.status = 'disconnected';
        this.statusText = m.reason || '对手已断开';
        break;
      }
      case 'error': {
        this.statusText = m.message || '发生错误';
        break;
      }
      default:
        break;
    }
    this.notify();
  }

  private tryRematch(): void {
    if (!this.game || !this.myColor) return;
    if (this.rematchSent && this.oppRematch) {
      // 双方同意：同参数、同执子新开一局
      this.game = new Game({
        size: this.game.options.size,
        komi: this.game.options.komi,
        mode: 'lan',
        humanColor: this.myColor,
      });
      this.status = 'playing';
      this.statusText = `再来一局：你执${colorName(this.myColor)}`;
      this.rematchSent = false;
      this.oppRematch = false;
    }
  }

  private notify(): void {
    this.onUpdate();
  }
}
