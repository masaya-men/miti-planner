// @ts-check
/**
 * 軽減表の「見出しと本文の同時移動」検出(横スクロール計画 §5.3・§10 段階 0-3)。アプリのコードは変えない・測るだけ。
 *
 * 何を測るか: 横スクロール中、見出しの最初のメンバー列の左端と、本文の最初のメンバー列の左端が、
 *   「同じコマの中で」止まっている時と同じ距離を保っているか。見出し側は 2 つの帯(ボタンの欄のジョブ選択の行 / 見出しのリキャスト欄)を別々に測る。1 拍遅れていると、動いている間のコマで距離がずれる。
 *
 * 使い方(README.md にも書いた):
 *   node scripts/sticky-scroll/frame-sync.mjs --mode=all                 (既定: chromium・画面コマ方式)
 *   node scripts/sticky-scroll/frame-sync.mjs --mode=wheel|thumb|key
 *   node scripts/sticky-scroll/frame-sync.mjs --mode=all --expect-zero   (ずれたコマが 1 つでもあれば exit 1)
 *   node scripts/sticky-scroll/frame-sync.mjs --browser=webkit|firefox   (screencast が使えない → rAF 二点サンプリング)
 *   他: --selector-header=<css>(既定 #timeline-controls-inner [data-member-id])  --selector-header2=<css|none>(既定 #timeline-header-inner .recast-cell)
 *       --selector-body=<css>(目印を付ける要素。最初の 1 つの左端を測る。Task 10 以降の DOM に差し替える用)
 *       --method=screencast|raf  --vp=1489|1920|2560  --theme=standard-dark|standard-light|military-dark|military-light
 *       --view=lanes|sheet  --party=8|4  --out=<名前>  --keep-frames
 *
 * 方式:
 *   screencast(chromium 既定): CDP Page.startScreencast で動いている間の全コマを取り、コマの絵の中から目印の x を読む。
 *     目印 = 試験用 CSS(page.addStyleTag・アプリのコードには入れない)で、見出し側のメンバー列(各帯)に洋紅(#f0f)、
 *     本文のメンバー列(全行)に水色(#0ff)の 3px の縁(outline・レイアウトに影響しない)を付ける。
 *     コマは DSR に関わらず CSS px 等倍(1489×679)で届くので、x の分解能は約 1 CSS px(止まっている時のコマは d が一定)。
 *     コマの画素を何行か走査し、洋紅/水色の最初の帯の重心を x(CSS px)にする。2 つの x の差 d をコマごとに出し、
 *     止まっている時のコマの d(d0)との差が 0.5px を超えたコマを「ずれたコマ」とする。
 *   raf(webkit/firefox の既定・--method=raf で chromium でも可): requestAnimationFrame の中の同じコマで
 *     見出し側と本文側の目印の getBoundingClientRect().left を読んで差を取る。
 *     注意: rAF の呼び出し順はアプリの rAF との登録順に依存し、合成(コンポジタ)だけで動く部分は見えない。
 *     画面に出たコマそのものを見る screencast より検出力が低い: コンポジタ側だけで進むスクロール(つまみ・矢印キー)の
 *     1 拍遅れは見えない(chromium で rAF にしても「ずれなし」になる)。webkit/firefox の「ずれなし」は弱い証拠。
 *
 * 動かし方 3 通り: wheel(Shift+ホイールの小刻み)/ thumb(スクロールバーのつまみのドラッグ)/ key(→← の押しっぱなし)。
 * 結果は scripts/sticky-scroll/.baseline/frame-sync-<out>.json(git に入れない)。
 * 終了コード: 0=成功 / 1=--expect-zero でずれたコマあり / 2=測定そのものが成立しなかった(コマが取れない等)。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, firefox } from 'playwright';
import sharp from 'sharp';
import { EVENT_FIXTURE, PHASE_FIXTURE, PARTY_FIXTURE, MITIGATION_FIXTURE } from '../milspec-sp2/_fixture.mjs';

// ───────────────────────────── 引数 ─────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.join(HERE, '.baseline');
const BASE_URL = process.env.REGRESS_BASE_URL || 'http://localhost:5173';
const str = (k, d) => (typeof args[k] === 'string' ? args[k] : d);
const MODE = str('mode', 'all');
const BROWSER = str('browser', 'chromium');
const METHOD = str('method', BROWSER === 'chromium' ? 'screencast' : 'raf');
const VP_ID = str('vp', '1489');
const THEME_ID = str('theme', 'standard-dark');
const VIEW = str('view', 'lanes');
const PARTY = Number(str('party', '8'));
const OUT = str('out', 'last');
const EXPECT_ZERO = !!args['expect-zero'];
/** 見出し側の目印は 2 つの帯: ボタンの欄の中のジョブ選択の行(controls)と、見出しの中のリキャスト欄(header)。どちらも transform で動く。 */
const SEL_HEADER = str('selector-header', '#timeline-controls-inner [data-member-id]');
const SEL_HEADER2 = str('selector-header2', '#timeline-header-inner .recast-cell');
const HEADERS = [{ id: 'controls', sel: SEL_HEADER }, ...(SEL_HEADER2 === 'none' ? [] : [{ id: 'header', sel: SEL_HEADER2 }])];
const SEL_BODY = str('selector-body', VIEW === 'sheet' ? '.timeline-scroll-container [data-time-row] [data-sheet-cols]' : '.timeline-scroll-container [data-time-row] [data-job-col]');
/** ずれたコマの判定(px)。合格させるために動かさない。 */
const THRESH = 0.5;

