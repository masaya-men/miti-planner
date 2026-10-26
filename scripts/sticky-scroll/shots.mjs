// @ts-check
/**
 * 軽減表の画面写真(横スクロール計画 §4 の [写] 項目・§10 段階 0-2)。アプリのコードは変えない。
 *
 * 使い方(README.md に詳細):
 *   node scripts/sticky-scroll/shots.mjs --out=baseline            撮る(tolerance.json が無ければ同じ画面を 3 回撮って許容を決める)
 *   node scripts/sticky-scroll/shots.mjs --out=after --compare=baseline
 *   他: --calibrate(許容を撮り直す) --only=<文字>(条件 id に含まれる文字で絞る) --jobs=N --list
 *
 * 結果: scripts/sticky-scroll/.baseline/shots/<out>/<条件id>/<写真名>.png(git に入れない)
 * 許容: scripts/sticky-scroll/.baseline/tolerance.json
 * 計測先: REGRESS_BASE_URL(既定 http://localhost:5173)。表のデータと切替の作法は regress.mjs と同じ。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { launch, EVENT_FIXTURE, PHASE_FIXTURE, PARTY_FIXTURE, MITIGATION_FIXTURE } from '../milspec-sp2/_fixture.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.join(HERE, '.baseline');
const SHOTS_DIR = path.join(BASE_DIR, 'shots');
const TOL_FILE = path.join(BASE_DIR, 'tolerance.json');
const BASE_URL = process.env.REGRESS_BASE_URL || 'http://localhost:5173';
const OUT = typeof args.out === 'string' ? args.out : 'after';
const COMPARE = typeof args.compare === 'string' ? args.compare : null;
const ONLY = typeof args.only === 'string' ? args.only : null;
/** 検出力の確認用(--inject-css=<file>): 撮影時に CSS を足す。使い捨て・普段は使わない。 */
const INJECT_CSS = typeof args['inject-css'] === 'string' ? fs.readFileSync(args['inject-css'], 'utf8') : null;
const JOBS = Number(args.jobs) || 3;
const FLOOR_RATIO = 0.0005; // 許容の下限 = 全画素の 0.05%
const MIN_BLOCKS = 10; // 小さい切り出しでは 0.05% が数ブロックになり厳しすぎるので、ブロック数の下限も置く
const MARGIN = 1.5; // 同じ画面を 3 回撮った 3 通りの差の最大値 × 1.5
const BLOCK = 8; // 差を数えるブロックの一辺(画素)
const BLOCK_MEAN = 6; // ブロック内の平均の色差(各画素の RGB 最大差)がこれを超えたら「違うブロック」

// ───────────────────────────── 条件 ─────────────────────────────
const VPS = [
  { id: '1489', w: 1489, h: 679, dsf: 2.58 },
  { id: '1920', w: 1920, h: 1080, dsf: 2 },
  { id: '2560', w: 2560, h: 1440, dsf: 1 },
];
const THEMES = [
  { id: 'standard-dark', style: 'standard', mode: 'dark' },
  { id: 'standard-light', style: 'standard', mode: 'light' },
  { id: 'military-dark', style: 'military', mode: 'dark' },
  { id: 'military-light', style: 'military', mode: 'light' },
];
/** 全部撮る条件: 画面 3 × テーマ 4 × 表示 2 × 8 人 = 24。状態違いの写真(hover など)は 1489・1920 の 8 人だけ。 */
const CONDS = [];
for (const vp of VPS) for (const theme of THEMES) for (const view of ['lanes', 'sheet']) {
  CONDS.push({ id: `${vp.id}-${theme.id}-${view}-8p`, vp, theme, view, party: 8, kind: 'desktop' });
}
// 4 人(横に短い・B9.2)は 2560 の 4 テーマ × 2 表示。ページ全体だけ
for (const theme of THEMES) for (const view of ['lanes', 'sheet']) {
  CONDS.push({ id: `2560-${theme.id}-${view}-4p`, vp: VPS[2], theme, view, party: 4, kind: 'desktop' });
}
// スマホ(B8)
for (const theme of THEMES) {
  CONDS.push({ id: `mobile-390-${theme.id}`, vp: { id: 'mobile', w: 390, h: 844, dsf: 3 }, theme, view: 'lanes', party: 8, kind: 'mobile' });
}

