// @ts-check
/**
 * 表の縦スクロール性能の計測(基準取り)。
 * 使い方: SP2_BASE_URL=http://localhost:4173 node scripts/milspec-polish/scroll-perf.mjs \
 *           [--theme=standard|military] [--save=<name>] [--compare=<name>]
 * 本番ビルド(npm run build → npx vite preview --port 4173 --strictPort)で測る。dev では測らない。
 * 条件: 1489×679 / deviceScaleFactor 1 / 300 行超(1・2・3 段混在)/ 3 秒 × 3 回の中央値。
 * 結果は scripts/milspec-polish/.perf/<name>.json(コミットしない)。
 * --compare は基準より p95 が 10% 以上悪化したら exit 1。
 * 注: dev の store 注入(applyFixture)は本番ビルドで動かないため、localStorage 注入で表を作る。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, gotoMiti } from '../milspec-sp2/_fixture.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const theme = args.theme === 'military' ? 'military' : 'standard';
const RUNS = 5;
const DURATION_MS = 3000;
const SPEED_PX_PER_S = 900;
const THRESHOLD = 0.1;
const perfDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '.perf');

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

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function measureOnce() {
  const { browser, page } = await launch({ theme: 'dark', viewport: { width: 1489, height: 679 } });
  try {
    await page.addInitScript(({ storage, military }) => {
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, JSON.stringify(v));
      if (military) {
        localStorage.setItem('theme-storage', JSON.stringify({
          state: { theme: 'dark', themeStyle: 'military', contentLanguage: 'ja', mobileEffectBarMode: 'icon' }, version: 2,
        }));
      }
    }, { storage, military: theme === 'military' });
    await gotoMiti(page);
    const setup = await page.evaluate(() => {
      const c = document.querySelector('.timeline-scroll-container');
      return {
        rows: document.querySelectorAll('[data-time-row]').length,
        scrollH: c ? c.scrollHeight : 0, clientH: c ? c.clientHeight : 0,
        cls: document.documentElement.className,
      };
    });
    if (!setup.scrollH || setup.rows < 300) throw new Error(`fixture 不成立: ${JSON.stringify(setup)}`);
    const frames = await page.evaluate(({ dur, speed }) => new Promise((resolve) => {
      const c = /** @type {HTMLElement} */ (document.querySelector('.timeline-scroll-container'));
      const max = c.scrollHeight - c.clientHeight;
      c.scrollTop = 0;
      const out = [];
      let last = 0, t0 = 0;
      const loop = (ts) => {
        if (!t0) t0 = ts;
        if (last) out.push(ts - last);
        last = ts;
        const el = ts - t0;
        // 往復(三角波)で一定速度
        const d = (el / 1000) * speed, cyc = d % (2 * max);
        c.scrollTop = cyc < max ? cyc : 2 * max - cyc;
        if (el < dur) requestAnimationFrame(loop); else resolve(out);
      };
      requestAnimationFrame(loop);
    }), { dur: DURATION_MS, speed: SPEED_PX_PER_S });
    const s = [...frames].sort((a, b) => a - b);
    const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
    return {
      setup, n: frames.length, p50: q(0.5), p95: q(0.95),
      over: frames.filter((f) => f > 16.9).length / frames.length,
    };
  } finally {
    await browser.close();
  }
}

const runs = [];
for (let i = 0; i < RUNS; i++) {
  const r = await measureOnce();
  runs.push(r);
  console.log(`run${i + 1}: n=${r.n} p50=${r.p50.toFixed(2)} p95=${r.p95.toFixed(2)} >16.7(実判定16.9超)=${(r.over * 100).toFixed(1)}% rows=${r.setup.rows} scrollH=${r.setup.scrollH}`);
}
const result = {
  theme, viewport: '1489x679@1x', runs: RUNS, durationMs: DURATION_MS, speedPxPerS: SPEED_PX_PER_S,
  p50: median(runs.map((r) => r.p50)), p95: median(runs.map((r) => r.p95)), over: median(runs.map((r) => r.over)),
  p95Spread: Math.max(...runs.map((r) => r.p95)) - Math.min(...runs.map((r) => r.p95)),
};
console.log(`MEDIAN ${theme}: p50=${result.p50.toFixed(2)}ms p95=${result.p95.toFixed(2)}ms >16.7ms=${(result.over * 100).toFixed(1)}% (p95 spread ${result.p95Spread.toFixed(2)})`);

if (typeof args.save === 'string') {
  fs.mkdirSync(perfDir, { recursive: true });
  fs.writeFileSync(path.join(perfDir, `${args.save}.json`), JSON.stringify({ ...result, runsDetail: runs }, null, 2));
  console.log(`saved ${args.save}`);
}
if (typeof args.compare === 'string') {
  const base = JSON.parse(fs.readFileSync(path.join(perfDir, `${args.compare}.json`), 'utf8'));
  const ratio = result.p95 / base.p95 - 1;
  console.log(`compare ${args.compare}: base p95=${base.p95.toFixed(2)} now=${result.p95.toFixed(2)} (${(ratio * 100).toFixed(1)}%)`);
  if (ratio >= THRESHOLD) { console.error('FAIL: p95 が 10% 以上悪化'); process.exit(1); }
  console.log('OK');
}
