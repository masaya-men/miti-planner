// @ts-check
/**
 * 表の縦スクロール性能の計測(基準取り)。
 * 使い方: SP2_BASE_URL=http://localhost:4173 node scripts/milspec-polish/scroll-perf.mjs \
 *           [--theme=standard|military] [--cpu=4] [--save=<name>] [--compare=<name>]
 *           [--axis=y|x] [--dsr=1] [--view=lanes|sheet] [--dataset=synthetic|normal|heavy]
 *           [--mode=raf|wheel] [--runs=5] [--trace]
 * 追加引数(Task 4・既定はすべて従来どおり = axis=y / dsr=1 / view=lanes / dataset=synthetic / mode=raf / runs=5):
 *   --axis=x     横スクロール(rAF 内で scrollLeft を三角波で動かす)。y は従来の縦。
 *   --dsr=2.58   deviceScaleFactor(既定 1)。本人条件は 2.58。
 *   --view=sheet テーマ設定の timelineView を sheet(スプシ表示)にする。
 *   --dataset=   synthetic=下の buildEvents(300 行超) / normal・heavy=docs/.private/perf-tools/dataset-*.json
 *                (場所は環境変数 PERF_TOOLS_DIR で変更可)。heavy は「空の行を隠す」を実クリックで OFF にして約 1500 行にする。
 *   --mode=wheel 本物のホイール(page.mouse.wheel。横は Shift 併用)で動かし、rAF は測定だけに使う。
 *   (安定化) 計測の前に同じスクロールを 1 秒空走(捨てる)→ HeapProfiler.collectGarbage を 1 回。横(--axis=x)の速度は動ける距離に比例(1 往復 = 2 秒固定)。
 *   --min-frames=100(横の既定。縦は 0=確かめない) 1 回の測定でコマ数がこれ未満なら止まった回として捨てて測り直す(--max-discard の上限を超えたら「測定不成立」で終了)。
 *   --max-discard=3  p95 が中央値の 3 倍を超えた回を捨てて測り直す回数の上限(捨てた回数は出力 discarded に出す)。
 *   --out-dir=<dir> --save / --compare の JSON の置き場所(既定 scripts/milspec-polish/.perf)。
 *   --trace      通常の runs の後に 1 回だけ追加でトレースを取り、Layerize / Commit の時間を trace として記録(合否には使わない)。
 * 本番ビルド(npm run build → npx vite preview --port 4173 --strictPort)で測る。dev では測らない。
 * 条件: 1489×679 / deviceScaleFactor 1 / 300 行超(1・2・3 段混在)/ 3 秒 × 5 回の中央値。
 * 結果は scripts/milspec-polish/.perf/<name>.json(コミットしない)。
 * CPU は CDP Emulation.setCPUThrottlingRate で既定 4 倍に低速化(60Hz 上限で差が出ないため)。
 * 他に longtask(件数・ブロック時間=Σ(duration-50))と平均フレーム間隔も記録する。
 * --compare の規則: p95 フレーム間隔 または 総ブロック時間 が基準より 10% 超悪化したら exit 1。
 *   (基準のブロック時間が 0 の場合は +50ms 超で悪化とみなす)
 * スクロールはプログラム的(rAF 内で scrollTop を更新)で、コンポジタのホイールスクロールではない。
 * 注: dev の store 注入(applyFixture)は本番ビルドで動かないため、localStorage 注入で表を作る。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, gotoMiti } from '../milspec-sp2/_fixture.mjs';

// 想定外の例外は exit 3(1=悪化・2=条件違い/基準なし と区別する)
process.on('uncaughtException', (e) => { console.error(e); process.exit(3); });

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const theme = args.theme === 'military' ? 'military' : 'standard';
const AXIS = args.axis === 'x' ? 'x' : 'y';
const DSR = Number(typeof args.dsr === 'string' ? args.dsr : 1);
const VIEW = args.view === 'sheet' ? 'sheet' : 'lanes';
const DATASET = ['normal', 'heavy'].includes(String(args.dataset)) ? String(args.dataset) : 'synthetic';
const MODE = args.mode === 'wheel' ? 'wheel' : 'raf';
const RUNS = Number(typeof args.runs === 'string' ? args.runs : 5);
const PERF_TOOLS_DIR = process.env.PERF_TOOLS_DIR || 'C:/Users/masay/Desktop/FF14Sim/docs/.private/perf-tools';
// 縦は「重くてコマが少ない」こと自体が測定対象なので既定では確かめない(横だけ 100)。--min-frames で上書き可
const MIN_FRAMES = Number(typeof args['min-frames'] === 'string' ? args['min-frames'] : (AXIS === 'x' ? 100 : 0));
const WARMUP_MS = 1000;
const MAX_DISCARD = Number(typeof args['max-discard'] === 'string' ? args['max-discard'] : 3);
const MIN_ROWS = { synthetic: 300, normal: 90, heavy: 1000 }[DATASET];
const NONDEFAULT = AXIS !== 'y' || DSR !== 1 || VIEW !== 'lanes' || DATASET !== 'synthetic' || MODE !== 'raf';
const CPU = Number(typeof args.cpu === 'string' ? args.cpu : 4);
const DURATION_MS = 3000;
const SPEED_PX_PER_S = 900;
const THRESHOLD = 0.1;
const perfDir = typeof args['out-dir'] === 'string' ? path.resolve(args['out-dir']) : path.join(path.dirname(fileURLToPath(import.meta.url)), '.perf');

/** 1 秒刻みで 330 秒。5 秒ごとに 2 段、7 秒ごとに 3 段(両方=3 段)。 */
function buildEvents() {
  const ev = [];
  for (let t = 1; t <= 330; t++) {
    const n = t % 7 === 0 ? 3 : t % 5 === 0 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      ev.push({
        id: `perf-${t}-${k}`,
        time: t,
        name: { ja: `攻撃 ${t}-${k}`, en: `Attack ${t}-${k}` },
        damageType: k === 1 ? 'physical' : 'magical',
        damageAmount: 80000 + k * 10000,
        target: 'AoE',
      });
    }
  }
  return ev;
}

