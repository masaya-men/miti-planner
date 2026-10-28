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
import { median, readFrame } from './frame-sync-pixels.mjs';
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
/** 環境によって使えないモード(例: Firefox の thumb)を「未対応のままでも exit 2 にしない」ものとして許す。未対応(unsupported)だけに効く */
const ALLOW_UNSUPPORTED = new Set(str('allow-unsupported', '').split(',').map((v) => v.trim()).filter(Boolean));
/** 動かすスクロールの入れ物。見出しの構造が変わっても本文側は同じ入れ物のはず。差し替え用 */
const SEL_SCROLL = str('selector-scroll', '.timeline-scroll-container');
/** 自己検証: 見出し側の目印も本文と同じ入れ物の中(本文の別の行の同じ列)に付ける。2 つは必ず一緒に動く=ずれ 0 と出るはず */
const SELF_TEST = !!args['self-test'];
/** 読めなかったコマの上限(割合)と、動いている間の有効なコマの下限(枚)。外れたモードは「測定不成立」 */
const MAX_INVALID_RATIO = 0.2;
const MIN_MOVING_FRAMES = 10;
/** 見出し側の目印は 2 つの帯: ボタンの欄の中のジョブ選択の行(controls)と、見出しの中のリキャスト欄(header)。どちらも transform で動く。 */
const SEL_HEADER = str('selector-header', '#timeline-controls-inner [data-member-id]');
const SEL_HEADER2 = str('selector-header2', '#timeline-header-inner .recast-cell');
const HEADERS = SELF_TEST ? [{ id: 'self-test', sel: '(本文の別の行の同じ列)' }] : [{ id: 'controls', sel: SEL_HEADER }, ...(SEL_HEADER2 === 'none' ? [] : [{ id: 'header', sel: SEL_HEADER2 }])];
const SEL_BODY = str('selector-body', VIEW === 'sheet' ? `${SEL_SCROLL} [data-time-row] [data-sheet-cols]` : `${SEL_SCROLL} [data-time-row] [data-job-col]`);
/** ずれたコマの判定(px)。合格させるために動かさない。 */
const THRESH = Number(str('thresh', '0.5'));

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
const MODE_TIMEOUT = Number(str('mode-timeout', '120000'));
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
let currentBrowser = null;
async function openPage() {
  const type = { chromium, webkit, firefox }[BROWSER];
  if (!type) throw new Error(`--browser は chromium|webkit|firefox: ${BROWSER}`);
  // headless の Chromium は既定で --hide-scrollbars が付く=つまみが無い。つまみのドラッグを再現するため外す。
  const browser = await type.launch(BROWSER === 'chromium' ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {});
  currentBrowser = browser; // タイムアウトで外から閉じられるよう、launch の直後に覚える
  try {
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
  return { browser, context, page };
  } catch (e) {
    try { await browser.close(); } catch { /* 無視 */ }
    throw e;
  }
}