// ───────────────────────────── 表のデータ(regress.mjs と同じ) ─────────────────────────────
const ROLES = { MT: 'tank', ST: 'tank', H1: 'healer', H2: 'healer', D1: 'dps', D2: 'dps', D3: 'dps', D4: 'dps' };
const STATS = { hp: 186846, mainStat: 6217, det: 2410, crt: 420, ten: 420, ss: 420, wd: 154 };
const mkEvent = (id, time, target, i) => ({ id, time, name: { ja: `攻撃 ${i}`, en: `Attack ${i}` }, damageType: 'magical', damageAmount: 120000, target });
const EVENTS = [mkEvent('rg-ev-a', 4, 'AoE', 100), mkEvent('rg-ev-b', 10, 'MT', 101), ...EVENT_FIXTURE.map((e, i) => ({ ...e, id: `rg-ev${i}`, target: 'AoE' }))];
const PHASES = PHASE_FIXTURE.map((p, i) => ({ ...p, id: `rg-ph${i + 1}` }));
const MEMOS = [
  { id: 'rg-memo-1', text: 'メモ1', timeSec: 51, xRatio: 0.6, createdAt: 1, updatedAt: 1 },
  { id: 'rg-memo-2', text: 'メモ2', timeSec: 87, xRatio: 0.85, createdAt: 2, updatedAt: 2 },
  { id: 'rg-memo-3', text: 'メモ3', timeSec: 123, xRatio: 0.66, createdAt: 3, updatedAt: 3 },
];
function buildStorage(cond, over = {}) {
  const four = cond.party === 4;
  const members = PARTY_FIXTURE.map(([id, jobId]) => ({ id, jobId, role: ROLES[id], stats: STATS, computedValues: {} }));
  const mits = MITIGATION_FIXTURE.map((m) => ({ ...m }));
  return {
    'mitigation-storage': {
      state: {
        currentLevel: 100, timelineEvents: EVENTS, timelineMitigations: mits, phases: PHASES, labels: [],
        partyMembers: members, schAetherflowPatterns: {}, aaSettings: { damage: 0, type: 'magical', target: 'MT' },
        myMemberId: null, myJobHighlight: false, hideEmptyRows: true, showRowBorders: false, timelineSortOrder: 'light_party',
        hiddenPartyMemberIds: four ? ['ST', 'H2', 'D2', 'D4'] : [], memos: MEMOS.map((m) => ({ ...m })), progress: { points: [], cleared: false }, _loadedPlanId: null,
        ...over,
      },
      version: 4,
    },
    'plan-storage': { state: { plans: [], currentPlanId: 'rg-debug', lastActivePlanId: null, _dirtyPlanIds: [], _deletedPlanIds: [] }, version: 2 },
  };
}

// ───────────────────────────── ページ操作 ─────────────────────────────
async function openPage(cond, over = {}) {
  const { browser, page } = await launch({ theme: cond.theme.mode, viewport: { width: cond.vp.w, height: cond.vp.h }, dsf: cond.vp.dsf, motion: 'reduce' });
  await page.addInitScript(({ storage, theme, view }) => {
    try {
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, JSON.stringify(v));
      localStorage.setItem('theme-storage', JSON.stringify({
        state: { theme: theme.mode, themeStyle: theme.style, contentLanguage: 'ja', mobileEffectBarMode: 'icon', timelineView: view }, version: 3,
      }));
    } catch { /* 無視 */ }
  }, { storage: buildStorage(cond, over), theme: cond.theme, view: cond.view });
  await page.goto(`${BASE_URL}/miti`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('[data-time-row]').length > 3, null, { timeout: 30000 });
  await page.waitForTimeout(cond.theme.style === 'military' ? 2200 : 1200);
  const ok = await page.evaluate(() => ({
    mil: document.documentElement.classList.contains('theme-military'),
    light: document.documentElement.classList.contains('theme-light'),
    noPlan: !!document.querySelector('.no-plan'),
    sheet: !!document.querySelector('[data-sheet-cols]'),
  }));
  if (ok.mil !== (cond.theme.style === 'military')) throw new Error(`テーマ不一致: ${JSON.stringify(ok)} / ${cond.id}`);
  if (ok.light !== (cond.theme.mode === 'light')) throw new Error(`明暗不一致: ${JSON.stringify(ok)} / ${cond.id}`);
  if (ok.noPlan) throw new Error(`no-plan のまま / ${cond.id}`);
  if (cond.kind === 'desktop' && ok.sheet !== (cond.view === 'sheet')) throw new Error(`表示モード不一致: ${JSON.stringify(ok)} / ${cond.id}`);
  return { browser, page };
}