const JOBS = [['MT', 'pld', 'tank'], ['ST', 'war', 'tank'], ['H1', 'whm', 'healer'], ['H2', 'sge', 'healer'],
  ['D1', 'mnk', 'dps'], ['D2', 'brd', 'dps'], ['D3', 'blm', 'dps'], ['D4', 'smn', 'dps']];
const stats = { hp: 186846, mainStat: 6217, det: 2410, crt: 420, ten: 420, ss: 420, wd: 154 };
const storage = {
  'mitigation-storage': {
    state: {
      currentLevel: 100, timelineEvents: buildEvents(), timelineMitigations: [], phases: [], labels: [],
      partyMembers: JOBS.map(([id, jobId, role]) => ({ id, jobId, role, stats, computedValues: {} })),
      schAetherflowPatterns: {}, aaSettings: { damage: 0, type: 'magical', target: 'MT' }, myMemberId: null,
      myJobHighlight: false, hideEmptyRows: false, showRowBorders: false, timelineSortOrder: 'light_party',
      hiddenPartyMemberIds: [], memos: [], progress: { points: [], cleared: false }, _loadedPlanId: null,
    },
    version: 4,
  },
  'plan-storage': {
    state: { plans: [], currentPlanId: 'perf-debug', lastActivePlanId: null, _dirtyPlanIds: [], _deletedPlanIds: [] },
    version: 2,
  },
};

/** dataset-normal / dataset-heavy の localStorage 一式(perf-tools の形式)を読む。synthetic は上の storage。 */
function loadBaseStorage() {
  if (DATASET === 'synthetic') return storage;
  const d = JSON.parse(fs.readFileSync(path.join(PERF_TOOLS_DIR, `dataset-${DATASET}.json`), 'utf8'));
  const ls = { ...d.localStorage };
  delete ls['tutorial-storage']; // launch() が抑制用を入れる
  return ls;
}
const baseStorage = loadBaseStorage();

