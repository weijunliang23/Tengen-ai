<p align="center">
  <b>简体中文</b> · <a href="README.en.md">English</a>
</p>

# 围棋 · GoBoard

支持 **Web / Windows / macOS** 的围棋应用：React + TypeScript + Vite 共享核心，Electron 桌面壳。

## 功能

- 完整围棋规则核心（纯 TS，零依赖）：
  - 落子合法性、提子、打吃、**自杀判定**
  - **劫争与禁全同（superko）**
  - 中国规则**数子法**终局判定（贴 7.5 目，可调），终局支持**标记死子**
- 9 / 13 / 19 路棋盘，Canvas 渲染（木纹棋盘、落子动画、悬停幽灵子、坐标标注）
- 双人对弈 / 人机对弈（执黑执白可选）；**启发式 AI（含一步防御搜索）**，**KataGo 接口预留**
- 悔棋、提子、认输、结束数子
- 打谱复盘：步数导航、滑杆、分支（打谱位置落子自动截断）
- **教学提示**：AI 建议落点 + 人话理由（提子/打吃/救活/连气）、打吃高亮、点击棋子查看棋串气数
- **规则演示教学模式**：提子、打吃逃跑、劫争与禁全同、自杀、提子救命、数子终局六课，逐步演示 + 图文说明 + 动态数子
- **SGF 导入 / 导出**（含提子）
- **设置本地持久化**：棋盘/贴目/模式与提示开关保存在浏览器本地，刷新不丢失
- 中文界面，深色「墨与木」主题

## 开发

```bash
npm install
npm run dev          # Web 开发（http://localhost:5173，启动前自动清理残留端口进程）
npm test             # 单元测试（vitest）
npm run build        # 类型检查 + Web 构建
```

### 局域网访问（手机/平板/同网电脑）

`npm run dev` 已默认监听所有网卡，启动后终端会显示 **Network** 地址（形如 `http://192.168.x.x:5173`）。同一局域网的设备用浏览器打开该地址即可直接对弈。

- 如对方无法访问：Windows 防火墙首次运行时会弹窗，请勾选「专用网络」并允许 Node.js；或在「允许应用通过防火墙」中手动放行。
- 手机与电脑需处于**同一 Wi-Fi / 同一局域网**。
- 预览构建产物（`npm run preview`，端口 4173）同样支持局域网访问。

## 桌面端

```bash
npm run electron:dev          # Electron + Vite 热更新
npm run electron:build        # Windows 安装包（NSIS，输出到 release/）
npm run electron:build:mac    # macOS（dmg，需在 macOS 或 CI 执行）
```

打包说明：

- Windows：本机直接 `npm run electron:build` 生成安装包。
- macOS：`electron-builder.yml` 中已配置 dmg + 双架构 + hardenedRuntime；
  正式分发需 Apple 证书（`CSC_LINK`）与公证（`APPLE_ID` 等），配置见文件内注释。
- 产品名 `GoBoard`，安装后的快捷方式名为「围棋」。

## 架构

```
src/core/                 纯规则引擎（可独立测试、可复用）
  board.ts                棋盘数据结构
  rules.ts                落子 / 提子 / 劫 / 禁全同
  game.ts                 对局状态机（悔棋 / 打谱 / 分支 / 打吃查询）
  scoring.ts              中国规则数子法（可扩展日本规则）
  sgf.ts                  SGF 解析与导出
  teaching.ts             教学课件（六课）与重放引擎
  ai/engine.ts            引擎接口（GoEngine）
  ai/heuristic.ts         启发式 AI（一步防御搜索 + 走子理由）
  ai/katago.ts            KataGo 预留接口
src/ui/                   React 界面（Web 与 Electron 共用）
  Board.tsx               Canvas 棋盘（建议标记 / 打吃高亮 / 选子看气）
  TeachingView.tsx        规则演示教学模式
  Panels.tsx              设置 / 信息 / 操作 / 打谱 / SGF
  App.tsx                 状态、AI 调度、教学提示
electron/                 Electron 主进程 / 预加载
```

## 接入 KataGo（预留）

1. 下载 KataGo 与权重：<https://github.com/lightvector/KataGo/releases>
2. 设置 `KATAGO_PATH` / `KATAGO_MODEL`
3. 按 `electron/main.ts` 中注释，通过 GTP 协议经 IPC 桥接（Web 端无进程能力）

## 规则说明

- 采用中国规则：数子法，黑贴 7.5 目（19 路黑需 185 子胜）。
- 禁全同：同一局面在本局棋谱线路中不得再现（简单劫即时回提也被禁止）。
- 终局：双方连续提子自动终局，或点击「结束数子」；随后可点选死子重算。