const VPS = { '1489': { w: 1489, h: 679, dsf: 2.58 }, '1920': { w: 1920, h: 1080, dsf: 2 }, '2560': { w: 2560, h: 1440, dsf: 1 } };
const THEMES = {
  'standard-dark': { style: 'standard', mode: 'dark' }, 'standard-light': { style: 'standard', mode: 'light' },
  'military-dark': { style: 'military', mode: 'dark' }, 'military-light': { style: 'military', mode: 'light' },
};
const vp = VPS[VP_ID];
const theme = THEMES[THEME_ID];
if (!vp || !theme) { console.error(`--vp / --theme が不正: ${VP_ID} / ${THEME_ID}`); process.exit(2); }
const MODES = MODE === 'all' ? ['wheel', 'thumb', 'key'] : [MODE];
if (!MODES.every((m) => ['wheel', 'thumb', 'key'].includes(m))) { console.error(`--mode は wheel|thumb|key|all: ${MODE}`); process.exit(2); }

/** 1 通りの測定の上限(ms)。ブラウザが固まっても全体が止まらないように */
const MODE_TIMEOUT = 120000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────────── 表のデータ(regress.mjs と同じ決定的な 8 人) ─────────────────────────────
const ROLES = { MT: 'tank', ST: 'tank', H1: 'healer', H2: 'healer', D1: 'dps', D2: 'dps', D3: 'dps', D4: 'dps' };
const STATS = { hp: 186846, mainStat: 6217, det: 2410, crt: 420, ten: 420, ss: 420, wd: 154 };
const mkEvent = (id, time, target, i) => ({ id, time, name: { ja: `攻撃 ${i}`, en: `Attack ${i}` }, damageType: 'magical', damageAmount: 120000, target });
const EVENTS = [mkEvent('rg-ev-a', 4, 'AoE', 100), mkEvent('rg-ev-b', 10, 'MT', 101), ...EVENT_FIXTURE.map((e, i) => ({ ...e, id: `rg-ev${i}`, target: 'AoE' }))];
const PHASES = PHASE_FIXTURE.map((p, i) => ({ ...p, id: `rg-ph${i + 1}` }));
function buildStorage() {
  const four = PARTY === 4;
  const members = PARTY_FIXTURE.map(([id, jobId]) => ({ id, jobId, role: ROLES[id], stats: STATS, computedValues: {} }));
  return {
    'mitigation-storage': {
      state: {
        currentLevel: 100, timelineEvents: EVENTS, timelineMitigations: MITIGATION_FIXTURE.map((m) => ({ ...m })), phases: PHASES, labels: [],
        partyMembers: members, schAetherflowPatterns: {}, aaSettings: { damage: 0, type: 'magical', target: 'MT' },
        myMemberId: null, myJobHighlight: false, hideEmptyRows: true, showRowBorders: false, timelineSortOrder: 'light_party',
        hiddenPartyMemberIds: four ? ['ST', 'H2', 'D2', 'D4'] : [], memos: [], progress: { points: [], cleared: false }, _loadedPlanId: null,
      },
      version: 4,
    },
    'plan-storage': { state: { plans: [], currentPlanId: 'rg-debug', lastActivePlanId: null, _dirtyPlanIds: [], _deletedPlanIds: [] }, version: 2 },
  };
}

