import { BLACK, WHITE, type Color } from '../core/types';
import type { GameMode, GameOptions } from '../core/game';
import type { KatagoSettings } from '../core/ai/katago';

export const SETTINGS_KEY = 'tengen.settings.v1';

export interface PersistedSettings {
  options: GameOptions;
  showHints: boolean;
  showAtari: boolean;
  view: 'play' | 'teach';
  /** KataGo 配置（桌面端） */
  katago: KatagoSettings & { enabled: boolean };
}

export const DEFAULT_OPTIONS: GameOptions = {
  size: 19,
  komi: 7.5,
  mode: 'human-human',
  humanColor: BLACK,
};

export const DEFAULT_KATAGO: KatagoSettings & { enabled: boolean } = {
  enabled: false,
  enginePath: '',
  weightsPath: '',
  visits: 160,
};

const MODES: GameMode[] = ['human-human', 'human-ai', 'lan'];

/** 校验并规整从存储读出的设置，避免损坏数据导致应用崩溃 */
export function normalizeSettings(raw: unknown): PersistedSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<PersistedSettings>;
  const o = r.options;
  if (!o || typeof o !== 'object') return null;

  const size = Number.isInteger(o.size) && o.size! >= 2 && o.size! <= 25 ? (o.size as number) : 19;
  const komi = typeof o.komi === 'number' && Number.isFinite(o.komi) ? o.komi : 7.5;
  const mode: GameMode = MODES.includes(o.mode as GameMode) ? (o.mode as GameMode) : 'human-human';
  const humanColor: Color = o.humanColor === WHITE ? WHITE : BLACK;

  const k = r.katago;
  const visitsRaw = k?.visits;
  const visitsOk = typeof visitsRaw === 'number' && Number.isFinite(visitsRaw) && visitsRaw > 0;
  const katago: PersistedSettings['katago'] = {
    enabled: k?.enabled === true,
    enginePath: typeof k?.enginePath === 'string' ? k.enginePath : '',
    weightsPath: typeof k?.weightsPath === 'string' ? k.weightsPath : '',
    visits: visitsOk ? (visitsRaw as number) : 160,
  };

  return {
    options: { size, komi, mode, humanColor },
    showHints: r.showHints === true,
    showAtari: r.showAtari === true,
    view: r.view === 'teach' ? 'teach' : 'play',
    katago,
  };
}

/** 从 localStorage 读取设置（浏览器环境；Node/测试环境返回 null） */
export function loadSettings(): PersistedSettings | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 保存设置到 localStorage（失败静默，不影响使用） */
export function saveSettings(s: PersistedSettings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 存储不可用时静默忽略 */
  }
}