/** Layerize / Commit のトレース(Tracing の JSON から name 一致の X イベントを集計)。 */
function summarizeTrace(buf) {
  const ev = JSON.parse(buf.toString('utf8')).traceEvents ?? [];
  const agg = (name) => {
    const d = ev.filter((e) => e.name === name && e.ph === 'X' && typeof e.dur === 'number').map((e) => e.dur / 1000);
    return { n: d.length, sumMs: d.reduce((a, b) => a + b, 0), maxMs: d.length ? Math.max(...d) : 0 };
  };
  return { layerize: agg('Layerize'), commit: agg('Commit') };
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function measureOnce(withTrace = false) {
  const { browser, page } = await launch({ theme: 'dark', viewport: { width: 1489, height: 679 }, dsf: DSR });
  try {
    await page.addInitScript(({ storage, military, view }) => {
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, JSON.stringify(v));
      if (military) {
        localStorage.setItem('theme-storage', JSON.stringify({
          state: { theme: 'dark', themeStyle: 'military', contentLanguage: 'ja', mobileEffectBarMode: 'icon', ...(view === 'sheet' ? { timelineView: 'sheet' } : {}) },
          version: view === 'sheet' ? 3 : 2,
        }));
      } else if (view === 'sheet') {
        localStorage.setItem('theme-storage', JSON.stringify({
          state: { theme: 'dark', themeStyle: 'standard', contentLanguage: 'ja', mobileEffectBarMode: 'icon', timelineView: 'sheet' }, version: 3,
        }));
      }
    }, { storage: baseStorage, military: theme === 'military', view: VIEW });
    await gotoMiti(page);
    await page.waitForTimeout(1000); // 読み込み後の沈静化
    if (DATASET === 'heavy') {
      // 「空の行を隠す」は既定 ON(プラン不明だと強制 ON)。実クリックで OFF にして約 1500 行にする(perf-tools README)。
      const tb = await page.locator('#timeline-controls-inner button').first().boundingBox();
      if (!tb) throw new Error('空の行を隠すトグルが見つからない');
      await page.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2);
      await page.waitForTimeout(1500);
    }
    const applied = await page.evaluate(() => ({
      mil: document.documentElement.classList.contains('theme-military'),
      shell: !!document.querySelector('[data-app-shell].milspec-app'),
      sheet: !!document.querySelector('[data-sheet-cols]'),
    }));
    if (applied.sheet !== (VIEW === 'sheet')) throw new Error(`表示モードが意図どおりでない(view=${VIEW}): ${JSON.stringify(applied)}`);
    if (theme === 'military' ? !(applied.mil && applied.shell) : applied.mil) {
      throw new Error(`テーマが意図どおり適用されていない(theme=${theme}): ${JSON.stringify(applied)}`);
    }
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.waitForTimeout(500); // 低速化後の沈静化
    const setup = await page.evaluate(() => {
      const c = document.querySelector('.timeline-scroll-container');
      return {
        rows: document.querySelectorAll('[data-time-row]').length,
        scrollH: c ? c.scrollHeight : 0, clientH: c ? c.clientHeight : 0,
        scrollW: c ? c.scrollWidth : 0, clientW: c ? c.clientWidth : 0,
        cls: document.documentElement.className,
      };
    });
    if (!setup.scrollH || setup.rows < MIN_ROWS || (AXIS === 'x' && setup.scrollW <= setup.clientW + 20)) throw new Error(`fixture 不成立: ${JSON.stringify(setup)}`);
    const rafRun = (dur) => page.evaluate(({ dur, speed, axis }) => new Promise((resolve) => {
      const c = /** @type {HTMLElement} */ (document.querySelector('.timeline-scroll-container'));
      const horiz = axis === 'x';
      const max = horiz ? c.scrollWidth - c.clientWidth : c.scrollHeight - c.clientHeight;
      // 横は動ける距離に比例させ 1 往復 = 2 秒に固定(縦は従来どおり一定速度)
      const spd = horiz ? max : speed;
      if (horiz) c.scrollLeft = 0; else c.scrollTop = 0;
      const out = [];
      const lt = [];
      const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push(e.duration); });
      try { po.observe({ entryTypes: ['longtask'] }); } catch { /* 非対応 */ }
      let last = 0, t0 = 0;
      const loop = (ts) => {
        if (!t0) t0 = ts;
        if (last) out.push(ts - last);
        last = ts;
        const el = ts - t0;
        // 往復(三角波)で一定速度
        const d = (el / 1000) * spd, cyc = d % (2 * max);
        const pos = cyc < max ? cyc : 2 * max - cyc;
        if (horiz) c.scrollLeft = pos; else c.scrollTop = pos;
        if (el < dur) requestAnimationFrame(loop); else setTimeout(() => { po.takeRecords().forEach((e) => lt.push(e.duration)); po.disconnect(); resolve({ out, lt }); }, 100);
      };
      requestAnimationFrame(loop);
    }), { dur, speed: SPEED_PX_PER_S, axis: AXIS });
    const wheelLoop = async (dur) => {
      let dir = 1, maxPos = 0;
      const t0 = Date.now();
      let flip = t0;
      while (Date.now() - t0 < dur) {
        if (Date.now() - flip > 400) {
          dir = -dir; flip = Date.now();
          maxPos = Math.max(maxPos, await page.evaluate((axis) => { const c = document.querySelector('.timeline-scroll-container'); return axis === 'x' ? c.scrollLeft : c.scrollTop; }, AXIS));
        }
        await page.mouse.wheel(0, dir * 15);
        await page.waitForTimeout(16);
      }
      return maxPos;
    };
    if (MODE === 'wheel') {
      const bb0 = await page.locator('.timeline-scroll-container').boundingBox();
      await page.mouse.move(bb0.x + bb0.width / 2, bb0.y + bb0.height / 2);
      if (AXIS === 'x') await page.keyboard.down('Shift');
      await wheelLoop(WARMUP_MS); // 空走(捨てる)
      if (AXIS === 'x') await page.keyboard.up('Shift');
    } else {
      await rafRun(WARMUP_MS); // 空走(捨てる)
    }
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(200);
    if (withTrace) await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc'] });
    let frames, lt;
    if (MODE === 'wheel') {
      await page.evaluate((axis) => {
        const c = /** @type {HTMLElement} */ (document.querySelector('.timeline-scroll-container'));
        if (axis === 'x') c.scrollLeft = 0; else c.scrollTop = 0;
        const out = [], ltl = [];
        const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) ltl.push(e.duration); });
        try { po.observe({ entryTypes: ['longtask'] }); } catch { /* 非対応 */ }
        let last = 0, go = true;
        const loop = (ts) => { if (last) out.push(ts - last); last = ts; if (go) requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
        window.__rec = { stop: () => { go = false; po.takeRecords().forEach((e) => ltl.push(e.duration)); po.disconnect(); return { out, lt: ltl }; } };
      }, AXIS);
      if (AXIS === 'x') await page.keyboard.down('Shift');
      const maxPos = await wheelLoop(DURATION_MS);
      if (AXIS === 'x') await page.keyboard.up('Shift');
      if (maxPos < 20) throw new Error(`ホイールで動いていない(最大位置 ${maxPos}px)`);
      await page.waitForTimeout(100);
      ({ out: frames, lt } = await page.evaluate(() => window.__rec.stop()));
    } else ({ out: frames, lt } = await rafRun(DURATION_MS));
    const trace = withTrace ? summarizeTrace(await browser.stopTracing()) : undefined;
    if (frames.length < MIN_FRAMES) throw Object.assign(new Error(`測定不成立: 測れたコマ数 ${frames.length} < ${MIN_FRAMES}`), { tooFew: true });
    const s = [...frames].sort((a, b) => a - b);
    const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
    return {
      setup, n: frames.length, mean: frames.reduce((a, b) => a + b, 0) / frames.length,
      ltCount: lt.length, blocked: lt.reduce((a, d) => a + Math.max(0, d - 50), 0), p50: q(0.5), p95: q(0.95),
      over: frames.filter((f) => f > 16.9).length / frames.length, trace,
    };
  } finally {
    await browser.close();
  }
}

