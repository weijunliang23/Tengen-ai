import { describe, expect, it } from 'vitest';
import {
  loadSettings,
  normalizeSettings,
  saveSettings,
  SETTINGS_KEY,
  type PersistedSettings,
} from './storage';
import { BLACK, WHITE } from '../core/types';

/** Node 环境无 localStorage，注入一个内存版 */
function installMockStorage() {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  return store;
}

describe('设置持久化', () => {
  it('normalize：合法输入原样返回', () => {
    const s = normalizeSettings({
      options: { size: 13, komi: 6.5, mode: 'human-ai', humanColor: WHITE },
      showHints: true,
      showAtari: false,
      view: 'play',
    });
    expect(s).toEqual({
      options: { size: 13, komi: 6.5, mode: 'human-ai', humanColor: WHITE },
      showHints: true,
      showAtari: false,
      view: 'play',
    });
  });

  it('normalize：非法输入回退到默认值', () => {
    const s = normalizeSettings({
      options: { size: 999, komi: 'x', mode: 'weird', humanColor: 7 },
      showHints: 'yes',
      view: 'hack',
    });
    expect(s).toEqual({
      options: { size: 19, komi: 7.5, mode: 'human-human', humanColor: BLACK },
      showHints: false,
      showAtari: false,
      view: 'play',
    });
  });

  it('normalize：null / 非对象返回 null', () => {
    expect(normalizeSettings(null)).toBeNull();
    expect(normalizeSettings('abc')).toBeNull();
    expect(normalizeSettings({})).toBeNull();
  });

  it('save → load 往返一致', () => {
    installMockStorage();
    const settings: PersistedSettings = {
      options: { size: 9, komi: 7.5, mode: 'human-ai', humanColor: BLACK },
      showHints: true,
      showAtari: true,
      view: 'teach',
    };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it('存储损坏时 load 返回 null 而非抛错', () => {
    const store = installMockStorage();
    store.set(SETTINGS_KEY, '{broken json');
    expect(loadSettings()).toBeNull();
  });
});