/** ページ内の道具(目印の要素を決めて印を付ける・rAF サンプラー)。目印の要素は 1 つずつに限る(最初に見つかったもの)。 */
const PAGE_TOOLS = ({ selHs, selB, selScroll, selfTest }) => {
  const scEl = () => document.querySelector(selScroll);
  /** 本文側: スクロールの入れ物の縦範囲に見えている最初の要素 */
  const visibleIn = (e) => { const r = scEl().getBoundingClientRect(); const b = e.getBoundingClientRect(); return b.height > 0 && b.bottom > r.top + 2 && b.top < r.bottom - 2; };
  const pickBody = () => [...document.querySelectorAll(selB)].find(visibleIn) || null;
  const w = window;
  w.__fs = {
    scEl, bodyRef: null, headerRefs: [],
    /** 自己検証: 本文と同じ列(左端が同じ)で、別の行(縦に 20px 以上離れた)の要素 */
    pickSame(body) {
      const bl = body.getBoundingClientRect();
      return [...document.querySelectorAll(selB)].find((e) => { const r = e.getBoundingClientRect(); return e !== body && visibleIn(e) && Math.abs(r.left - bl.left) < 0.5 && Math.abs(r.top - bl.top) > 20; }) || null;
    },
    /** 要素を決めて data-fs-h(帯の番号)/ data-fs-b を付ける */
    setup() {
      const body = pickBody();
      const hs = selfTest ? [body ? this.pickSame(body) : null] : selHs.map((s) => document.querySelector(s));
      if (!body || !hs.every(Boolean)) return { error: `目印の要素が見つからない(header=${hs.map((h) => !!h)}, body=${!!body}; [data-member-id]=${document.querySelectorAll('[data-member-id]').length}, .recast-cell=${document.querySelectorAll('.recast-cell').length})` };
      body.setAttribute('data-fs-b', '');
      hs.forEach((h, i) => h.setAttribute('data-fs-h', String(i)));
      this.bodyRef = body; this.headerRefs = hs;
      const sc = scEl(); const sr = sc.getBoundingClientRect(); const br = body.getBoundingClientRect();
      const rc = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, h: r.height, w: r.width }; };
      return { dDoms: hs.map((h) => h.getBoundingClientRect().left - br.left), hdr: hs.map(rc), body: rc(body), scrollMax: sc.scrollWidth - sc.clientWidth, scTop: sr.top, scH: sr.height };
    },
    samples: [], running: false,
    start() {
      this.samples = []; this.running = true;
      const t0 = performance.now();
      const loop = () => {
        if (!this.running) return;
        this.samples.push({ t: performance.now() - t0, xhs: this.headerRefs.map((h) => h.getBoundingClientRect().left), xb: this.bodyRef.getBoundingClientRect().left, sl: scEl().scrollLeft });
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


// ───────────────────────────── 1 通りの動かし方を測る ─────────────────────────────
async function measure(mode) {
  const { browser, context, page } = await openPage();
  try {
    await page.evaluate(PAGE_TOOLS, { selHs: HEADERS.map((h) => h.sel), selB: SEL_BODY, selScroll: SEL_SCROLL, selfTest: SELF_TEST });
    const rest = await page.evaluate(() => window.__fs.setup());
    if (rest.error) throw new Error(rest.error);
    if (rest.scrollMax < 20) throw new Error(`横にスクロールできない(scrollMax=${rest.scrollMax})。--party=8 / --vp=1489 で実行する`);
    // 試験用の目印(アプリのコードには入れない)。印を付けた要素 1 つずつに outline を付ける(outline は寸法に影響しない)
    await page.addStyleTag({
      content: `[data-fs-h]{outline:3px solid #f0f !important;outline-offset:-3px !important}
[data-fs-b]{outline:3px solid #0ff !important;outline-offset:-3px !important}`,
    });
    await page.waitForTimeout(300);
    // 要素の縦の真ん中あたりの 3 行を走査する(上下の縁を避ける)
    const rowsOf = (r) => ({ ys: [0.35, 0.5, 0.65].map((f) => r.top + r.h * f), w: r.w });
    const rows = { headers: rest.hdr.map(rowsOf), body: rowsOf(rest.body) };
    const meta = { mode, browser: BROWSER, method: METHOD, scrollMax: rest.scrollMax, dDoms: rest.dDoms.map(r2) };

    let samples; let motion;
    if (METHOD === 'screencast') {
      if (BROWSER !== 'chromium') throw new Error('screencast は chromium 専用(--method=raf を使う)');
      const cdp = await context.newCDPSession(page);
      /** @type {{b64:string, ts:number, idx:number}[]} */
      const frames = [];
      cdp.on('Page.screencastFrame', (ev) => {
        frames.push({ b64: ev.data, ts: ev.metadata.timestamp, idx: frames.length });
        cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
      });
      // コマは DSR に関わらず CSS px 等倍(1489×679)で届く(maxWidth は縮小だけ)。位置の分解能は 1 CSS px だが、止まっている時のばらつきは 0
      await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
      await sleep(600);
      // 止まっている時のコマが 1 枚も来ないなら、絵を 1 回描き直させる(静止画は送られないことがある)
      if (frames.length === 0) { await page.mouse.move(5, 5); await sleep(400); }
      const restCount = frames.length;
      const t0 = Date.now();
      motion = await MOTIONS[mode](page);
      await sleep(400);
      meta.motionMs = Date.now() - t0;
      await cdp.send('Page.stopScreencast');
      await sleep(100);
      if (!motion.supported) return { ...meta, status: 'unsupported', supported: false, reason: motion.reason, info: motion.info };
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
      if (!motion.supported) return { ...meta, status: 'unsupported', supported: false, reason: motion.reason, info: motion.info };
      samples = { kind: 'raf', raw };
    }
    const a = analyze(samples, rest.dDoms);
    if (a.movingFrames === 0) return { ...meta, status: 'unsupported', supported: false, reason: `動かしたのにスクロールが動かなかった(動いているコマ 0・コマ数 ${a.frames})`, info: motion.info };
    // 測定不成立の判定(I2): 読めなかったコマが多すぎる / 動いている間の有効なコマが少なすぎる
    const why = [];
    if (a.invalidRatio > MAX_INVALID_RATIO) why.push(`読めなかったコマが ${a.invalidFrames}/${a.invalidFrames + a.frames}(${Math.round(a.invalidRatio * 100)}%)で上限 ${MAX_INVALID_RATIO * 100}% を超える`);
    if (a.movingFrames < MIN_MOVING_FRAMES) why.push(`動いている間の有効なコマが ${a.movingFrames} 枚で下限 ${MIN_MOVING_FRAMES} 枚に足りない`);
    if (why.length) return { ...meta, status: 'insufficient', supported: false, reason: `測定不成立: ${why.join('・')}`, info: motion.info, partial: a };
    return { ...meta, status: 'ok', supported: true, motionInfo: motion.info, ...a };
  } finally {
    await browser.close();
  }
}

const r2 = (v) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);

/** 帯ごとに、コマごとの d = xh - xb を出し、止まっている時の d0 との差で判定する。ずれたコマ = どれかの帯が THRESH を超えたコマ */
function analyze(samples, dDoms) {
  const nb = HEADERS.length;
  /** @type {{ds:(number|null)[], xb:number, move:boolean, idx:number}[]} */
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
      seq.push({ ds: f.xhs.map((x) => x - f.xb), xb: f.xb, move: prev !== null && Math.abs(f.xb - prev) > 0.2, idx: f.idx });
      prev = f.xb;
    }
    const last = seq[seq.length - 1];
    for (let i = 0; i < nb; i++) calib.push(last ? Math.abs(last.ds[i] - d0s[i]) : null);
  } else {
    d0s = [...dDoms]; d0src = 'DOM の実測(止まっている時)';
    let prevSl = null;
    for (const s of samples.raw) {
      seq.push({ ds: s.xhs.map((x) => x - s.xb), xb: s.xb, move: prevSl !== null && Math.abs(s.sl - prevSl) > 0.01, idx: -1 });
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
    frames: seq.length, invalidFrames: invalid, invalidRatio: invalid + seq.length ? invalid / (invalid + seq.length) : 0, maxDevFrameIdx: mi >= 0 ? seq[mi].idx : null, movingFrames: seq.filter((s) => s.move).length,
    deviantFrames: deviant, maxDev: r2(maxAbs), maxDevSigned: mi >= 0 ? r2(dev[mi].reduce((p, c) => (Math.abs(c) > Math.abs(p) ? c : p), 0)) : null,
    d0Source: d0src, bands, devSeries: dev.map((v) => v.map(r2)), conclusion: deviant > 0 ? 'ずれあり' : 'ずれなし',
  };
}

