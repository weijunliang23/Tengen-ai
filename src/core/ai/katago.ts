import type { Board } from '../board';
import type { Color } from '../types';
import type { GoEngine, MoveSuggestion } from './engine';

/**
 * KataGo 引擎（预留接口，未启用）。
 *
 * 启用步骤（Electron 桌面端）：
 *   1. 下载 KataGo 可执行文件：https://github.com/lightvector/KataGo/releases
 *   2. 下载权重文件（.bin.gz），例如 kata1-b18c384nbt-s9996604416-d4316597426.bin.gz
 *   3. 设置环境变量 KATAGO_PATH 与 KATAGO_MODEL（或通过构造参数传入）
 *   4. 本类通过 GTP 协议与引擎进程通信：
 *      - boardsize N
 *      - komi K
 *      - play B|W [坐标]   （或 pass）
 *      - genmove B|W       （返回建议着法）
 *
 * 注意：子进程只能由 Electron 主进程启动（Web 端无进程能力），
 * 建议通过 IPC 桥接到渲染进程。当前实现仅保留骨架与协议注释。
 */
export class KataGoEngine implements GoEngine {
  readonly name = 'KataGo';

  // 进程句柄（由 Electron 主进程注入的 spawn 能力创建）
  // private proc: ChildProcess | null = null;

  constructor(
    private readonly kataGoPath?: string,
    private readonly modelPath?: string,
    private readonly configPath?: string,
  ) {}

  async suggest(_board: Board, _color: Color, _moveCount: number): Promise<MoveSuggestion> {
    // 骨架实现：未配置时明确报错，避免静默失败
    const missing: string[] = [];
    if (!this.kataGoPath) missing.push('KATAGO_PATH');
    if (!this.modelPath) missing.push('KATAGO_MODEL');
    if (missing.length > 0) {
      throw new Error(`KataGo 引擎未配置（缺少 ${missing.join('、')}）`);
    }
    // 实际流程：
    // 1. spawn(this.kataGoPath, ['gtp', '-model', this.modelPath, ...(this.configPath ? ['-config', this.configPath] : [])])
    // 2. 写入 boardsize / komi / play 历史
    // 3. 发送 genmove，读取返回坐标（或 "pass"）
    // 4. 解析为 Point 返回
    throw new Error(
      `KataGo 引擎尚未实现进程通信（config: ${this.configPath ?? '未配置'}），请先接入 Electron 主进程 IPC`,
    );
  }
}
