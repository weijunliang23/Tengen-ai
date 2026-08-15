<p align="center">
  <a href="README.md">简体中文</a> · <b>English</b>
</p>

# Tengen · 天元

> **A teaching-first Go (Weiqi / Baduk) application for Web, Windows & macOS.**

Tengen is a complete Go board game built with **React + TypeScript + Vite**, wrapped in an **Electron** shell. It ships with a fully implemented Chinese-rules engine, a human-vs-AI mode, a built-in **teaching mode** with six rule demonstrations, and **move hints with plain-language explanations** — everything you need to learn and play the game of Go.

The name *Tengen* (天元) is the center point of the board — the starting point of every game, and a fitting name for a project that helps people begin their Go journey.

---

## ✨ Features

### Gameplay
- **Full rules engine** (pure TypeScript, zero dependencies):
  - Legal move detection, capturing, atari, **suicide prohibition**
  - **Ko and superko (positional repetition) enforcement**
  - **Chinese scoring (area counting)** with configurable komi, plus **dead-stone marking** at the end of a game
- **9 / 13 / 19 line boards**, rendered on Canvas with a wooden-board aesthetic, stone-drop animations, hover ghosts, and coordinate labels
- **Two-player** and **Human-vs-AI** modes (play Black or White)
- Undo, pass, resign, and "count the score" controls
- **Game review**: step navigation, slider, and branching (playing from a past position forks the game tree)

### Learning & Teaching
- **AI suggestions with reasons** — ask the AI for a move and it explains *why*: "captures 2 White stones", "saves a captured group", "atari on White", and more
- **Atari highlighting** — all groups in atari are circled in red
- **Group inspection** — click any stone to see its liberties (marked in green)
- **Teaching mode** — six interactive lessons with step-by-step replay and commentary:
  1. Capturing (liberties & eating stones)
  2. Atari and escaping
  3. Ko fights & superko
  4. The suicide rule
  5. When capturing saves you from suicide
  6. Counting the score at the end of a game

### Files & Portability
- **SGF import / export** (including passes)
- Runs in any modern browser, or as a native app on **Windows** and **macOS** via Electron
- Chinese-first UI with a dark "Ink & Wood" (墨与木) theme

---

## 🖥 Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + TypeScript + Vite |
| Board rendering | HTML Canvas (hand-rolled, no game library) |
| Rules engine | Pure TypeScript, zero dependencies, unit-tested |
| Tests | Vitest |
| Desktop | Electron + electron-builder |
| Packaging | NSIS (Windows), DMG (macOS) |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) **18+** (npm 9+)

### Install & Run

```bash
npm install          # install dependencies
npm run dev          # Web dev server → http://localhost:5173
```

### Tests & Build

```bash
npm test             # run the unit test suite (Vitest)
npm run build        # type-check + production Web build
npm run typecheck    # type-check both renderer and Electron code
```

### Desktop Development

```bash
npm run electron:dev        # Electron with Vite hot reload
npm run electron:dir        # unpacked app (fast sanity check)
npm run electron:build      # Windows installer (NSIS) → release/
npm run electron:build:mac  # macOS DMG (run on macOS or CI)
```

> **Packaging notes**
> - Windows: `electron:build` produces an NSIS installer on the current machine.
> - macOS: `electron-builder.yml` is preconfigured for DMG (x64 + arm64) with `hardenedRuntime`. For public distribution you need an Apple Developer certificate (`CSC_LINK`) and notarization credentials — see the comments in `electron-builder.yml`.
> - The internal product name is `GoBoard`; the installed shortcut is named `围棋`.

---

## 🎮 Using the App

1. **Start a game** — pick a board size (9/13/19), komi, and mode (two-player or vs AI, Black or White), then click **New Game**.
2. **Play** — click an intersection to place a stone. Illegal moves (suicide, ko repetition) are rejected with a toast explaining why.
3. **Learn as you play**:
   - Click **AI Suggestion** to see the recommended move and its reasoning.
   - Toggle **Atari highlighting** to see threatened groups.
   - Click any stone to view its group and liberties.