// ───────────────────────────── main ─────────────────────────────
/** 1 通りを測る。上限時間を超えたらブラウザを閉じ、測定の後始末が終わる(最大 10 秒待つ)まで次へ進まない */
async function runMode(mode) {
  currentBrowser = null;
  const p = measure(mode);
  p.catch(() => {});
  let timer;
  try {
    return await Promise.race([p, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${MODE_TIMEOUT / 1000} 秒で終わらない(止めた)`)), MODE_TIMEOUT); })]);
  } catch (e) {
    try { await currentBrowser?.close(); } catch { /* 無視 */ }
    await Promise.race([p.catch(() => {}), sleep(10000)]);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
console.log(`frame-sync: browser=${BROWSER} method=${METHOD} vp=${VP_ID} theme=${THEME_ID} view=${VIEW} party=${PARTY} base=${BASE_URL}${SELF_TEST ? ' 【自己検証: 見出し側も本文と同じ入れ物の中】' : ''}`);
console.log(`目印: 見出し=${HEADERS.map((h) => `${h.id}:${h.sel}`).join(' | ')} / 本文=${SEL_BODY} / 入れ物=${SEL_SCROLL} / しきい値=${THRESH}px`);
for (const mode of MODES) {
  try {
    const r = await runMode(mode);
    results.push(r);
    if (r.status === 'ok') {
      console.log(`[${mode}] コマ数=${r.frames}(動いているコマ=${r.movingFrames}・読めなかったコマ=${r.invalidFrames}=${Math.round(r.invalidRatio * 1000) / 10}%) ずれたコマ数=${r.deviantFrames} 最大ずれ=${r.maxDev}px(符号付き ${r.maxDevSigned}) → ${r.conclusion}`);
      for (const b of r.bands) console.log(`      帯 ${b.id}: ずれたコマ数=${b.deviantFrames} 最大ずれ=${b.maxDev}px(符号付き ${b.maxDevSigned}) d0=${b.d0}px 止まっている時のばらつき最大=${b.restNoiseMax}px 最後のコマと d0 の差=${b.lastFrameGap}px コマ読みと DOM の d0 差=${b.domVsFrameD0Gap}px`);
      console.log(`      d0=${r.d0Source} 動かした時間=${r.motionMs}ms ずれ最大のコマ番号=${r.maxDevFrameIdx}`);
    } else if (r.status === 'insufficient') {
      console.log(`[${mode}] ${r.reason}`);
    } else {
      console.log(`[${mode}] 未対応: ${r.reason}`);
    }
  } catch (e) {
    console.log(`[${mode}] 測定失敗: ${e && e.message ? e.message : e}`);
    results.push({ mode, status: 'failed', supported: false, failed: true, reason: String(e && e.message ? e.message : e) });
  }
}

const okRes = results.filter((r) => r.status === 'ok');
const totalFrames = okRes.reduce((a, r) => a + r.frames, 0);
const totalDev = okRes.reduce((a, r) => a + r.deviantFrames, 0);
const maxDev = okRes.length ? Math.max(...okRes.map((r) => r.maxDev)) : 0;
/** 要求したのに測れなかったモード。失敗・測定不成立は常に、未対応は --allow-unsupported で許したもの以外が数に入る */
const hard = results.filter((r) => r.status === 'failed' || r.status === 'insufficient');
const unsupported = results.filter((r) => r.status === 'unsupported' && !ALLOW_UNSUPPORTED.has(r.mode));
const unmeasured = results.filter((r) => r.status !== 'ok').map((r) => `${r.mode}(${r.status})`);
const conclusion = !okRes.length ? '測定不成立' : totalDev > 0 ? 'ずれたコマあり' : unmeasured.length ? 'ずれなし(ただし未測定のモードあり)' : 'ずれなし';
console.log(`合計: コマ数=${totalFrames} ずれたコマ数=${totalDev} 最大ずれ=${r2(maxDev)}px → ${conclusion}${unmeasured.length ? ` 未測定: ${unmeasured.join(', ')}` : ''}`);

fs.mkdirSync(BASE_DIR, { recursive: true });
const outFile = path.join(BASE_DIR, `frame-sync-${OUT}.json`);
fs.writeFileSync(outFile, JSON.stringify({
  meta: { at: new Date().toISOString(), browser: BROWSER, method: METHOD, vp: VP_ID, theme: THEME_ID, view: VIEW, party: PARTY, selectorHeaders: HEADERS, selectorBody: SEL_BODY, selectorScroll: SEL_SCROLL, selfTest: SELF_TEST, thresholdPx: THRESH, allowUnsupported: [...ALLOW_UNSUPPORTED] },
  total: { frames: totalFrames, deviantFrames: totalDev, maxDev: r2(maxDev), conclusion, unmeasured }, results,
}, null, 1));
console.log(`結果: ${path.relative(process.cwd(), outFile)}`);

// 終了コード: 2 = 測定が成立していない(1 つも測れていない / 失敗・測定不成立のモードがある / --expect-zero なのに許していない未対応がある)
if (!okRes.length || hard.length || (EXPECT_ZERO && unsupported.length)) { console.log('exit 2: 測定が成立していない'); process.exit(2); }
if (EXPECT_ZERO && totalDev > 0) { console.log('--expect-zero: ずれたコマがあるので exit 1'); process.exit(1); }
process.exit(0);