/** 動きを止める: 有限のアニメは終点へ・無限のものは 0 で停止・transition 無効・video は 0 秒で停止。 */
async function freeze(page) {
  if (INJECT_CSS) await page.addStyleTag({ content: INJECT_CSS });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;caret-color:transparent!important}.milspec-drums,.milspec-dtg-txt{visibility:hidden!important}' /* MIL-SPEC 見出しの実時刻の表示(日時の数字)は毎回変わるので隠す */ });
  await page.evaluate(async () => {
    for (const a of document.getAnimations()) {
      try {
        const it = a.effect?.getComputedTiming().iterations;
        if (it === Infinity) { a.pause(); a.currentTime = 0; } else a.finish();
      } catch { try { a.pause(); } catch { /* 無視 */ } }
    }
    for (const v of document.querySelectorAll('video')) {
      v.pause();
      try { v.currentTime = 0; await new Promise((r) => { const t = setTimeout(r, 1500); v.addEventListener('seeked', () => { clearTimeout(t); r(undefined); }, { once: true }); }); } catch { /* 無視 */ }
    }
  });
  await page.waitForTimeout(250);
}

const rectOf = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, sel);

/** 見出し+ボタンの欄(controls+header)の帯。 */
async function topClip(page, cond) {
  const r = await page.evaluate(() => {
    const a = document.querySelector('#timeline-controls-inner')?.parentElement;
    const h = document.querySelector('#timeline-header-inner')?.parentElement;
    if (!a || !h) return null;
    const A = a.getBoundingClientRect(); const H = h.getBoundingClientRect();
    const x = Math.min(A.left, H.left), y = Math.min(A.top, H.top);
    return { x, y, w: Math.max(A.right, H.right) - x, h: Math.max(A.bottom, H.bottom) - y };
  });
  if (!r) return null;
  const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
  return { x, y, width: Math.min(cond.vp.w - x, Math.ceil(r.w)), height: Math.min(cond.vp.h - y, Math.ceil(r.h)) };
}

const toggleExpand = async (page) => {
  const sw = page.locator('button[role="switch"][data-deck="expand"]');
  if (await sw.count()) {
    const before = await sw.first().getAttribute('aria-checked');
    await sw.first().click();
    await page.waitForFunction((w) => document.querySelector('button[role="switch"][data-deck="expand"]')?.getAttribute('aria-checked') === w, before === 'true' ? 'false' : 'true', { timeout: 5000 });
    return;
  }
  await page.getByText(/^(表を展開する|表をたたむ)$/).first().click();
};

