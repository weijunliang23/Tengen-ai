import { describe, expect, it } from 'vitest';
import { decodeMsg, encodeMsg, type NetMsg } from './network';

describe('联机协议编解码', () => {
  it('各消息类型 roundtrip', () => {
    const msgs: NetMsg[] = [
      { type: 'hello', size: 9, komi: 7.5 },
      { type: 'paired', color: 1, size: 13, komi: 6.5 },
      { type: 'move', x: 3, y: 3 },
      { type: 'pass' },
      { type: 'resign' },
      { type: 'rematch', accept: true },
      { type: 'opponent-left', reason: '对手已断开' },
      { type: 'error', message: '测试' },
    ];
    for (const m of msgs) {
      expect(decodeMsg(encodeMsg(m))).toEqual(m);
    }
  });

  it('非法消息返回 null', () => {
    expect(decodeMsg('not json')).toBeNull();
    expect(decodeMsg('{}')).toBeNull();
    expect(decodeMsg('{"type":"unknown"}')).toBeNull();
    expect(decodeMsg('{"type":"move","x":-1,"y":0}')).toBeNull();
    expect(decodeMsg('{"type":"move","x":99,"y":99}')).toBeNull();
    expect(decodeMsg('{"type":"rematch","accept":"yes"}')).toBeNull();
    expect(decodeMsg('{"type":"paired","color":5,"size":9,"komi":7.5}')).toBeNull();
  });
});
