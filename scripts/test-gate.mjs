// @ts-check
/**
 * test-gate.mjs — push 前の全体テスト。結果が出た時点で必ず終わる(後片付けで止まっても待たない)。
 *
 * 背景: pool 'vmThreads' はテストが実タイマー等を残すとワーカーを終了できず、全テストが終わった後に
 *       プロセスだけ残って無限に待つ(memory reference_vitest_vmthreads_hang)。2026-10-22 にも 4829 件全部通過後に停止。
 * 仕組み: 専用レポーター(test-gate-reporter.mjs)が全ファイルの結果がそろった瞬間に結果ファイルを書く → それを読む →
 *         vitest をプロセスごと止める → 成否で終了コード。標準の JSON レポーターは後片付けの後に書くので止まると出ない。
 *         出力はファイル(.vt.txt)へ直接書く(Windows でパイプすると EPIPE で止まるため)。
 * 使い方: npm run test:gate   (成功=0 / 失敗あり=1 / 上限時間までに結果が出ない=2)
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const result = path.join(root, '.vt-result.json');
const logPath = path.join(root, '.vt.txt');
const LIMIT_MS = 15 * 60 * 1000;

fs.rmSync(result, { force: true });
const log = fs.openSync(logPath, 'w');
const child = spawn(process.execPath, [
  path.join(root, 'node_modules/vitest/vitest.mjs'), 'run',
  '--reporter=dot', `--reporter=${path.join(root, 'scripts/test-gate-reporter.mjs')}`,
  ...process.argv.slice(2),
], { cwd: root, stdio: ['ignore', log, log] });

const stopChild = () => {
  if (child.exitCode !== null || !child.pid) return;
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGKILL');
  } catch { /* 既に終わっている */ }
};

const started = Date.now();
const finish = (code, msg) => {
  clearInterval(timer);
  stopChild();
  console.log(msg);
  process.exit(code);
};

const readResult = () => {
  try { return JSON.parse(fs.readFileSync(result, 'utf8')); } catch { return null; } // 書き途中は次の周期で読み直す
};

const timer = setInterval(() => {
  const r = readResult();
  if (r) {
    const mods = r.modules ?? [];
    const failed = mods.flatMap((m) => m.failed.map((n) => `  ✗ ${m.file} > ${n}`));
    const fileErrors = mods.filter((m) => m.state === 'failed' && !m.failed.length).map((m) => `  ✗ ${m.file} (読み込み失敗: ${m.error})`);
    const bad = failed.length + fileErrors.length + (mods.length < r.total ? 1 : 0);
    const passed = mods.reduce((a, m) => a + m.passed, 0);
    const skipped = mods.reduce((a, m) => a + m.skipped, 0);
    const sec = Math.round((Date.now() - started) / 1000);
    const head = `テスト ${passed + skipped + failed.length} 件: 通過 ${passed} / 失敗 ${failed.length} / 保留 ${skipped} (ファイル ${mods.length}/${r.total} ・${sec} 秒) 詳細=.vt.txt`;
    const short = mods.length < r.total ? [`  ✗ 結果がそろう前に vitest が終わりました(${mods.length}/${r.total})`] : [];
    finish(bad ? 1 : 0, [head, ...failed, ...fileErrors, ...short].join('\n'));
  } else if (child.exitCode !== null) {
    finish(2, `vitest が結果を書かずに終了しました(exit ${child.exitCode})。.vt.txt を見てください`);
  } else if (Date.now() - started > LIMIT_MS) {
    finish(2, `上限 ${LIMIT_MS / 60000} 分までに結果が出ませんでした。.vt.txt を見てください`);
  }
}, 2000);