/** 1 条件ぶんの写真を全部撮る。@returns {Promise<Record<string, Buffer>>} 名前 → PNG */
async function takeAll(cond) {
  const shots = {};
  const fullCond = cond.party === 8 && cond.kind === 'desktop' && cond.vp.id !== '2560';
  let { browser, page } = await openPage(cond);
  const snap = async (name, opt = {}) => { shots[name] = await page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide', ...opt }); };
  try {
    await freeze(page);
    await snap('page');
    if (cond.kind === 'mobile') return shots;
    const clip = await topClip(page, cond);
    if (clip) await snap('top', { clip });
    // 横バー・縦バーの帯(§8.3 の「浮いて見える」確認用): 入れ物の下端 80px
    const sc = await rectOf(page, '.timeline-scroll-container');
    if (sc) {
      const x = Math.max(0, Math.floor(sc.x)), y = Math.max(0, Math.floor(sc.y + sc.h - 80));
      await snap('scrollbar', { clip: { x, y, width: Math.min(cond.vp.w - x, Math.ceil(sc.w)), height: Math.min(cond.vp.h - y, 80) } });
    }
    if (!fullCond) return shots;
    // B4.1 行のホバー(情報側の機序セル・レーン側のセル)
    for (const [name, sel] of [['hover-info', '[data-time-row="15"] [class*="--col-mechanic-w"]'], ['hover-lane', '[data-time-row="15"] [data-job-col]']]) {
      const r = await rectOf(page, sel);
      if (!r) { console.log(`  警告: ${cond.id} ${name} の対象が無い`); continue; }
      await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
      await page.waitForTimeout(500);
      await freeze(page);
      await snap(name);
    }
    await page.mouse.move(2, 2);
    await page.waitForTimeout(300);
    // B6 表の展開
    await toggleExpand(page);
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const s = document.querySelector('.timeline-scroll-container'); if (s) s.scrollTop = 0; });
    await page.waitForTimeout(500);
    await freeze(page);
    await snap('expanded');
  } finally { await browser.close(); }
  // B4.6 MYジョブの強調(別ページ)
  if (fullCond) {
    ({ browser, page } = await openPage(cond, { myMemberId: 'H1', myJobHighlight: true }));
    try { await freeze(page); await snap('myjob'); } finally { await browser.close(); }
    // B1.5 競合の赤い輪・画面外の競合矢印(矢印は 1920 以上では 465 秒の行も画面内に入り出ない=輪だけ。regress.mjs の conflict と同じ配置。脈動は freeze で 0 秒に止まる)
    ({ browser, page } = await openPage(cond, { timelineMitigations: [
      ...MITIGATION_FIXTURE.map((m) => ({ ...m })),
      { id: 'rg-c1', mitigationId: 'tactician', ownerId: 'D1', time: 465, duration: 15 },
      { id: 'rg-c2', mitigationId: 'tactician', ownerId: 'D1', time: 483, duration: 15 },
      { id: 'rg-c3', mitigationId: 'vengeance', ownerId: 'MT', time: 69, duration: 15 },
    ] }));
    try {
      await freeze(page);
      const n = await page.evaluate(() => ({ ring: document.querySelectorAll('.animate-conflict-pulse').length, arrow: document.querySelectorAll('button[aria-label*="競合あり"]').length }));
      if (!n.ring) throw new Error(`競合の輪が出ない ${JSON.stringify(n)} / ${cond.id}`);
      await snap('conflict');
    } finally { await browser.close(); }
    // B4.5 進捗の記録モード(dev の store で入り、レーンの上に乗せて青い枠を出す)
    ({ browser, page } = await openPage(cond));
    try {
      await page.evaluate(async () => {
        const url = performance.getEntriesByType('resource').map((x) => x.name).find((n) => n.includes('/src/components/progress/useProgressRecording.ts')) || '/src/components/progress/useProgressRecording.ts';
        const m = await import(/* @vite-ignore */ url);
        m.useProgressRecording.getState().startRecordMode();
      });
      await page.waitForTimeout(500);
      const r = await rectOf(page, '[data-time-row="15"] [data-job-col]');
      if (!r) throw new Error(`記録モードの対象行が無い / ${cond.id}`);
      await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
      await page.waitForTimeout(800);
      await freeze(page);
      await snap('record');
    } finally { await browser.close(); }
  }
  return shots;
}

