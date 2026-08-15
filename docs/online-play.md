# 联网对战方案（规划 · 未实现）

> 目标：把局域网对战的同一套协议升级为公网在线对战。
> 技术选型原则：**最轻量化**——单 Node 进程 + SQLite 文件即可跑起来，不需要数据库服务、不需要微服务。

## 现状：局域网对战已就绪

- `server/lan-server.mjs`：WebSocket 配对 + 转发（约 90 行，零业务逻辑）
- `src/core/network.ts`：统一消息协议（hello / paired / move / pass / resign / rematch / opponent-left）
- `src/core/netgame.ts`：客户端联机状态机（执子分配、轮次纪律、再来一局）
- 双方客户端各自用同一套纯 TS 规则引擎校验，局面天然一致

联网对战 = **同一协议 + 服务端持久化与校验**，无需重写客户端。

## 方案

### 1. 服务端升级（Node.js）

```
server/
  index.mjs            # 入口：HTTP(静态/接口) + WebSocket
  auth.mjs             # 注册/登录（token 鉴权）
  lobby.mjs            # 大厅：建房/加入/列表
  match.mjs            # 对局管理：配对、落子校验、终局存档
  store.mjs            # SQLite 数据访问
```

依赖（全部轻量）：

| 依赖 | 用途 |
|---|---|
| `ws` | WebSocket（已引入） |
| `better-sqlite3` | 同步 SQLite，最快最简，无需 ORM |
| `express` | 可选，提供 REST 接口（注册/战绩查询）；也可用原生 http 省掉 |

### 2. 数据模型（SQLite）

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,        -- bcrypt/argon2，绝不存明文
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sgf TEXT NOT NULL,                  -- 完整棋谱（现有 SGF 模块直接序列化）
  size INTEGER NOT NULL,
  komi REAL NOT NULL,
  black_id INTEGER,                   -- 执黑用户
  white_id INTEGER,
  result TEXT,                        -- B+R / W+R / B+X.5 / 等等
  played_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE matches (                -- 大厅/建房（可选：也可用内存队列）
  id TEXT PRIMARY KEY,                -- 房间号
  host_id INTEGER, creator_id INTEGER,
  size INTEGER, komi REAL,
  status TEXT                         -- waiting / playing / finished
);
```

### 3. 关键设计点

- **落子校验移到服务端**：客户端发 `move` 时，服务端用编译后的规则核心（`src/core` 经 tsc 编译为 JS 后直接 require）校验合法性，非法直接拒绝——防作弊的前提。
- **会话与鉴权**：`hello` 消息带上 token；未登录游客可进「快速匹配」，登录用户可建房/查战绩。token 用简单随机串 + 内存表或 SQLite 会话表，不做 JWT 也行（自用规模）。
- **断线重连**：WebSocket 断开后保留房间 N 分钟，凭 token 重连续局（对局状态服务端持有，无需回放）。
- **匹配**：最简单方案 = 建房/加入（房间号 6 位），匹配池（两人自动配对）留作二期。
- **部署**：一台小服务器（或家用电脑/树莓派）跑 `node server/index.mjs`，SQLite 单文件备份即迁移；公网需反代（nginx/caddy）加 TLS（`wss://`）。

### 4. 客户端改动量（很小）

- `NetGame.connect` 的 hello 带上 token + 房间号；
- 新增「大厅」UI（建房/加入/列表）——复用现有 LanPanel 的模式；
- 断线重连按钮。

### 5. 迭代路线

| 阶段 | 内容 | 工作量 |
|---|---|---|
| 一期（现在） | 局域网对战：配对 + 转发 | ✅ 已完成 |
| 二期 | 公网 MVP：注册/登录、建房/加入、服务端落子校验、SGF 存档 | 中（~1-2 天） |
| 三期 | 快速匹配、段位/ELO、历史战绩页、观战 | 中 |
| 四期 | 房间聊天、AI 复盘、排行榜 | 小-中 |

### 6. 为什么这样选

- **Node + ws + better-sqlite3**：三个依赖、单进程、单文件数据库，本机/小服务器都能跑，符合「最轻量化」。
- 不引入 Redis / PostgreSQL / 消息队列：对这个规模是过度设计；等真有几千并发再演进（届时协议不变，只换存储层）。
- 客户端规则引擎与服务端同一份代码（monorepo 内复用），校验逻辑零重复。

> 结论：联网对战**不急、可做可不做**——局域网版已覆盖"两人对弈"核心价值；真要做时按上述方案，客户端几乎不用改。
