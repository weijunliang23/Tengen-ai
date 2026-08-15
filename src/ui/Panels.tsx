import { useState } from 'react';
import { BLACK, WHITE, colorName, type Color, type Point } from '../core/types';
import type { Game, GameMode, GameOptions } from '../core/game';
import type { ScoreReport } from '../core/scoring';
import type { AnalysisResult } from '../core/ai/heuristic';
import type { ReasonKind } from '../core/analysis';

export type GameResult = { type: 'resign'; color: Color } | { type: 'score'; score: ScoreReport };

/** 理由类型 → 图标 */
const REASON_ICON: Record<ReasonKind, string> = {
  capture: '⚔',
  atari: '⚠',
  save: '❤',
  connect: '🔗',
  cut: '✂',
  threat: '⚠',
  danger: '✗',
  'big-point': '★',
  expand: '↗',
  winrate: '📈',
};

function CardTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <h2 className="card-title">
      <span className="card-icon">{icon}</span>
      {title}
    </h2>
  );
}

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}

function Segmented<T extends string | number>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          className={`seg-btn${o.v === value ? ' active' : ''}`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- 设置 ----------

export function SettingsPanel({
  options,
  onChange,
  katago,
  katagoAvailable,
  onKatagoChange,
  onTestKatago,
}: {
  options: GameOptions;
  onChange: (patch: Partial<GameOptions>) => void;
  katago: KatagoSettingsUI;
  katagoAvailable: boolean;
  onKatagoChange: (patch: Partial<KatagoSettingsUI>) => void;
  onTestKatago: () => Promise<string>;
}) {
  const [testState, setTestState] = useState<'idle' | 'busy'>('idle');
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTest = async () => {
    if (testState === 'busy') return;
    setTestState('busy');
    setTestResult(null);
    const r = await onTestKatago();
    setTestResult(r);
    setTestState('idle');
  };

  return (
    <section className="card">
      <CardTitle icon="设" title="对局设置" />
      <div className="field">
        <span className="field-label">模式</span>
        <Segmented<GameMode>
          value={options.mode}
          options={[
            { v: 'human-human', label: '双人对弈' },
            { v: 'human-ai', label: '人机对弈' },
            { v: 'lan', label: '联机对弈' },
          ]}
          onChange={(v) => onChange({ mode: v })}
        />
      </div>
      {options.mode === 'human-ai' && (
        <div className="field">
          <span className="field-label">执子</span>
          <Segmented<Color>
            value={options.humanColor}
            options={[
              { v: BLACK, label: '执黑先手' },
              { v: WHITE, label: '执白后手' },
            ]}
            onChange={(v) => onChange({ humanColor: v })}
          />
        </div>
      )}
      {options.mode === 'lan' && (
        <p className="card-note">联机对弈：在一台设备运行 <code>npm run server</code>，两台设备分别连接后自动配对（先连执黑）。对局参数以先连一方为准。</p>
      )}
      <div className="field">
        <span className="field-label">棋盘</span>
        <Segmented<number>
          value={options.size}
          options={[
            { v: 9, label: '9 路' },
            { v: 13, label: '13 路' },
            { v: 19, label: '19 路' },
          ]}
          onChange={(v) => onChange({ size: v })}
        />
      </div>
      <div className="field">
        <span className="field-label">贴目</span>
        <input
          className="num-input"
          type="number"
          step={0.5}
          min={0}
          max={15}
          value={options.komi}
          onChange={(e) => onChange({ komi: Number.parseFloat(e.target.value) || 0 })}
        />
        <span className="field-hint">设置改动后点「新对局」生效</span>
      </div>

      <div className="katago-section">
        <div className="field">
          <label className="check">
            <input
              type="checkbox"
              checked={katago.enabled}
              disabled={!katagoAvailable}
              onChange={(e) => onKatagoChange({ enabled: e.target.checked })}
            />
            <span>启用 KataGo 引擎（人机对战 / 智能分析）</span>
          </label>
          {!katagoAvailable && (
            <p className="field-hint">KataGo 仅桌面端（Electron）可用；Web/H5 版继续使用规则 AI。</p>
          )}
        </div>
        {katago.enabled && katagoAvailable && (
          <>
            <div className="field">
              <span className="field-label">引擎路径（katago 可执行文件）</span>
              <input
                className="num-input"
                value={katago.enginePath}
                placeholder="例如 C:\kata\katago.exe"
                onChange={(e) => onKatagoChange({ enginePath: e.target.value })}
              />
            </div>
            <div className="field">
              <span className="field-label">权重路径（.bin.gz 模型）</span>
              <input
                className="num-input"
                value={katago.weightsPath}
                placeholder="例如 C:\kata\kata1-b18.bin.gz"
                onChange={(e) => onKatagoChange({ weightsPath: e.target.value })}
              />
            </div>
            <div className="field">
              <span className="field-label">思考量（visits，越大越强越慢）</span>
              <input
                type="range"
                className="slider"
                min={10}
                max={800}
                step={10}
                value={katago.visits}
                onChange={(e) => onKatagoChange({ visits: Number(e.target.value) })}
              />
              <span className="field-hint">当前：{katago.visits}（建议 160~400；9/13 路可开高，19 路按机器性能）</span>
            </div>
            <button type="button" className="btn" onClick={handleTest} disabled={testState === 'busy'}>
              {testState === 'busy' ? '测试中…' : '测试连接'}
            </button>
            {testResult && <p className={`katago-test-result${testResult.startsWith('✓') ? ' ok' : ' err'}`}>{testResult}</p>}
            <p className="card-note">
              下载 KataGo 与权重：https://github.com/lightvector/KataGo/releases
              （RTX 50 系请用 2025 年后版本；未配置时人机对战与智能分析自动回退规则 AI）
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/** 设置面板中 KataGo 的 UI 类型 */
export interface KatagoSettingsUI {
  enabled: boolean;
  enginePath: string;
  weightsPath: string;
  visits: number;
}

// ---------- 对局信息 ----------

function ResultBox({ result }: { result: GameResult }) {
  if (result.type === 'resign') {
    const winner = result.color === BLACK ? WHITE : BLACK;
    return (
      <div className="result-box">
        <div className="result-winner">{colorName(winner)}方中盘胜</div>
        <div className="result-detail">{colorName(result.color)}方认输</div>
      </div>
    );
  }
  const s = result.score;
  const winnerText = s.winner === 0 ? '和棋' : `${colorName(s.winner)}方胜`;
  return (
    <div className="result-box">
      <div className="result-winner">{winnerText}</div>
      <div className="result-detail">
        黑 {s.blackPoints} 子 = {s.blackStones} 子 + {s.blackTerritory} 空
      </div>
      <div className="result-detail">
        白 {s.whitePoints} 子 = {s.whiteStones} 子 + {s.whiteTerritory} 空
      </div>
      <div className="result-detail dim">贴目 {s.komi} · 黑领先 {s.margin.toFixed(2)} 子（含贴目）</div>
    </div>
  );
}

export function GameInfoPanel({ game, result }: { game: Game; result: GameResult | null }) {
  const turn = game.currentColor;
  let turnLabel = `${colorName(turn)}方行棋`;
  if (game.options.mode === 'lan') {
    turnLabel = game.isAITurn() ? `${colorName(turn)}方 · 对方` : `${colorName(turn)}方 · 你`;
  } else if (game.isAITurn()) {
    turnLabel = `${colorName(turn)}方 · AI 思考中`;
  } else if (game.options.mode === 'human-ai') {
    turnLabel = `${colorName(turn)}方 · 你`;
  } else {
    turnLabel = `${colorName(turn)}方 · 玩家`;
  }

  let statusText = '进行中';
  if (game.status === 'ended') statusText = '已终局';
  else if (game.isReviewing) statusText = '打谱中';

  return (
    <section className="card">
      <CardTitle icon="局" title="对局信息" />
      <div className="info-grid">
        <div className="info-cell">
          <span className="info-label">手数</span>
          <span className="info-value">{game.moveNumber}</span>
        </div>
        <div className="info-cell">
          <span className="info-label">行棋</span>
          <span className={`info-value ${turn === BLACK ? 'stone-black' : 'stone-white'}`}>{turnLabel}</span>
        </div>
        <div className="info-cell">
          <span className="info-label">状态</span>
          <span className="info-value">{statusText}</span>
        </div>
        <div className="info-cell">
          <span className="info-label">贴目</span>
          <span className="info-value">{game.options.komi} 目</span>
        </div>
      </div>
      {result && <ResultBox result={result} />}
    </section>
  );
}

// ---------- 操作 ----------

export function ActionsPanel({
  game,
  aiThinking,
  showHints,
  markingDead,
  lan,
  analysis,
  previewPoint,
  showAtari,
  onNewGame,
  onUndo,
  onPass,
  onResign,
  onFinish,
  onToggleHints,
  onToggleMarking,
  onHint,
  onPreview,
  onClearHint,
  onToggleAtari,
}: {
  game: Game;
  aiThinking: boolean;
  showHints: boolean;
  markingDead: boolean;
  lan: boolean;
  analysis: AnalysisResult | null;
  previewPoint: Point | null;
  showAtari: boolean;
  onNewGame: () => void;
  onUndo: () => void;
  onPass: () => void;
  onResign: () => void;
  onFinish: () => void;
  onToggleHints: () => void;
  onToggleMarking: () => void;
  onHint: () => void;
  onPreview: (p: Point) => void;
  onClearHint: () => void;
  onToggleAtari: () => void;
}) {
  const ended = game.status === 'ended';
  const aiTurn = game.isAITurn();
  return (
    <section className="card">
      <CardTitle icon="手" title="操作" />
      <button type="button" className="btn primary" onClick={onNewGame}>
        新对局
      </button>
      <div className="btn-row">
        <button type="button" className="btn" disabled={game.history.length === 0 || lan} onClick={onUndo}>
          悔棋
        </button>
        <button type="button" className="btn" disabled={ended || aiTurn} onClick={onPass}>
          提子
        </button>
        <button type="button" className="btn danger" disabled={ended || aiTurn} onClick={onResign}>
          认输
        </button>
      </div>
      <button
        type="button"
        className="btn"
        disabled={ended || aiTurn || lan}
        onClick={onFinish}
        title="双方停钟后按中国规则数子"
      >
        结束数子
      </button>
      {aiThinking && <div className="ai-thinking">AI 思考中…</div>}

      <div className="hint-block">
        <button
          type="button"
          className="btn hint-btn"
          disabled={ended || aiTurn}
          onClick={onHint}
        >
          AI 建议 · 智能分析
        </button>
        {analysis && (
          <div className="hint-text">
            <p className="hint-assessment">{analysis.assessment.text}</p>
            <ul className="hint-moves">
              {analysis.moves.map((m, i) => (
                <li key={`${m.point.x}-${m.point.y}`}>
                  <button
                    type="button"
                    className={`hint-move${previewPoint && previewPoint.x === m.point.x && previewPoint.y === m.point.y ? ' active' : ''}`}
                    onClick={() => onPreview(m.point)}
                  >
                    <span className="hint-move-head">
                      {i === 0 && <span className="hint-rec">★ 推荐</span>}
                      <span className="hint-move-label">
                        {coordLabel(m.point, game.options.size)}
                      </span>
                    </span>
                    <span className="hint-move-reasons">
                      {m.reasons.map((r, j) => (
                        <span key={j} className="hint-reason">
                          {REASON_ICON[r.kind]} {r.text}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="hint-clear" onClick={onClearHint}>
              清除分析
            </button>
          </div>
        )}
      </div>

      <label className="check">
        <input type="checkbox" checked={showAtari} onChange={onToggleAtari} />
        <span>打吃提示（红环圈出被打吃的棋串）</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={showHints} onChange={onToggleHints} />
        <span>显示可落点</span>
      </label>
      <p className="card-note">点击棋盘上的棋子可查看该棋串的「气」（绿点）。</p>
      {ended && !game.resignColor && (
        <label className="check">
          <input type="checkbox" checked={markingDead} onChange={onToggleMarking} />
          <span>标记死子（数子时移除）</span>
        </label>
      )}
    </section>
  );
}

/** 棋盘坐标标签（与棋盘边缘标注一致：列 a-t 跳过 i，行自上而下） */
function coordLabel(p: Point, size: number): string {
  const COLS = 'abcdefghjklmnopqrstuvwxyz';
  return `${COLS[p.x] ?? p.x}${size - p.y}`;
}

// ---------- 打谱复盘 ----------

export function ReviewPanel({
  game,
  onNavigate,
}: {
  game: Game;
  onNavigate: (index: number) => void;
}) {
  const total = game.history.length;
  return (
    <section className="card">
      <CardTitle icon="谱" title="打谱复盘" />
      <div className="review-info">
        <span>
          第 {game.position} / {total} 手
        </span>
        {game.isReviewing && <span className="review-badge">打谱中</span>}
      </div>
      <input
        type="range"
        className="slider"
        min={0}
        max={total}
        value={game.position}
        disabled={total === 0}
        onChange={(e) => onNavigate(Number(e.target.value))}
      />
      <div className="btn-row four">
        <button type="button" className="btn" disabled={total === 0} onClick={() => onNavigate(0)} title="回到开头">
          ⏮
        </button>
        <button
          type="button"
          className="btn"
          disabled={game.position === 0}
          onClick={() => onNavigate(game.position - 1)}
          title="上一手"
        >
          ◀
        </button>
        <button
          type="button"
          className="btn"
          disabled={game.position >= total}
          onClick={() => onNavigate(game.position + 1)}
          title="下一手"
        >
          ▶
        </button>
        <button
          type="button"
          className="btn"
          disabled={game.position >= total}
          onClick={() => onNavigate(total)}
          title="回到最新"
        >
          ⏭
        </button>
      </div>
    </section>
  );
}

// ---------- SGF ----------

export function SgfPanel({
  onImport,
  onExport,
}: {
  onImport: () => void;
  onExport: () => void;
}) {
  return (
    <section className="card">
      <CardTitle icon="谱" title="棋谱文件（SGF）" />
      <div className="btn-row">
        <button type="button" className="btn" onClick={onImport}>
          导入棋谱
        </button>
        <button type="button" className="btn" onClick={onExport}>
          导出棋谱
        </button>
      </div>
      <p className="card-note">支持 .sgf 文件导入导出，含提子与分支主变。</p>
    </section>
  );
}
