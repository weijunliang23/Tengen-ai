/**
 * 启动前清理占用指定端口的旧进程（跨平台：Windows / macOS / Linux）。
 *
 * 用法：
 *   node scripts/clean-port.mjs 5173 4173
 *
 * 原理：
 *   - Windows：netstat -ano 找出监听端口的 PID，taskkill /F 结束
 *   - macOS / Linux：lsof -t -i:<port> 找出 PID，SIGKILL 结束
 * 主要用于解决「上次 dev server 残留进程占用 5173」导致端口冲突的问题。
 */
import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';

const ports = process.argv
  .slice(2)
  .map((s) => Number(s))
  .filter((n) => Number.isInteger(n) && n > 0);

const isWin = platform() === 'win32';

/** 找出监听某端口的所有 PID */
function findPidsOnPort(port) {
  try {
    if (isWin) {
      const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8' }).stdout || '';
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes(`:${port}`)) continue;
        const m = line.trim().match(/(\d+)\s*$/);
        if (m) {
          const pid = Number(m[1]);
          if (pid > 0 && pid !== process.pid) pids.add(pid);
        }
      }
      return [...pids];
    }
    const out = spawnSync('lsof', ['-t', `-i:${port}`], { encoding: 'utf8' }).stdout || '';
    return out
      .split(/\r?\n/)
      .map((s) => Number(s.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

/** 结束指定 PID */
function killPid(pid) {
  try {
    if (isWin) {
      spawnSync('taskkill', ['/PID', String(pid), '/F'], { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch {
    return false;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let exitCode = 0;

for (const port of ports) {
  let pids = findPidsOnPort(port);
  let attempts = 0;
  // 最多重试 10 次（每次等 200ms），等待端口释放
  while (pids.length > 0 && attempts < 10) {
    for (const pid of pids) {
      console.log(`[clean-port] 释放端口 ${port}：结束进程 ${pid}`);
      killPid(pid);
    }
    attempts++;
    await wait(200);
    pids = findPidsOnPort(port);
  }

  if (pids.length > 0) {
    console.warn(`[clean-port] 端口 ${port} 仍被占用（PID ${pids.join(', ')}），可能缺少权限`);
    exitCode = 1;
  } else {
    console.log(`[clean-port] 端口 ${port} 已就绪`);
  }
}

process.exit(exitCode);