// ───────────────────────────── ページを開く ─────────────────────────────
async function openPage() {
  const type = { chromium, webkit, firefox }[BROWSER];
  if (!type) throw new Error(`--browser は chromium|webkit|firefox: ${BROWSER}`);
  // headless の Chromium は既定で --hide-scrollbars が付く=つまみが無い。つまみのドラッグを再現するため外す。
  const browser = await type.launch(BROWSER === 'chromium' ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {});
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dsf,
    colorScheme: theme.mode === 'light' ? 'light' : 'dark', reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const storage = buildStorage();
  await page.addInitScript(({ storage, theme, view }) => {
    try {
      localStorage.setItem('tutorial-storage', JSON.stringify({ state: { hasCompleted: true, hasVisitedShare: true, isActive: false }, version: 0 }));
      localStorage.setItem('lopo_mobile_guide_completed', 'true');
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, JSON.stringify(v));
      localStorage.setItem('theme-storage', JSON.stringify({
        state: { theme: theme.mode, themeStyle: theme.style, contentLanguage: 'ja', mobileEffectBarMode: 'icon', timelineView: view }, version: 3,
      }));
    } catch { /* 無視 */ }
  }, { storage, theme, view: VIEW });
  await page.goto(`${BASE_URL}/miti`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('[data-time-row]').length > 3, null, { timeout: 60000 });
  await page.waitForTimeout(theme.style === 'military' ? 2200 : 1200);
  const ok = await page.evaluate(() => ({
    mil: document.documentElement.classList.contains('theme-military'), light: document.documentElement.classList.contains('theme-light'),
    noPlan: !!document.querySelector('.no-plan'), sheet: !!document.querySelector('[data-sheet-cols]'),
  }));
  if (ok.mil !== (theme.style === 'military')) throw new Error(`テーマ不一致: ${JSON.stringify(ok)}`);
  if (ok.light !== (theme.mode === 'light')) throw new Error(`明暗不一致: ${JSON.stringify(ok)}`);
  if (ok.noPlan) throw new Error('no-plan のまま(表が出ていない)');
  if (ok.sheet !== (VIEW === 'sheet')) throw new Error(`表示モード不一致: ${JSON.stringify(ok)}`);
  // 試験用の目印(アプリのコードには入れない)。outline は寸法に影響しない
  await page.addStyleTag({
    content: `${HEADERS.map((h) => h.sel).join(',')}{outline:3px solid #f0f !important;outline-offset:-3px !important}
${SEL_BODY}{outline:3px solid #0ff !important;outline-offset:-3px !important}`,
  });
  await page.waitForTimeout(300);
  return { browser, context, page };
}

