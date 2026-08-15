import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeuristicEngine } from '../core/ai/heuristic';
import { Game, type GameOptions } from '../core/game';
import { scoreChinese } from '../core/scoring';
import { parseSgf, toSgf } from '../core/sgf';
import { colorName, pointKey, type Point } from '../core/types';
import { Board, type SelectInfo } from './Board';
import { ActionsPanel, GameInfoPanel, ReviewPanel, SettingsPanel, SgfPanel, type GameResult } from './Panels';
import { DEFAULT_OPTIONS, loadSettings, saveSettings } from './storage';
import { TeachingView } from './TeachingView';
import { useIsMobile } from './useMediaQuery';

const REASON_TEXT: Record<string, string> = {
  occupied: '此处已有棋子',
  suicide: '自杀落子，禁止',
  superko: '禁全同：此局面已出现过',
  ended: '对局已结束',
};

export function App() {
  // 启动时读取本地持久化的设置
  const [initial] = useState(() => loadSettings());
  const [options, setOptions] = useState<GameOptions>(initial?.options ?? DEFAULT_OPTIONS);
  const [game, setGame] = useState<Game>(() => new Game(initial?.options ?? DEFAULT_OPTIONS));
  const [tick, setTick] = useState(0);
  const [view, setView] = useState<'play' | 'teach'>(initial?.view ?? 'play');
  const [showHints, setShowHints] = useState(initial?.showHints ?? false);
  const [markingDead, setMarkingDead] = useState(false);
  const [deadPoints, setDeadPoints] = useState<Set<string>>(new Set());
  const [aiThinking, setAiThinking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [engine] = useState(() => new HeuristicEngine());
  const fileRef = useRef<HTMLInputElement | null>(null);

  // 教学提示状态
  const [hint, setHint] = useState<{ point: Point | null; text: string } | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [showAtari, setShowAtari] = useState(initial?.showAtari ?? false);
  const [selInfo, setSelInfo] = useState<SelectInfo | null>(null);
  // 移动端：设置弹窗
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 设置变化时写入 localStorage（刷新/重启不丢失）
  useEffect(() => {
    saveSettings({ options, showHints, showAtari, view });
  }, [options, showHints, showAtari, view]);

  const rerender = useCallback(() => setTick((t) => t + 1), []);
  const flash = useCallback((msg: string) => setMessage(msg), []);

  // 消息自动消失
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2800);
    return () => window.clearTimeout(t);
  }, [message]);

  // 新对局（应用当前设置）
  const newGame = useCallback(() => {
    const g = new Game(options);
    setGame(g);
    setDeadPoints(new Set());
    setMarkingDead(false);
    setAiThinking(false);
    setHint(null);
    setSelInfo(null);
  }, [options]);

  // 设置变更：只改表单，点击「新对局」后生效
  const changeOptions = useCallback((patch: Partial<GameOptions>) => {
    setOptions((prev) => ({ ...prev, ...patch }));
  }, []);

  // 落子 / 标记死子
  const handlePlay = useCallback(
    (p: Point) => {
      if (game.status === 'ended') {
        if (markingDead) {
          setDeadPoints((prev) => {
            const next = new Set(prev);
            const k = pointKey(p);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
          });
        } else {
          flash('对局已结束，点击「新对局」再来一局');
        }
        return;
      }
      if (game.isAITurn()) return;
      const res = game.play(p);
      if (!res.legal) {
        flash(REASON_TEXT[res.reason ?? ''] ?? '此处不能落子');
        return;
      }
      setHint(null);
      setSelInfo(null);
      rerender();
    },
    [game, markingDead, rerender, flash],
  );

  const handlePass = useCallback(() => {
    if (game.status === 'ended' || game.isAITurn()) return;
    const res = game.pass();
    if (res.legal) {
      setHint(null);
      rerender();
    }
  }, [game, rerender]);

  const handleUndo = useCallback(() => {
    if (game.undo()) {
      setHint(null);
      setSelInfo(null);
      rerender();
    }
  }, [game, rerender]);

  const handleResign = useCallback(() => {
    if (game.status === 'ended' || game.isAITurn()) return;
    if (game.isReviewing) game.goToEnd();
    game.resign();
    rerender();
  }, [game, rerender]);

  const handleFinish = useCallback(() => {
    if (game.status === 'ended' || game.isAITurn()) return;
    if (game.isReviewing) game.goToEnd();
    game.finish();
    setMarkingDead(true);
    flash('对局结束：点击棋盘可标记死子，再次点击取消');
    rerender();
  }, [game, rerender, flash]);

  const handleNavigate = useCallback(
    (index: number) => {
      game.goTo(index);
      setHint(null);
      rerender();
    },
    [game, rerender],
  );

  // ---- AI 回合（异步） ----
  const isAITurn = game.isAITurn();
  useEffect(() => {
    if (!isAITurn || game.status === 'ended') return;
    let cancelled = false;
    setAiThinking(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const mv = await engine.suggest(game.board, game.currentColor, game.moveNumber);
          if (cancelled) return;
          if (mv.point) game.play(mv.point);
          else game.pass();
          setAiThinking(false);
          setHint(null);
          rerender();
        } catch (err) {
          if (!cancelled) {
            setAiThinking(false);
            flash('AI 出错：' + String(err));
          }
        }
      })();
    }, 420);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isAITurn, game, tick, engine, rerender, flash]);

  // ---- 教学提示：AI 建议 ----
  const handleHint = useCallback(() => {
    if (game.status === 'ended' || game.isAITurn() || hintLoading) return;
    setHintLoading(true);
    void (async () => {
      try {
        const mv = await engine.suggest(game.board, game.currentColor, game.moveNumber);
        setHintLoading(false);
        if (mv.point) {
          setHint({
            point: mv.point,
            text: `建议${colorName(game.currentColor)}下 ${String.fromCharCode(97 + mv.point.x)}${game.options.size - mv.point.y}：${mv.description ?? '扩张势力'}`,
          });
        } else {
          setHint({ point: mv.point, text: 'AI 认为当前无处可下，建议提子' });
        }
      } catch (err) {
        setHintLoading(false);
        flash('AI 建议失败：' + String(err));
      }
    })();
  }, [game, engine, hintLoading, flash]);

  // 打吃高亮点集合
  const atariPoints = useMemo(() => {
    if (!showAtari) return new Set<string>();
    const s = new Set<string>();
    for (const g of game.atariGroups()) {
      for (const p of g.group) s.add(pointKey(p));
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAtari, game, tick]);

  const handleSelect = useCallback((info: SelectInfo | null) => setSelInfo(info), []);

  // ---- SGF 导入/导出 ----
  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = parseSgf(text);
        const size = Math.min(25, Math.max(2, parsed.size || 19));
        const komi = parsed.komi ?? 7.5;
        const g = new Game({ size, komi, mode: options.mode, humanColor: options.humanColor });
        let applied = 0;
        for (let i = 0; i < parsed.moves.length; i++) {
          const m = parsed.moves[i];
          const res = m ? g.play(m) : g.pass();
          if (!res.legal) break;
          applied++;
        }
        setGame(g);
        setOptions(g.options);
        setDeadPoints(new Set());
        setMarkingDead(false);
        setAiThinking(false);
        setHint(null);
        flash(`棋谱已导入（${applied} 手${applied < parsed.moves.length ? '，后续着法不符合规则已跳过' : ''}）`);
      } catch (err) {
        flash('棋谱解析失败：' + String(err));
      }
    },
    [options, flash],
  );

  const handleExport = useCallback(() => {
    const moves = game.history.map((m) => m.point);
    const colors = game.history.map((m) => m.color);
    const sgf = toSgf({
      size: game.options.size,
      komi: game.options.komi,
      moves,
      colors,
      playerBlack: '黑棋',
      playerWhite: '白棋',
      gameName: `围棋对局 ${new Date().toLocaleString('zh-CN')}`,
    });
    const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `go-${game.options.size}-${Date.now()}.sgf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [game]);

  // ---- 终局结果（含死子标记后的重算） ----
  const result: GameResult | null = useMemo(() => {
    if (game.status !== 'ended') return null;
    if (game.resignColor) return { type: 'resign', color: game.resignColor };
    const deadList: Point[] = [...deadPoints].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });
    const score = scoreChinese(game.board, game.options.komi, deadList);
    return { type: 'score', score };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, tick, deadPoints]);

  const platform = typeof window !== 'undefined' ? window.goBoard : undefined;
  const statusLine = `${game.moveNumber > 0 ? `第 ${game.moveNumber} 手 · ` : ''}${game.isAITurn() ? 'AI 行棋' : game.status === 'ended' ? '对局结束' : game.isReviewing ? `打谱中（第 ${game.position}/${game.history.length} 手）` : '等待落子'}`;
  const selText = selInfo
    ? `${colorName(selInfo.color)}棋串 · ${selInfo.liberties.length} 气（绿点为气，气尽即被提）`
    : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1 className="brand-title">围棋</h1>
          <span className="brand-sub">GO · 弈</span>
        </div>
        <div className="header-center">
          <div className="view-tabs">
            <button
              type="button"
              className={`view-tab${view === 'play' ? ' active' : ''}`}
              onClick={() => setView('play')}
            >
              对局
            </button>
            <button
              type="button"
              className={`view-tab${view === 'teach' ? ' active' : ''}`}
              onClick={() => setView('teach')}
            >
              教学
            </button>
          </div>
        </div>
        <div className="header-right">
          {/* 移动端：设置按钮（右上角）；桌面端设置内联展示，无需此按钮 */}
          {view === 'play' && (
            <button
              type="button"
              className="header-settings only-mobile"
              onClick={() => setSettingsOpen(true)}
              aria-label="对局设置"
              title="对局设置"
            >
              ⚙
            </button>
          )}
          <span className="pill platform-pill">
            {platform ? `Electron ${platform.versions.electron}` : 'Web'}
          </span>
          <span className="pill">中国规则 · 数子法</span>
        </div>
      </header>

      <main className="app-main">
        {view === 'play' ? (
          <>
            <section className="board-area">
              <div className="board-frame">
                <Board
                  view={game}
                  tick={tick}
                  showHints={showHints}
                  markingDead={markingDead}
                  deadPoints={deadPoints}
                  hintMove={hint?.point ?? null}
                  atariPoints={atariPoints}
                  onPlay={handlePlay}
                  onSelect={handleSelect}
                />
              </div>
              <div className="board-status">
                <span className={`status-dot ${game.status === 'ended' ? 'ended' : ''}`} />
                {selText ?? statusLine}
              </div>
            </section>

            <aside className="side-panel">
              {/* 桌面端内联设置；移动端收进弹窗（见底部 modal） */}
              {!isMobile && <SettingsPanel options={options} onChange={changeOptions} />}
              <GameInfoPanel game={game} result={result} />
              <ActionsPanel
                game={game}
                aiThinking={aiThinking}
                showHints={showHints}
                markingDead={markingDead}
                hintLoading={hintLoading}
                hintText={hint?.text ?? null}
                showAtari={showAtari}
                onNewGame={newGame}
                onUndo={handleUndo}
                onPass={handlePass}
                onResign={handleResign}
                onFinish={handleFinish}
                onToggleHints={() => setShowHints((v) => !v)}
                onToggleMarking={() => setMarkingDead((v) => !v)}
                onHint={handleHint}
                onToggleAtari={() => setShowAtari((v) => !v)}
              />
              <ReviewPanel game={game} onNavigate={handleNavigate} />
              <SgfPanel onImport={() => fileRef.current?.click()} onExport={handleExport} />
              <footer className="app-footer">
                AI：{engine.name} · KataGo 接口已预留 · Web / Windows / macOS
              </footer>
            </aside>
          </>
        ) : (
          <TeachingView />
        )}
      </main>

      {/* 移动端：设置弹窗（底部抽屉） */}
      {isMobile && settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">对局设置</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSettingsOpen(false)}
                aria-label="关闭设置"
              >
                ✕
              </button>
            </div>
            <SettingsPanel options={options} onChange={changeOptions} />
            <button type="button" className="btn primary" onClick={() => setSettingsOpen(false)}>
              完成
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".sgf,text/plain"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImportFile(f);
          e.target.value = '';
        }}
      />

      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
