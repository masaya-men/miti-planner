// @ts-check
/**
 * 性能の基準を全組み合わせ(縦/横 × 標準/MIL-SPEC × ふつう/スプシ × データ 3 種 = 24 条件)で取る/比べる。
 * 実際の測定は scripts/milspec-polish/scroll-perf.mjs(--axis --dsr --view --dataset --out-dir)に任せる。
 * 使い方: SP2_BASE_URL=http://localhost:4184 node scripts/sticky-scroll/perf-baseline.mjs \
 *           [--save | --compare] [--only=<名前に含まれる文字>] [--list] [--prefix=baseline] [--trace] [--runs=5]
 *   --save     baseline-<axis>-<theme>-<view>-<dataset>.json を scripts/sticky-scroll/.baseline/perf/ に保存(git に入れない)
 *   --compare  同じ名前の基準と比べる(1 件でも悪化=exit 1・条件違い等=exit 2)
 *   --prefix   名前の頭(既定 baseline)。--compare の測定を別名で残したいときは --save --prefix=after-x のように使う
 * runs は既定 9(scroll-perf 単体の既定 5 とは別)。外れ値の回は scroll-perf が捨てて測り直す。
 * 条件: 1489×679 / DSR 2.58 / CPU 4 倍 / 3 秒 × 5 回の中央値。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const outDir = path.join(here, '.baseline', 'perf');
const prefix = typeof args.prefix === 'string' ? args.prefix : 'baseline';

const conds = [];
for (const axis of ['y', 'x']) for (const theme of ['standard', 'military']) for (const view of ['lanes', 'sheet']) for (const dataset of ['synthetic', 'normal', 'heavy']) {
    conds.push({ axis, theme, view, dataset, mode: 'raf', name: `${prefix}-${axis}-${theme}-${view}-${dataset}` });
}
// 本物のホイール(横は Shift 併用)の基準 2 本: 標準・ふつう・normal
for (const axis of ['x', 'y']) conds.push({ axis, theme: 'standard', view: 'lanes', dataset: 'normal', mode: 'wheel', name: `${prefix}-wheel-${axis}-standard-lanes-normal` });
const sel = conds.filter((c) => typeof args.only !== 'string' || c.name.includes(args.only));
if (args.list) { console.log(sel.map((c) => c.name).join('\n')); process.exit(0); }
if (!args.save && !args.compare) { console.error('--save か --compare を指定してください(--list で一覧)'); process.exit(2); }

fs.mkdirSync(outDir, { recursive: true });
const failed = [];
let worst = 0;
for (const c of sel) {
  const cmd = [path.join(root, 'scripts/milspec-polish/scroll-perf.mjs'), `--axis=${c.axis}`, `--theme=${c.theme}`, `--view=${c.view}`, `--dataset=${c.dataset}`, `--mode=${c.mode}`,
    '--dsr=2.58', '--cpu=4', `--out-dir=${outDir}`, ...(args.trace ? ['--trace'] : []), `--runs=${typeof args.runs === 'string' ? args.runs : 9}`, `--min-frames=${typeof args['min-frames'] === 'string' ? args['min-frames'] : (c.axis === 'x' ? 40 : 0)}`,
    args.save ? `--save=${c.name}` : `--compare=${c.name}`];
  console.log(`\n=== ${c.name}`);
  // 想定外の例外(exit 3: ページ読み込みの揺れ等)だけ 1 回やり直す
  let r;
  for (let attempt = 1; attempt <= 2; attempt++) {
    r = spawnSync(process.execPath, cmd, { cwd: root, encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
    const lines = `${r.stdout}${r.stderr}`.trim().split('\n');
    console.log(lines.filter((l) => /^(MEDIAN|compare|saved|trace|OK|FAIL|基準)/.test(l) || (r.status !== 0 && r.status !== 1)).slice(-6).join('\n'));
    if (r.status === 0 || r.status === 1 || r.status === 2) break; // 2(条件違い・基準なし)は再試行しない
    console.log(`(終了コード ${r.status}。やり直し ${attempt}/2)`);
  }
  if (r.status !== 0) { failed.push(`${c.name} (exit ${r.status})`); worst = Math.max(worst, r.status === 1 ? 1 : 2); }
}
console.log('\n=== 保存済みの基準 JSON:');
for (const f of fs.readdirSync(outDir).filter((f) => f.startsWith(`${prefix}-`)).sort()) console.log(`  ${path.join('scripts/sticky-scroll/.baseline/perf', f)}`);
if (failed.length) console.log(`\n失敗/悪化: ${failed.join(', ')}`);
process.exit(worst);