/** ページ内の道具(目印の x の読み取り・rAF サンプラー)。 */
const PAGE_TOOLS = ({ selHs, selB }) => {
  const scEl = () => document.querySelector('.timeline-scroll-container');
  /** 本文側: スクロールの入れ物の縦範囲に見えている最初の目印 */
  const bodyEl = () => {
    const sc = scEl(); const r = sc.getBoundingClientRect();
    for (const e of document.querySelectorAll(selB)) {
      const b = e.getBoundingClientRect();
      if (b.height > 0 && b.bottom > r.top + 2 && b.top < r.bottom - 2) return e;
    }
    return null;
  };
  window.__fs = {
    scEl, bodyEl,
    headerEls: () => selHs.map((s) => document.querySelector(s)),
    samples: [], running: false,
    start() {
      this.samples = []; this.running = true;
      const t0 = performance.now();
      const loop = () => {
        if (!this.running) return;
        const hs = this.headerEls(); const b = bodyEl();
        if (b && hs.every(Boolean)) this.samples.push({ t: performance.now() - t0, xhs: hs.map((h) => h.getBoundingClientRect().left), xb: b.getBoundingClientRect().left, sl: scEl().scrollLeft });
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
    stop() { this.running = false; return this.samples; },
  };
};

// ───────────────────────────── 動かし方 3 通り ─────────────────────────────
/** @returns {Promise<{supported:boolean, reason?:string, scrollLeftMax?:number, info?:any}>} */
const MOTIONS = {
  /** Shift+ホイールの小刻み(useSmoothWheelScroll の横スクロール経路)を往復 */
  async wheel(page) {
    const r = await page.evaluate(() => { const b = window.__fs.scEl().getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await page.mouse.move(r.x, r.y);
    // chromium: Shift+縦ホイール(アプリの横スクロール経路)。webkit/firefox は Playwright が Shift をホイールに載せないことがあるので、横ホイール(deltaX)を試す
    const shift = BROWSER === 'chromium' || !!args['wheel-shift'];
    if (shift) await page.keyboard.down('Shift');
    for (let i = 0; i < 12; i++) { await (shift ? page.mouse.wheel(0, 12) : page.mouse.wheel(18, 0)); await sleep(16); }
    await sleep(150);
    for (let i = 0; i < 12; i++) { await (shift ? page.mouse.wheel(0, -12) : page.mouse.wheel(-18, 0)); await sleep(16); }
    if (shift) await page.keyboard.up('Shift');
    return { supported: true, info: { via: shift ? 'Shift+縦ホイール' : '横ホイール(deltaX)' } };
  },
  /** スクロールバーのつまみを掴んで右端まで引き、左端まで戻す */
  async thumb(page) {
    const g = await page.evaluate(() => {
      const sc = window.__fs.scEl(); const b = sc.getBoundingClientRect();
      return { left: b.left, bottom: b.top + sc.offsetHeight, barH: sc.offsetHeight - sc.clientHeight, cw: sc.clientWidth, sw: sc.scrollWidth, sl: sc.scrollLeft };
    });
    if (g.barH < 4) return { supported: false, reason: `横スクロールバーが描かれない(offsetHeight-clientHeight=${g.barH})` };
    const max = g.sw - g.cw;
    // 通常の(クラシック)バー: 両端に barH 角の矢印ボタン。つまみは中間のトラックの中
    const track = g.cw - 2 * g.barH;
    const thumbLen = Math.max(20, (track * g.cw) / g.sw);
    const travel = track - thumbLen;
    const y = g.bottom - g.barH / 2;
    const x0 = g.left + g.barH + (g.sl / max) * travel + thumbLen / 2;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    const steps = 40;
    for (let i = 1; i <= steps; i++) { await page.mouse.move(x0 + (travel * i) / steps, y); await sleep(16); }
    const slMid = await page.evaluate(() => window.__fs.scEl().scrollLeft);
    await sleep(150);
    for (let i = 1; i <= steps; i++) { await page.mouse.move(x0 + travel - (travel * i) / steps, y); await sleep(16); }
    await page.mouse.up();
    if (slMid < max * 0.5) return { supported: false, reason: `ドラッグしても動かない(右端まで引いて scrollLeft=${slMid}/${max})`, info: { g, x0, y, thumbLen, travel } };
    return { supported: true, info: { barH: g.barH, thumbLen: Math.round(thumbLen), travel: Math.round(travel), scrollLeftAtRightEnd: slMid } };
  },
  /** → を押しっぱなし(自動リピート)で右端へ、← で戻す */
  async key(page) {
    await page.evaluate(() => { const sc = window.__fs.scEl(); sc.setAttribute('tabindex', '-1'); sc.focus({ preventScroll: true }); });
    const focused = await page.evaluate(() => document.activeElement === window.__fs.scEl());
    if (!focused) return { supported: false, reason: 'スクロールの入れ物にフォーカスできない' };
    for (let i = 0; i < 10; i++) { await page.keyboard.down('ArrowRight'); await sleep(40); }
    await page.keyboard.up('ArrowRight');
    await sleep(250);
    for (let i = 0; i < 10; i++) { await page.keyboard.down('ArrowLeft'); await sleep(40); }
    await page.keyboard.up('ArrowLeft');
    return { supported: true };
  },
};

// ───────────────────────────── コマの画素から目印の x を読む ─────────────────────────────
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** 洋紅(#f0f)の被覆率。背景が何色でも、被覆 c なら c になる(min(r,b)-g = 255c) */
const scoreMag = (r, g, b) => clamp01((Math.min(r, b) - g) / 255);
/** 水色(#0ff)の被覆率 */
const scoreCyan = (r, g, b) => clamp01((Math.min(g, b) - r) / 255);

/** 1 行の画素から、最初の帯の重心 x(画素)を返す。見つからない/太すぎる帯は null */
function bandCentroid(buf, width, ch, y, score, maxRun) {
  const row = y * width * ch;
  let x = 0;
  while (x < width) {
    const o = row + x * ch;
    if (score(buf[o], buf[o + 1], buf[o + 2]) > 0.5) break;
    x++;
  }
  if (x >= width) return null;
  let s = x; // 帯の始まりを弱い画素まで広げる
  while (s > 0 && score(buf[row + (s - 1) * ch], buf[row + (s - 1) * ch + 1], buf[row + (s - 1) * ch + 2]) > 0.08) s--;
  let e = x;
  while (e < width - 1 && score(buf[row + (e + 1) * ch], buf[row + (e + 1) * ch + 1], buf[row + (e + 1) * ch + 2]) > 0.08) e++;
  if (e - s + 1 > maxRun) return null;
  let sw = 0, sx = 0;
  for (let i = s; i <= e; i++) { const o = row + i * ch; const w = score(buf[o], buf[o + 1], buf[o + 2]); sw += w; sx += w * (i + 0.5); }
  return sw > 0 ? sx / sw : null;
}
const median = (a) => { const b = [...a].sort((p, q) => p - q); return b.length ? (b.length % 2 ? b[(b.length - 1) >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };

/** 1 コマ(PNG の base64)から { xh, xb }(CSS px)を読む */
async function readFrame(b64, rows, vpW) {
  const { data, info } = await sharp(Buffer.from(b64, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sx = info.width / vpW; // 画素 → CSS px
  const maxRun = Math.round(sx * 12);
  const xs = (ys, score) => {
    const v = ys.map((yCss) => bandCentroid(data, info.width, 3, Math.min(info.height - 1, Math.max(0, Math.round(yCss * sx))), score, maxRun)).filter((x) => x !== null);
    return v.length >= 2 ? median(v) / sx : null;
  };
  return { xhs: rows.headers.map((ys) => xs(ys, scoreMag)), xb: xs(rows.body, scoreCyan), w: info.width, h: info.height };
}

// ───────────────────────────── 1 通りの動かし方を測る ─────────────────────────────
/** タイムアウトで閉じられるよう、開いたブラウザを覚えておく */
let currentBrowser = null;
async function measure(mode) {
  const { browser, context, page } = await openPage();
  currentBrowser = browser;
  try {
    await page.evaluate(PAGE_TOOLS, { selHs: HEADERS.map((h) => h.sel), selB: SEL_BODY });
    const rest = await page.evaluate(() => {
      const w = window.__fs; const sc = w.scEl(); const hs = w.headerEls(); const b = w.bodyEl();
      if (!b || !hs.every(Boolean)) {
        return { error: `目印の要素が見つからない(header=${hs.map((h) => !!h)}, body=${!!b}; [data-member-id]=${document.querySelectorAll('[data-member-id]').length}, .recast-cell=${document.querySelectorAll('.recast-cell').length})` };
      }
      const br = b.getBoundingClientRect(); const sr = sc.getBoundingClientRect();
      return { dDoms: hs.map((h) => h.getBoundingClientRect().left - br.left), hdr: hs.map((h) => { const r = h.getBoundingClientRect(); return { top: r.top, h: r.height }; }), scrollMax: sc.scrollWidth - sc.clientWidth, scTop: sr.top, scH: sr.height };
    });
    if (rest.error) throw new Error(rest.error);
    if (rest.scrollMax < 20) throw new Error(`横にスクロールできない(scrollMax=${rest.scrollMax})。--party=8 / --vp=1489 で実行する`);
    const rows = {
      headers: rest.hdr.map((r) => [0.3, 0.5, 0.7].map((f) => r.top + r.h * f)),
      body: [0.2, 0.35, 0.5, 0.65, 0.8].map((f) => rest.scTop + rest.scH * f),
    };
    const meta = { mode, browser: BROWSER, method: METHOD, scrollMax: rest.scrollMax, dDoms: rest.dDoms.map(r2) };

    let samples; let motion;
    if (METHOD === 'screencast') {
      if (BROWSER !== 'chromium') throw new Error('screencast は chromium 専用(--method=raf を使う)');
      const cdp = await context.newCDPSession(page);
      /** @type {{b64:string, ts:number, idx:number}[]} */
      const frames = [];
      let restCount = -1;
      cdp.on('Page.screencastFrame', (ev) => {
        frames.push({ b64: ev.data, ts: ev.metadata.timestamp, idx: frames.length });
        cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
      });
      // コマは DSR に関わらず CSS px 等倍(1489×679)で届く(maxWidth は縮小だけ)。位置の分解能は 1 CSS px だが、止まっている時のばらつきは 0
      await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
      await sleep(600);
      // 止まっている時のコマが 1 枚も来ないなら、絵を 1 回描き直させる(静止画は送られないことがある)
      if (frames.length === 0) { await page.mouse.move(5, 5); await sleep(400); }
      restCount = frames.length;
      const t0 = Date.now();
      motion = await MOTIONS[mode](page);
      await sleep(400);
      meta.motionMs = Date.now() - t0;
      await cdp.send('Page.stopScreencast');
      await sleep(100);
      if (!motion.supported) return { ...meta, supported: false, reason: motion.reason, info: motion.info };
      const decoded = [];
      for (const f of frames) decoded.push({ ...(await readFrame(f.b64, rows, vp.w)), ts: f.ts, idx: f.idx });
      if (args['keep-frames'] && frames.length) {
        fs.mkdirSync(path.join(BASE_DIR, 'frame-sync-frames'), { recursive: true });
        frames.forEach((f, i) => fs.writeFileSync(path.join(BASE_DIR, 'frame-sync-frames', `${BROWSER}-${mode}-${String(i).padStart(3, '0')}.png`), Buffer.from(f.b64, 'base64')));
      }
      meta.frameSize = decoded[0] ? [decoded[0].w, decoded[0].h] : null;
      samples = { kind: 'screencast', restCount, frames: decoded };
    } else {
      await page.evaluate(() => window.__fs.start());
      await sleep(300);
      const t0 = Date.now();
      motion = await MOTIONS[mode](page);
      await sleep(400);
      meta.motionMs = Date.now() - t0;
      const raw = await page.evaluate(() => window.__fs.stop());
      if (!motion.supported) return { ...meta, supported: false, reason: motion.reason, info: motion.info };
      samples = { kind: 'raf', raw };
    }
    const a = analyze(samples, rest.dDoms);
    if (a.movingFrames === 0) return { ...meta, supported: false, reason: `動かしたのにスクロールが動かなかった(動いているコマ 0・コマ数 ${a.frames})`, info: motion.info };
    return { ...meta, supported: true, motionInfo: motion.info, ...a };
  } finally {
    await browser.close();
  }
}

const r2 = (v) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);

/** 帯ごとに、コマごとの d = xh - xb を出し、止まっている時の d0 との差で判定する。ずれたコマ = どれかの帯が THRESH を超えたコマ */
function analyze(samples, dDoms) {
  const nb = HEADERS.length;
  /** @type {{ds:(number|null)[], xb:number, move:boolean}[]} */
  const seq = [];
  let invalid = 0;
  /** @type {number[]} */ let d0s = [];
  let d0src;
  const calib = []; const noise = []; const domGap = [];
  if (samples.kind === 'screencast') {
    const ok = (f) => f.xb !== null && f.xhs.every((x) => x !== null);
    const all = samples.frames;
    const restF = all.slice(0, samples.restCount).filter(ok);
    const moveF = all.slice(samples.restCount);
    for (let i = 0; i < nb; i++) {
      if (restF.length) d0s.push(median(restF.map((f) => f.xhs[i] - f.xb)));
      else d0s.push(dDoms[i]);
      if (restF.length) noise.push(Math.max(...restF.map((f) => Math.abs(f.xhs[i] - f.xb - d0s[i]))));
      domGap.push(Math.abs(d0s[i] - dDoms[i]));
    }
    d0src = restF.length ? `止まっている時のコマ ${restF.length} 枚の中央値` : 'DOM の実測(止まっている時のコマが取れなかった)';
    let prev = restF.length ? median(restF.map((f) => f.xb)) : null;
    for (const f of moveF) {
      if (!ok(f)) { invalid++; continue; }
      seq.push({ ds: f.xhs.map((x) => x - f.xb), xb: f.xb, move: prev !== null && Math.abs(f.xb - prev) > 0.2 });
      prev = f.xb;
    }
    const last = seq[seq.length - 1];
    for (let i = 0; i < nb; i++) calib.push(last ? Math.abs(last.ds[i] - d0s[i]) : null);
  } else {
    d0s = [...dDoms]; d0src = 'DOM の実測(止まっている時)';
    let prevSl = null;
    for (const s of samples.raw) {
      seq.push({ ds: s.xhs.map((x) => x - s.xb), xb: s.xb, move: prevSl !== null && Math.abs(s.sl - prevSl) > 0.01 });
      prevSl = s.sl;
    }
  }
  const dev = seq.map((s) => s.ds.map((d, i) => d - d0s[i]));
  const worst = dev.map((v) => Math.max(...v.map(Math.abs)));
  const maxAbs = worst.length ? Math.max(...worst) : 0;
  const mi = worst.findIndex((v) => v === maxAbs);
  const bands = HEADERS.map((h, i) => {
    const v = dev.map((x) => x[i]);
    const m = v.length ? Math.max(...v.map(Math.abs)) : 0;
    const k = v.findIndex((x) => Math.abs(x) === m);
    return { id: h.id, deviantFrames: v.filter((x) => Math.abs(x) > THRESH).length, maxDev: r2(m), maxDevSigned: k >= 0 ? r2(v[k]) : null, d0: r2(d0s[i]), restNoiseMax: noise[i] === undefined ? null : r2(noise[i]), lastFrameGap: calib[i] === undefined || calib[i] === null ? null : r2(calib[i]), domVsFrameD0Gap: domGap[i] === undefined ? null : r2(domGap[i]) };
  });
  const deviant = worst.filter((v) => v > THRESH).length;
  return {
    frames: seq.length, invalidFrames: invalid, movingFrames: seq.filter((s) => s.move).length,
    deviantFrames: deviant, maxDev: r2(maxAbs), maxDevSigned: mi >= 0 ? r2(dev[mi].reduce((p, c) => (Math.abs(c) > Math.abs(p) ? c : p), 0)) : null,
    d0Source: d0src, bands, devSeries: dev.map((v) => v.map(r2)), conclusion: deviant > 0 ? 'ずれあり' : 'ずれなし',
  };
}

// ───────────────────────────── main ─────────────────────────────
const results = [];
let hadHardFail = false;
console.log(`frame-sync: browser=${BROWSER} method=${METHOD} vp=${VP_ID} theme=${THEME_ID} view=${VIEW} party=${PARTY} base=${BASE_URL}`);
console.log(`目印: 見出し=${HEADERS.map((h) => `${h.id}:${h.sel}`).join(' | ')} / 本文=${SEL_BODY} / しきい値=${THRESH}px`);
for (const mode of MODES) {
  try {
    const r = await Promise.race([measure(mode), new Promise((_, rej) => setTimeout(() => rej(new Error(`${MODE_TIMEOUT / 1000} 秒で終わらない(止めた)`)), MODE_TIMEOUT))]);
    results.push(r);
    if (!r.supported) {
      console.log(`[${mode}] 未対応: ${r.reason}`);
    } else {
      console.log(`[${mode}] コマ数=${r.frames}(動いているコマ=${r.movingFrames}・読めなかったコマ=${r.invalidFrames}) ずれたコマ数=${r.deviantFrames} 最大ずれ=${r.maxDev}px(符号付き ${r.maxDevSigned}) → ${r.conclusion}`);
      for (const b of r.bands) console.log(`      帯 ${b.id}: ずれたコマ数=${b.deviantFrames} 最大ずれ=${b.maxDev}px(符号付き ${b.maxDevSigned}) d0=${b.d0}px 止まっている時のばらつき最大=${b.restNoiseMax}px 最後のコマと d0 の差=${b.lastFrameGap}px コマ読みと DOM の d0 差=${b.domVsFrameD0Gap}px`);
      console.log(`      d0=${r.d0Source} 動かした時間=${r.motionMs}ms`);
    }
  } catch (e) {
    hadHardFail = true;
    try { await currentBrowser?.close(); } catch { /* 無視 */ }
    console.log(`[${mode}] 測定失敗: ${e && e.message ? e.message : e}`);
    results.push({ mode, supported: false, failed: true, reason: String(e && e.message ? e.message : e) });
  }
}

const okRes = results.filter((r) => r.supported);
const totalFrames = okRes.reduce((a, r) => a + r.frames, 0);
const totalDev = okRes.reduce((a, r) => a + r.deviantFrames, 0);
const maxDev = okRes.length ? Math.max(...okRes.map((r) => r.maxDev)) : 0;
const conclusion = !okRes.length ? '測定不成立' : totalDev > 0 ? 'ずれたコマあり' : 'ずれなし';
console.log(`合計: コマ数=${totalFrames} ずれたコマ数=${totalDev} 最大ずれ=${r2(maxDev)}px → ${conclusion}`);

fs.mkdirSync(BASE_DIR, { recursive: true });
const outFile = path.join(BASE_DIR, `frame-sync-${OUT}.json`);
fs.writeFileSync(outFile, JSON.stringify({
  meta: { at: new Date().toISOString(), browser: BROWSER, method: METHOD, vp: VP_ID, theme: THEME_ID, view: VIEW, party: PARTY, selectorHeaders: HEADERS, selectorBody: SEL_BODY, thresholdPx: THRESH },
  total: { frames: totalFrames, deviantFrames: totalDev, maxDev: r2(maxDev), conclusion }, results,
}, null, 1));
console.log(`結果: ${path.relative(process.cwd(), outFile)}`);

if (!okRes.length || hadHardFail && !okRes.length) process.exit(2);
if (EXPECT_ZERO && totalDev > 0) { console.log('--expect-zero: ずれたコマがあるので exit 1'); process.exit(1); }
process.exit(0);