4. **Finish & count** — when both players pass, or click **Count Score**, the game ends. Click dead stones to mark them, and the Chinese area-count result updates live.
5. **Review** — use the slider or ◀ ▶ buttons to step through the game; play from any past position to fork the game tree.
6. **Teaching mode** — switch to the **教学 (Teach)** tab in the header for the six rule lessons.

---

## ⚖️ Rules Implemented

- **Chinese rules**: area counting (`子空皆地`) — score = stones + territory, Black gives **7.5 komi** (adjustable). On 19×19 Black needs 185 points to win.
- **Superko**: a position identical to any earlier position in the current game line is forbidden — this also covers simple-ko immediate recapture.
- **Suicide** is illegal, *unless* the move captures (capturing always gives the stone liberties).
- Game ends after two consecutive passes or by resignation.

---

## 🤖 AI

- The built-in **heuristic engine** plays a solid casual game:
  - capture-first move selection
  - **one-ply defensive search** — every candidate move is checked for "does this leave my own group capturable?" and punished if so (no more blundering away big groups)
  - avoids filling its own eyes, prefers 3rd/4th-line development
  - returns **human-readable reasons** for every suggestion (used by the teaching hints)
- A **KataGo adapter is reserved** behind the `GoEngine` interface (`src/core/ai/engine.ts`). For stronger play or win-rate analysis:
  1. Download KataGo + a model: <https://github.com/lightvector/KataGo/releases>
  2. Set `KATAGO_PATH` / `KATAGO_MODEL`
  3. Bridge it through the Electron main process over GTP (see the annotated stub in `src/core/ai/katago.ts` and `electron/main.ts`)

---

## 🏗 Architecture

```
src/core/                 Pure rules engine (framework-agnostic, unit-tested)
  board.ts                Board data structure
  rules.ts                Legal moves / capture / ko / superko
  game.ts                 Game state machine (undo / review / branching / atari queries)
  scoring.ts              Chinese area counting (extensible to Japanese rules)
  sgf.ts                  SGF parsing & serialization
  teaching.ts             Teaching lessons (6) & replay engine
  ai/engine.ts            GoEngine interface
  ai/heuristic.ts         Heuristic AI (one-ply defense + move reasons)
  ai/katago.ts            KataGo adapter (reserved)
src/ui/                   React UI shared by Web & Electron
  Board.tsx               Canvas board (suggestion marks / atari highlight / liberty view)
  TeachingView.tsx        Teaching mode
  Panels.tsx              Settings / info / actions / review / SGF
  App.tsx                 State, AI scheduling, teaching hints
electron/                 Electron main process & preload
```

The rules engine is deliberately **pure and dependency-free**, so it can be reused, tested, or ported (e.g., to a server for online play later).

---

## 🧪 Testing

```bash
npm test
```

The suite covers: capturing (single, group, multi-group), suicide, ko & superko, Chinese scoring (including the 185-stone threshold), game state machine (undo/review/branching), SGF round-trips, AI move selection, and teaching-lesson replays.

---

## 🔧 Customization

- **Rename the project**: edit `package.json` (`name`) and `electron-builder.yml` (`productName`).
- **App icon**: place `build/icon.ico` (Windows) and `build/icon.icns` (macOS); electron-builder picks them up automatically.
- **Theme**: all colors live in CSS variables at the top of `src/ui/styles.css`.

---

## 📄 License

[MIT](LICENSE) — free to use, modify, and distribute.

---

## 🙏 Acknowledgements

- [KataGo](https://github.com/lightvector/KataGo) — the strongest open-source Go engine, for future integration
- The Go community — for the rules, terminology, and endless patience with beginners

*Have fun, and may your groups always have liberties!*