// ───────────────────────────── 画像の差 ─────────────────────────────
/** 2 枚の PNG の違う画素数(各チャンネルの差が CH_THRESHOLD を超えたもの)。大きさが違えば全画素を違いとする。 */
async function diffPng(a, b) {
  const [ra, rb] = await Promise.all([a, b].map((x) => sharp(x).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  const total = ra.info.width * ra.info.height;
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) {
    return { pixels: Math.max(total, rb.info.width * rb.info.height), total, ratio: 1, sizeMismatch: `${ra.info.width}x${ra.info.height} vs ${rb.info.width}x${rb.info.height}` };
  }
  // MIL-SPEC の面には毎回ちがう粒状のノイズがある(同じ画面を撮り直して確認)。画素ごとではなく 8x8 のブロックの平均差で数え、粒を均す。
  const A = ra.data, B = rb.data, W = ra.info.width, H = ra.info.height;
  const bw = Math.ceil(W / BLOCK), bh = Math.ceil(H / BLOCK);
  let n = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let sum = 0, cnt = 0;
    for (let y = by * BLOCK; y < Math.min(H, (by + 1) * BLOCK); y++) for (let x = bx * BLOCK; x < Math.min(W, (bx + 1) * BLOCK); x++) {
      const i = (y * W + x) * 4;
      sum += Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); cnt++;
    }
    if (sum / cnt > BLOCK_MEAN) n++;
  }
  return { pixels: n, total: bw * bh, ratio: n / (bw * bh) };
}

async function pool(items, n, fn) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) { await fn(q.shift()); } }));
}