const runs = [];
let discarded = 0;
const printRun = (r, i) => console.log(`run${i + 1}: n=${r.n} p50=${r.p50.toFixed(2)} p95=${r.p95.toFixed(2)} mean=${r.mean.toFixed(1)} lt=${r.ltCount} blocked=${r.blocked.toFixed(0)}ms >16.7(実判定16.9超)=${(r.over * 100).toFixed(1)}% rows=${r.setup.rows} scrollH=${r.setup.scrollH}`);
/** コマ数が MIN_FRAMES 未満の回(止まった回)は捨てて測り直す(捨てた数に数える)。上限を超えたら「測定不成立」で終了。 */
async function measureValid() {
  for (;;) {
    try { return await measureOnce(); } catch (e) {
      if (!e.tooFew || discarded >= MAX_DISCARD) throw e;
      discarded++;
      console.log(`discard: ${e.message} → 測り直し (${discarded}/${MAX_DISCARD})`);
    }
  }
}
for (let i = 0; i < RUNS; i++) {
  const r = await measureValid();
  runs.push(r);
  printRun(r, i);
}
// 外れ値: p95 が中央値の 3 倍を超えた回を捨てて、その回だけ測り直す(上限 MAX_DISCARD 回)
while (discarded < MAX_DISCARD) {
  const med = median(runs.map((r) => r.p95));
  const worst = runs.reduce((a, r) => (r.p95 > a.p95 ? r : a), runs[0]);
  if (worst.p95 <= med * 3) break;
  discarded++;
  console.log(`discard: p95=${worst.p95.toFixed(2)} > 中央値 ${med.toFixed(2)} の 3 倍 → 捨てて測り直し (${discarded}/${MAX_DISCARD})`);
  runs.splice(runs.indexOf(worst), 1);
  const r = await measureValid();
  runs.push(r);
  printRun(r, runs.length - 1);
}
let traceRun = null;
if (args.trace) {
  try { traceRun = (await measureOnce(true)).trace ?? null; console.log(`trace: ${JSON.stringify(traceRun)}`); } catch (e) { console.log(`trace 取得失敗: ${e.message}`); }
}
const result = {
  theme, cpu: CPU, viewport: `1489x679@${DSR}x`, ...(NONDEFAULT ? { axis: AXIS, dsr: DSR, view: VIEW, dataset: DATASET, mode: MODE } : {}), ...(traceRun ? { trace: traceRun } : {}), runs: RUNS, ...(discarded ? { discarded } : {}), durationMs: DURATION_MS, speedPxPerS: SPEED_PX_PER_S,
  p50: median(runs.map((r) => r.p50)), p95: median(runs.map((r) => r.p95)), over: median(runs.map((r) => r.over)),
  mean: median(runs.map((r) => r.mean)), ltCount: median(runs.map((r) => r.ltCount)), blocked: median(runs.map((r) => r.blocked)),
  p95Spread: Math.max(...runs.map((r) => r.p95)) - Math.min(...runs.map((r) => r.p95)),
};
console.log(`MEDIAN ${theme} cpu${CPU}x${NONDEFAULT ? ` [axis=${AXIS} dsr=${DSR} view=${VIEW} dataset=${DATASET} mode=${MODE}]` : ''}: mean=${result.mean.toFixed(1)}ms longtasks=${result.ltCount} blocked=${result.blocked.toFixed(0)}ms p50=${result.p50.toFixed(2)}ms p95=${result.p95.toFixed(2)}ms >16.7ms=${(result.over * 100).toFixed(1)}% (p95 spread ${result.p95Spread.toFixed(2)})${discarded ? ` discarded=${discarded}` : ''}`);

