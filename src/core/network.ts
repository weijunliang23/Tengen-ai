import { BLACK, WHITE, type Color } from './types';

/**
 * 联机对弈协议（WebSocket + JSON）。
 * 消息按类型定义，客户端与服务端共用；服务端只做配对与转发，规则校验在双方客户端各自进行。
 */

export type NetMsg =
  | { type: 'hello'; size: number; komi: number } // 连接时上报（主机的 size/komi 作为对局参数）
  | { type: 'paired'; color: Color; size: number; komi: number } // 配对成功，分配执子颜色与对局参数
  | { type: 'move'; x: number; y: number } // 落子
  | { type: 'pass' } // 提子
  | { type: 'resign' } // 认输
  | { type: 'rematch'; accept: boolean } // 再来一局（双方都同意则新开一局）
  | { type: 'opponent-left'; reason: string } // 对手断开
  | { type: 'error'; message: string }; // 错误提示

export function encodeMsg(msg: NetMsg): string {
  return JSON.stringify(msg);
}

/** 解析并校验消息，非法消息返回 null */
export function decodeMsg(raw: string): NetMsg | null {
  try {
    const m = JSON.parse(raw) as NetMsg;
    if (!m || typeof m !== 'object' || typeof m.type !== 'string') return null;
    switch (m.type) {
      case 'hello':
        if (typeof m.size !== 'number' || typeof m.komi !== 'number') return null;
        return m;
      case 'paired':
        if ((m.color !== BLACK && m.color !== WHITE) || typeof m.size !== 'number' || typeof m.komi !== 'number') {
          return null;
        }
        return m;
      case 'move':
        if (!Number.isInteger(m.x) || !Number.isInteger(m.y) || m.x < 0 || m.y < 0 || m.x > 25 || m.y > 25) {
          return null;
        }
        return m;
      case 'pass':
      case 'resign':
        return m;
      case 'rematch':
        if (typeof m.accept !== 'boolean') return null;
        return m;
      case 'opponent-left':
      case 'error':
        return m;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