// ───────────────────────────── 実行 ─────────────────────────────
async function main() {
  const conds = CONDS.filter((c) => !ONLY || c.id.includes(ONLY));
  if (args.list) { for (const c of conds) console.log(c.id); console.log(`${conds.length} 条件`); return 0; }
  if (COMPARE && COMPARE === OUT) { console.log('--out と --compare が同じ名前(比べる元が消える)'); return 1; }
  const outDir = path.join(SHOTS_DIR, OUT);
  fs.rmSync(outDir, { recursive: true, force: true });
  const calibrate = !COMPARE && (args.calibrate || !fs.existsSync(TOL_FILE));
  let tolerance = fs.existsSync(TOL_FILE) ? JSON.parse(fs.readFileSync(TOL_FILE, 'utf8')) : { shots: {} };
  /** @type {Record<string, any>} */
  const calib = {};
  const errors = [];
  let count = 0;
  const t0 = Date.now();

  await pool(conds, JOBS, async (cond) => {
    try {
      const shots = await takeAll(cond);
      const dir = path.join(outDir, cond.id);
      fs.mkdirSync(dir, { recursive: true });
      for (const [name, buf] of Object.entries(shots)) { fs.writeFileSync(path.join(dir, `${name}.png`), buf); count++; }
      if (calibrate) {
        // 3 回撮って、3 通りの組み合わせの差のうち最大を採る(MIL-SPEC の粒状ノイズは回ごとにばらつき 2 回撮りでは許容がぎりぎりだったため)
        const second = await takeAll(cond);
        const third = await takeAll(cond);
        for (const [name, buf] of Object.entries(shots)) {
          if (!second[name] || !third[name]) { errors.push(`${cond.id}/${name}: 2・3 回目に無い`); continue; }
          const ds = [await diffPng(buf, second[name]), await diffPng(buf, third[name]), await diffPng(second[name], third[name])];
          calib[`${cond.id}/${name}`] = ds.reduce((m, d) => (d.ratio > m.ratio ? d : m));
        }
      }
      console.log(`  ok ${cond.id} (${Object.keys(shots).length} 枚)`);
    } catch (e) {
      const msg = e && /** @type {any} */ (e).message ? /** @type {any} */ (e).message : String(e);
      errors.push(`${cond.id}: ${msg}`);
      console.log(`  NG ${cond.id}: ${msg}`);
    }
  });
  console.log(`撮影 ${count} 枚 / ${conds.length} 条件 → ${path.relative(process.cwd(), outDir)} (${Math.round((Date.now() - t0) / 1000)} 秒)`);

  if (calibrate) {
    const shotsTol = {};
    let maxRatio = 0;
    for (const [k, d] of Object.entries(calib)) {
      const ratio = Math.max(d.ratio * MARGIN, FLOOR_RATIO, MIN_BLOCKS / d.total);
      shotsTol[k] = { selfDiffBlocks: d.pixels, selfDiffRatio: d.ratio, tolRatio: ratio, tolBlocks: Math.ceil(ratio * d.total) };
      maxRatio = Math.max(maxRatio, ratio);
    }
    const oldShots = ONLY && tolerance.shots ? tolerance.shots : {}; // --only の撮り直しは、撮っていない写真の許容を消さず混ぜ込む
    const mergedTol = { ...oldShots, ...shotsTol };
    maxRatio = Math.max(...Object.values(mergedTol).map((v) => v.tolRatio));
    tolerance = {
      note: '同じ画面を 3 回撮った 3 通りの差の最大値 x1.5(下限 全体の 0.05% かつ 10 ブロック)。差は 8x8 ブロック単位(平均色差 > 6 を違いと数える)。pixels / total の単位はブロック。',
      marginX: MARGIN, floorRatio: FLOOR_RATIO, block: BLOCK, blockMean: BLOCK_MEAN,
      defaultTolRatio: maxRatio, createdAt: new Date().toISOString(), shots: mergedTol,
    };
    fs.mkdirSync(BASE_DIR, { recursive: true });
    fs.writeFileSync(TOL_FILE, JSON.stringify(tolerance, null, 1));
    const worst = Object.entries(shotsTol).sort((a, b) => b[1].selfDiffRatio - a[1].selfDiffRatio).slice(0, 5);
    console.log(`許容を決めた: ${Object.keys(shotsTol).length} 枚 / 既定 ${(maxRatio * 100).toFixed(4)}% / 撮り直しの差が大きい上位:`);
    for (const [k, v] of worst) console.log(`  ${k}: ${v.selfDiffBlocks} ブロック (${(v.selfDiffRatio * 100).toFixed(4)}%)`);
  }

  let bad = 0;
  if (COMPARE) {
    const cmpDir = path.join(SHOTS_DIR, COMPARE);
    if (!fs.existsSync(cmpDir)) { console.log(`比較元 ${COMPARE} が無い`); return 1; }
    if (!fs.existsSync(TOL_FILE)) { console.log('tolerance.json が無い(先に --out で撮る)'); return 1; }
    let cmpN = 0, maxSeen = 0;
    for (const cond of conds) {
      const dA = path.join(cmpDir, cond.id), dB = path.join(outDir, cond.id);
      const namesA = fs.existsSync(dA) ? fs.readdirSync(dA) : [];
      const namesB = fs.existsSync(dB) ? fs.readdirSync(dB) : [];
      for (const f of new Set([...namesA, ...namesB])) {
        const key = `${cond.id}/${f.replace(/\.png$/, '')}`;
        if (!namesA.includes(f) || !namesB.includes(f)) { console.log(`  差 ${key}: 片方に無い`); bad++; continue; }
        const d = await diffPng(fs.readFileSync(path.join(dA, f)), fs.readFileSync(path.join(dB, f)));
        const t = tolerance.shots[key]?.tolRatio ?? tolerance.defaultTolRatio;
        cmpN++; maxSeen = Math.max(maxSeen, d.ratio);
        if (d.ratio > t) { bad++; console.log(`  差 ${key}: ${d.pixels} ブロック (${(d.ratio * 100).toFixed(4)}%) > 許容 ${(t * 100).toFixed(4)}%${d.sizeMismatch ? ' 大きさ違い ' + d.sizeMismatch : ''}`); }
      }
    }
    if (cmpN === 0) { console.log('比べた写真が 0 枚(条件の指定か比較元を確認)'); return 1; }
    console.log(`比較 ${cmpN} 枚: 許容外 ${bad} 枚 / 最大の差 ${(maxSeen * 100).toFixed(4)}%`);
  }
  if (errors.length) { console.log(`失敗 ${errors.length} 件:`); for (const e of errors) console.log('  ' + e); return 2; }
  return bad ? 1 : 0;
}
process.exit(await main());