if (typeof args.save === 'string') {
  fs.mkdirSync(perfDir, { recursive: true });
  fs.writeFileSync(path.join(perfDir, `${args.save}.json`), JSON.stringify({ ...result, runsDetail: runs }, null, 2));
  console.log(`saved ${args.save}`);
}
if (typeof args.compare === 'string') {
  const bf = path.join(perfDir, `${args.compare}.json`);
  if (!fs.existsSync(bf)) { console.error(`基準ファイルがありません: ${bf}(先に --save=${args.compare} で保存)`); process.exit(2); }
  const base = JSON.parse(fs.readFileSync(bf, 'utf8'));
  const diffs = [['theme', base.theme, result.theme], ['viewport', base.viewport, result.viewport],
    ['speedPxPerS', base.speedPxPerS, result.speedPxPerS], ['cpu', base.cpu, result.cpu],
    ['axis', base.axis ?? 'y', AXIS], ['dsr', base.dsr ?? 1, DSR], ['view', base.view ?? 'lanes', VIEW],
    ['dataset', base.dataset ?? 'synthetic', DATASET], ['mode', base.mode ?? 'raf', MODE]].filter(([, a, b]) => a !== b);
  if (diffs.length) {
    console.error(`基準と測定条件が違うため比較できません: ${diffs.map(([k, a, b]) => `${k}(基準=${a} / 今回=${b})`).join(', ')}`);
    process.exit(2);
  }
  const ratio = result.p95 / base.p95 - 1;
  const bRatio = base.blocked > 0 ? result.blocked / base.blocked - 1 : (result.blocked > 50 ? 1 : 0);
  console.log(`compare ${args.compare}: p95 ${base.p95.toFixed(2)}->${result.p95.toFixed(2)} (${(ratio * 100).toFixed(1)}%) blocked ${base.blocked.toFixed(0)}->${result.blocked.toFixed(0)}ms (${(bRatio * 100).toFixed(1)}%)`);
  // 1 コマは 16.7ms 刻み: p95 は「2 コマ(33.4ms)以上」かつ 10% 超、ブロックは「100ms 以上」かつ 10% 超のときだけ悪化とみなす
  const p95Bad = ratio > THRESHOLD && result.p95 - base.p95 >= 33.3;
  const blockedBad = bRatio > THRESHOLD && result.blocked - base.blocked >= 100;
  if (p95Bad || blockedBad) { console.error('FAIL: p95 または総ブロック時間が 10% 超悪化'); process.exit(1); }
  console.log('OK');
}
