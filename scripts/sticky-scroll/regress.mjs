// @ts-check
/**
 * 軽減表の回帰自動確認(横スクロール計画 §4 の [自] 項目)。アプリのコードは変えない・計測するだけ。
 *
 * 使い方(README.md に詳細):
 *   node scripts/sticky-scroll/regress.mjs --out=baseline
 *   node scripts/sticky-scroll/regress.mjs --out=after --compare=baseline [--only=standard] [--allow=<項目>]
 *   他: --list(条件一覧)  --probe=<名前,…>(動作の確認項目を絞る・開発用)  --geom-only / --beh-only
 *
 * 結果は scripts/sticky-scroll/.baseline/regress-<out>.json(git に入れない)。
 * 形: { meta, conds: { <条件id>: { items: { <項目id>: ... } } } }
 * 計測は dev サーバー(既定 http://localhost:5173、REGRESS_BASE_URL で変更)。localStorage 注入で表を作り、
 * 一部の確認(カーソル送信・読み取り専用・記録モード)だけ dev の store を直接読む(dev 専用)。
 * 画面の呼び名: 本人=1489×679/DSR2.58、多数派=1920×1080/DSR2、大画面=2560×1440/DSR1。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, EVENT_FIXTURE, PHASE_FIXTURE, PARTY_FIXTURE, MITIGATION_FIXTURE } from '../milspec-sp2/_fixture.mjs';

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
const OUT = typeof args.out === 'string' ? args.out : 'after';
const COMPARE = typeof args.compare === 'string' ? args.compare : null;
const ONLY = typeof args.only === 'string' ? args.only : null;
const ALLOW = typeof args.allow === 'string' ? args.allow.split(',').map((s) => s.trim()).filter(Boolean) : [];
const PROBE_FILTER = typeof args.probe === 'string' ? new Set(args.probe.split(',')) : null;
const TOL = 0.5; // 位置・寸法の許容(px)
const TOL_PRECISE = 0.01; // precise 配下(sheetWidth 実測など)の許容(px)
/** 取得時の HEAD の SHA(baseline がどのコードで取られたか残す)。 */
const gitSha = () => { try { return execSync('git rev-parse HEAD', { cwd: HERE }).toString().trim(); } catch { return null; } };
const fileOf = (name) => path.join(BASE_DIR, `regress-${name}.json`);

// ───────────────────────────── 条件 ─────────────────────────────
const VPS = [
  { id: '1489', w: 1489, h: 679, dsf: 2.58, label: '本人' },
  { id: '1920', w: 1920, h: 1080, dsf: 2, label: '多数派' },
  { id: '2560', w: 2560, h: 1440, dsf: 1, label: '大画面' },
];
const THEMES = [
  { id: 'standard-dark', style: 'standard', mode: 'dark' },
  { id: 'standard-light', style: 'standard', mode: 'light' },
  { id: 'military-dark', style: 'military', mode: 'dark' },
  { id: 'military-light', style: 'military', mode: 'light' },
];
const VIEWS = ['lanes', 'sheet'];
const PARTIES = [8, 4];

/** @type {{id:string, vp:any, theme:any, view:string, party:number}[]} */
const ALL_CONDS = [];
for (const vp of VPS) for (const theme of THEMES) for (const view of VIEWS) for (const party of PARTIES) {
  ALL_CONDS.push({ id: `${vp.id}-${theme.id}-${view}-${party}p`, vp, theme, view, party });
}
const condById = (id) => ALL_CONDS.find((c) => c.id === id);

/** 動作の確認(クリック・ドラッグ等)を行う代表条件。どの項目をどの条件で取るかは README に表で書く。 */
const BEH = {
  place: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p', '1489-military-dark-lanes-8p', '1489-military-dark-sheet-8p', '1920-standard-light-lanes-8p'],
  drag: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p', '1489-military-dark-lanes-8p'],
  memo: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p', '1489-military-dark-sheet-8p', '1920-standard-light-lanes-8p'],
  cursor: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p', '1920-standard-light-lanes-8p'],
  hover: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p', '1489-military-dark-lanes-8p', '1489-military-dark-sheet-8p', '1920-standard-light-lanes-8p'],
  select: ['1489-standard-dark-lanes-8p', '1489-military-dark-lanes-8p'],
  rows: ['1489-standard-dark-lanes-8p', '1489-military-dark-lanes-8p'],
  view: ['1489-standard-dark-lanes-8p', '1489-military-dark-lanes-8p'],
  misc: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p'],
  milspec: ['1489-military-dark-lanes-8p', '1489-military-dark-sheet-8p'],
};
const MOBILE_THEMES = THEMES;

// ───────────────────────────── 表のデータ(決定的) ─────────────────────────────
const ROLES = { MT: 'tank', ST: 'tank', H1: 'healer', H2: 'healer', D1: 'dps', D2: 'dps', D3: 'dps', D4: 'dps' };
const STATS = { hp: 186846, mainStat: 6217, det: 2410, crt: 420, ten: 420, ss: 420, wd: 154 };
const mkEvent = (id, time, target, i) => ({
  id, time, name: { ja: `攻撃 ${i}`, en: `Attack ${i}` }, damageType: 'magical', damageAmount: 120000, target,
});
/** チュートリアルの目印(4 秒の全体攻撃・10 秒のタンク強攻撃)を含む 32 イベント。 */
const EVENTS = [mkEvent('rg-ev-a', 4, 'AoE', 100), mkEvent('rg-ev-b', 10, 'MT', 101), ...EVENT_FIXTURE.map((e, i) => ({ ...e, id: `rg-ev${i}`, target: 'AoE' }))];
const PHASES = PHASE_FIXTURE.map((p, i) => ({ ...p, id: `rg-ph${i + 1}` }));
const MEMOS = [
  { id: 'rg-memo-1', text: 'メモ1', timeSec: 51, xRatio: 0.6, createdAt: 1, updatedAt: 1 },
  { id: 'rg-memo-2', text: 'メモ2', timeSec: 87, xRatio: 0.85, createdAt: 2, updatedAt: 2 },
  { id: 'rg-memo-3', text: 'メモ3', timeSec: 123, xRatio: 0.66, createdAt: 3, updatedAt: 3 }, // 右クリック削除の確認用(スプシでも画面内にある位置)
];

function buildStorage(cond, over = {}) {
  // 4 人 = 「表示メンバー」のスイッチで 4 人(MT・H1・D1・D3)だけ見せる(ジョブ未設定の列も描かれるので、隠すのが実際の操作)
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
    'plan-storage': {
      state: { plans: [], currentPlanId: 'rg-debug', lastActivePlanId: null, _dirtyPlanIds: [], _deletedPlanIds: [] },
      version: 2,
    },
  };
}

// ───────────────────────────── ページ操作の共通 ─────────────────────────────
/** @param {typeof ALL_CONDS[number] | {vp:any, theme:any, view:string, party:number}} cond */
async function openPage(cond, { over = {}, motion = 'reduce', extraInit } = {}) {
  const { browser, page } = await launch({
    theme: cond.theme.mode, viewport: { width: cond.vp.w, height: cond.vp.h }, dsf: cond.vp.dsf, motion,
  });
  const storage = buildStorage(cond, over);
  await page.addInitScript(({ storage, theme, view }) => {
    try {
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, JSON.stringify(v));
      localStorage.setItem('theme-storage', JSON.stringify({
        state: { theme: theme.mode, themeStyle: theme.style, contentLanguage: 'ja', mobileEffectBarMode: 'icon', timelineView: view }, version: 3,
      }));
    } catch { /* 無視 */ }
  }, { storage, theme: cond.theme, view: cond.view });
  await page.addInitScript(HELPERS_SRC);
  if (extraInit) await page.addInitScript(extraInit);
  await page.goto(`${BASE_URL}/miti`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('[data-time-row]').length > 3, null, { timeout: 30000 });
  await page.waitForTimeout(cond.theme.style === 'military' ? 2200 : 1200);
  const ok = await page.evaluate(() => ({
    mil: document.documentElement.classList.contains('theme-military'),
    light: document.documentElement.classList.contains('theme-light'),
    noPlan: !!document.querySelector('.no-plan'),
    sheet: !!document.querySelector('[data-sheet-cols]'),
  }));
  if (ok.mil !== (cond.theme.style === 'military')) throw new Error(`テーマ不一致: ${JSON.stringify(ok)} / ${cond.id ?? ''}`);
  if (ok.light !== (cond.theme.mode === 'light')) throw new Error(`明暗不一致: ${JSON.stringify(ok)}`);
  if (ok.noPlan) throw new Error('no-plan のまま(表が出ていない)');
  if (ok.sheet !== (cond.view === 'sheet')) throw new Error(`表示モード不一致: ${JSON.stringify(ok)}`);
  return { browser, page };
}

/** ページ内に置く道具(addInitScript)。getBoundingClientRect を 3 桁に丸めた配列で返す等。 */
const HELPERS_SRC = `(() => {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const rect = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [r3(b.left), r3(b.top), r3(b.width), r3(b.height)]; };
  const sortRects = (a) => a.sort((x, y) => (x[1] - y[1]) || (x[0] - y[0]) || (x[2] - y[2]));
  const rects = (sel, root) => sortRects([...(root || document).querySelectorAll(sel)].map(rect));
  window.__rg = {
    r3, rect, rects, sortRects,
    centers: (sel, root) => sortRects([...(root || document).querySelectorAll(sel)].map((e) => { const b = e.getBoundingClientRect(); return [r3(b.left + b.width / 2), r3(b.top + b.height / 2)]; })),
    sc: () => document.querySelector('.timeline-scroll-container'),
    sheet: () => document.querySelector('.timeline-scroll-container > .isolate'),
    css: (e, props, pseudo) => { if (!e) return null; const s = getComputedStyle(e, pseudo || null); const o = {}; for (const p of props) o[p] = s.getPropertyValue(p); return o; },
  };
})();`;

/** 「表を展開する/たたむ」(ふつうはボタン・MIL-SPEC は同名のスイッチ)を 1 回押す。 */
const toggleExpand = async (page) => {
  // MIL-SPEC: 操作盤の横スライド(MilspecSwitches.tsx:103 `button[role=switch][data-deck=expand]`・aria-checked=展開中)。
  // ラベル文字(span.milspec-lbl)のクリックでは切り替わらないので、スイッチ本体を直接押す。
  const sw = page.locator('button[role="switch"][data-deck="expand"]');
  if (await sw.count()) {
    const before = await sw.first().getAttribute('aria-checked');
    await sw.first().click();
    const want = before === 'true' ? 'false' : 'true';
    try {
      await page.waitForFunction((w) => document.querySelector('button[role="switch"][data-deck="expand"]')?.getAttribute('aria-checked') === w, want, { timeout: 5000 });
    } catch {
      throw new Error(`表の展開スイッチが切り替わらない(aria-checked=${before} のまま)`);
    }
    return;
  }
  // ふつうテーマ: ボタンのラベル文字を押す
  await page.getByText(/^(表を展開する|表をたたむ)$/).first().click();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** dev の store を取り出して関数を実行する(アプリが読み込んだ URL と同じものを使う=別インスタンスにならない)。 */
async function withStore(page, rel, fn, arg) {
  const url = await page.evaluate((rel) => {
    const hit = performance.getEntriesByType('resource').map((x) => x.name).find((n) => n.includes('/' + rel));
    return hit || '/' + rel;
  }, rel);
  return page.evaluate(async ({ url, src, arg }) => {
    const m = await import(/* @vite-ignore */ url);
    return new Function('m', 'arg', `return (${src})(m, arg)`)(m, arg);
  }, { url, src: fn.toString(), arg });
}
const MIT = 'src/store/useMitigationStore.ts';
const readMits = (page) => withStore(page, MIT, (m) => m.useMitigationStore.getState().timelineMitigations.map((x) => ({ id: x.id, mitigationId: x.mitigationId, ownerId: x.ownerId, time: x.time })).sort((a, b) => (a.ownerId + a.time + a.mitigationId).localeCompare(b.ownerId + b.time + b.mitigationId)));
const readMemos = (page) => withStore(page, MIT, (m) => m.useMitigationStore.getState().memos.map((x) => ({ id: x.id, text: x.text, timeSec: x.timeSec, xRatio: x.xRatio })));
const normMemoIds = (list) => list.map((x) => ({ ...x, id: x.id.startsWith('memo_') ? 'memo_NEW' : x.id }));
const normMitIds = (list) => list.map((x) => ({ ...x, id: /^rg-m|^sp2-m/.test(x.id) ? x.id : 'mit_NEW' })); // 新規 id は乱数

// ───────────────────────────── 幾何の記録 ─────────────────────────────
/** 画面上の位置・寸法の静止画。scroll を動かした状態でも同じ形で取る。 */
async function snapGeom(page, { times = [15, 51] } = {}) {
  return page.evaluate(({ times }) => {
    const G = window.__rg;
    const sc = G.sc();
    const sheet = G.sheet();
    const hdr = document.querySelector('#timeline-header-inner');
    const ctl = document.querySelector('#timeline-controls-inner');
    const sRect = sheet.getBoundingClientRect();
    const cellsOf = (t) => {
      const q = (s) => G.rects(`[data-time-row="${t}"] ${s}`);
      const parts = [...document.querySelectorAll(`[data-time-row="${t}"]`)].map(G.rect);
      if (!parts.length) return null; // その秒の行が無い(MIL-SPEC の展開表示など)
      // 行が複数に分かれても比べられるよう、全部分の外接矩形にする
      const L = Math.min(...parts.map((p) => p[0])), T = Math.min(...parts.map((p) => p[1]));
      const R = Math.max(...parts.map((p) => p[0] + p[2])), B = Math.max(...parts.map((p) => p[1] + p[3]));
      return {
        union: [G.r3(L), G.r3(T), G.r3(R - L), G.r3(B - T)],
        phase: q('[data-phase-col]'), label: q('[data-label-col]'),
        time: q('[class*="--col-time-w"]'), mechanic: q('[class*="--col-mechanic-w"]'),
        counters: q('[class*="--col-counter-w"]'), jobCols: q('[data-job-col]'),
      };
    };
    const cursors = {};
    document.querySelectorAll('[data-cursor-id]').forEach((e) => { cursors[e.getAttribute('data-cursor-id')] = G.rect(e); });
    const memos = {};
    document.querySelectorAll('[data-memo-id]').forEach((e) => { memos[e.getAttribute('data-memo-id')] = G.rect(e); });
    const rows = {};
    for (const t of times) rows[t] = cellsOf(t);
    return {
      vp: [innerWidth, innerHeight], dpr: Math.round(devicePixelRatio * 100) / 100,
      scroller: {
        rect: G.rect(sc), scrollWidth: sc.scrollWidth, clientWidth: sc.clientWidth,
        scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight, scrollLeft: G.r3(sc.scrollLeft), scrollTop: G.r3(sc.scrollTop),
      },
      sheet: { offsetWidth: sheet.offsetWidth, offsetHeight: sheet.offsetHeight, rect: G.rect(sheet) },
      precise: { sheetWidthRect: sRect.width, sheetLeft: sRect.left, scrollerClientWidth: sc.clientWidth, scrollerScrollWidth: sc.scrollWidth },
      rowCount: document.querySelectorAll('[data-time-row]').length,
      rowTimes: [...new Set([...document.querySelectorAll('[data-time-row]')].map((e) => e.getAttribute('data-time-row')))].length,
      rows,
      header: {
        inner: G.rect(hdr), outer: G.rect(hdr && hdr.parentElement), members: G.rects('[data-member-id]'),
        recast: G.rects('.recast-cell', hdr), buttons: G.rects('button', hdr),
      },
      controls: { inner: G.rect(ctl), outer: G.rect(ctl && ctl.parentElement), buttons: G.rects('button', ctl) },
      icons: G.rects('.cursor-grab', sc), bars: G.rects('[data-mit-bar]', sc),
      memos, cursors,
    };
  }, { times });
}

async function injectPeers(page) {
  await withStore(page, 'src/store/useCollabPresenceStore.ts', (m) => {
    m.useCollabPresenceStore.setState({
      roster: [
        { clientId: 91, color: '#34d399', jobId: 'war', isEditor: true, cursorEnabled: true, isLocal: false },
        { clientId: 92, color: '#a78bfa', jobId: 'whm', isEditor: true, cursorEnabled: true, isLocal: false },
        { clientId: 93, color: '#f472b6', jobId: 'mch', isEditor: true, cursorEnabled: true, isLocal: false },
      ],
    });
  });
  await withStore(page, 'src/store/useRemoteCursorsStore.ts', (m) => {
    const a = m.useRemoteCursorsStore.getState().apply;
    a({ clientId: 91, pos: { timeSec: 51, xRatio: 0.15 }, t: 1 }); // 情報列の上あたり
    a({ clientId: 92, pos: { timeSec: 87, xRatio: 0.6 }, t: 1 });
    a({ clientId: 93, pos: { timeSec: 123, xRatio: 0.9 }, t: 1 });
  });
  await page.waitForTimeout(2200); // 補間(係数 0.15/フレーム)が収束するまで
}

// ───────────────────────────── 静的な幾何(全 48 条件) ─────────────────────────────
async function probeGeom(cond) {
  const { browser, page } = await openPage(cond);
  try {
    const items = {};
    await injectPeers(page);
    items.geom = await snapGeom(page);
    const max = await page.evaluate(() => { const s = window.__rg.sc(); return s.scrollWidth - s.clientWidth; });
    if (max > 1) {
      // 横に動かした状態(A1 固定列のずれの検出・B3.2・B2.3)。固定化後は意図して変わるので --allow=geomScrolled
      for (const [name, ratio] of [['geomScrolledMid', 0.5], ['geomScrolledMax', 1]]) {
        await page.evaluate((x) => { const s = window.__rg.sc(); s.scrollLeft = x; }, Math.floor(max * ratio));
        await page.waitForTimeout(500);
        items[name] = await snapGeom(page);
      }
      await page.evaluate(() => { window.__rg.sc().scrollLeft = 0; });
      await page.waitForTimeout(300);
    }
    // 表の展開(B6.1・B9.1)。最後に行う(この後は状態が変わる)
    await toggleExpand(page);
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__rg.sc().scrollTop = 0; }); // 展開で縦位置が再計算されるので先頭へ戻す
    await page.waitForTimeout(600);
    const exp = await snapGeom(page, { times: [0, 4, 10] });
    exp.tutorial = await page.evaluate(() => {
      const G = window.__rg;
      const o = {};
      for (const k of ['add-event-btn', 'tutorial-damage-cell-4-aoe', 'miti-cell-mt-4']) {
        const els = [...document.querySelectorAll(`[data-tutorial="${k}"]`)];
        o[k] = { count: els.length, rect: G.rect(els[0] || null) };
      }
      return o;
    });
    exp.preStartRowExists = await page.evaluate(() => !!document.querySelector('[data-time-row="-10"]'));
    items.geomExpanded = exp;
    return items;
  } finally {
    await browser.close();
  }
}

// ───────────────────────────── 動作の確認 ─────────────────────────────
const PROBES = {};

/** B1.1/B1.2/B1.6: 置く・消す・取り消し・やり直し */
PROBES.place = async (page, cond) => {
  const out = {};
  const before = (await readMits(page)).length;
  out.before = before;
  if (cond.view === 'lanes') {
    const p = await page.evaluate(() => { const b = document.querySelector('[data-time-row="33"] [data-job-col]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(700);
    out.selector = await page.evaluate(() => { const m = document.querySelector('[data-tutorial-modal]'); return m ? { open: true, rect: window.__rg.rect(m) } : { open: false }; });
    await page.locator('[data-tutorial="tutorial-skill-reprisal"]').click();
    await page.waitForTimeout(700);
  } else {
    const p = await page.evaluate(() => { const b = document.querySelector('[data-time-row="33"] [data-sheet-cols]').getBoundingClientRect(); return { x: b.left + 6, y: b.top + b.height / 2 }; });
    out.cellRect = await page.evaluate(() => window.__rg.rect(document.querySelector('[data-time-row="33"] [data-sheet-cols]')));
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(700);
    out.popover = await page.evaluate(() => !!document.querySelector('[role="dialog"], [data-sheet-popover]'));
    out.afterTap1 = normMitIds(await readMits(page)).length - before;
    if (out.afterTap1 === 0 && out.popover) { // 相手を選ぶ小窓が出た場合は先頭を選ぶ
      await page.keyboard.press('Escape');
    }
  }
  const after1 = await readMits(page);
  out.afterPlaceDelta = after1.length - before;
  out.placed = normMitIds(after1.filter((m) => !/^sp2-m/.test(m.id))).map((m) => ({ ownerId: m.ownerId, time: m.time, mitigationId: m.mitigationId }));
  out.icons = await page.evaluate(() => window.__rg.rects('.cursor-grab', window.__rg.sc()));
  if (cond.view === 'lanes') {
    // 右クリックで消す
    const pos = await iconCenter(page, 'MT', 33);
    out.iconFound = !!pos;
    if (pos) {
      await page.mouse.click(pos.x, pos.y, { button: 'right' });
      await page.waitForTimeout(500);
      out.afterRightClickDelta = (await readMits(page)).length - before;
    }
  } else if (out.afterPlaceDelta > 0) {
    // もう 1 回押して消す
    const p = await page.evaluate(() => { const b = document.querySelector('[data-time-row="33"] [data-sheet-cols]').getBoundingClientRect(); return { x: b.left + 6, y: b.top + b.height / 2 }; });
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(700);
    out.afterTap2Delta = (await readMits(page)).length - before;
  }
  // 取り消し(Ctrl+Z)・やり直し(Ctrl+Shift+Z)
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  out.afterUndoDelta = (await readMits(page)).length - before;
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(400);
  out.afterRedoDelta = (await readMits(page)).length - before;
  return out;
};

/** ポインタでドラッグ(縦)。 */
async function dragBy(page, from, dx, dy, { hold = 0, steps = 12 } = {}) {
  if (!from) return false;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
  if (hold) await page.waitForTimeout(hold);
  await page.mouse.up();
  return true;
}
/** 軽減アイコンの中心(ふつう・スプシ・MIL-SPEC 共通)。data 属性は MIL-SPEC にしか無いので、
 *  行の上端(時刻)とメンバー列の横範囲(見出しの並び順)で探す。 */
const iconCenter = (page, owner, t) => page.evaluate(([o, t]) => {
  const row = document.querySelector(`[data-time-row="${t}"]`);
  if (!row) return null;
  const rb = row.getBoundingClientRect();
  const order = [...document.querySelectorAll('[data-member-id]')]
    .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map((e) => e.getAttribute('data-member-id'));
  const cols = [...row.querySelectorAll('[data-job-col]')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  const col = cols[order.indexOf(o)];
  if (!col) return null;
  const cb = col.getBoundingClientRect();
  const icon = [...document.querySelectorAll('.timeline-scroll-container .cursor-grab')].find((e) => {
    const b = e.getBoundingClientRect();
    const cy = b.top + b.height / 2;
    return cy >= rb.top && cy <= rb.bottom && b.left + b.width / 2 >= cb.left && b.left + b.width / 2 <= cb.right;
  });
  if (!icon) return null;
  const b = icon.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}, [owner, t]);

/** B1.3/B1.4/B1.5: 縦ドラッグ・置けない所・競合 */
PROBES.drag = async (page) => {
  const out = {};
  const p = await iconCenter(page, 'H1', 123); // ホロス(スプシにも列がある技)
  out.found = !!p;
  await dragBy(page, p, 0, 75); // 3 行ぶん下(18 秒刻みの行 × 25px)
  await page.waitForTimeout(800);
  out.afterValidDrag = (await readMits(page)).filter((m) => m.id === 'sp2-m4').map((m) => m.time);
  // 置けない所: 前提の技(テンパランス)の効果の窓の外へ「神授の愛撫」(H2・51 秒)を落とす → 元に戻り通知が出る
  const q = await iconCenter(page, 'H2', 51);
  out.foundInvalid = !!q;
  const t0 = (await readMits(page)).filter((m) => m.id === 'rg-dc').map((m) => m.time);
  await dragBy(page, q, 0, 50); // 51 → 87(テンパランス 33 秒の窓 30 秒の外)
  await page.waitForTimeout(500);
  out.invalidToast = await page.evaluate(() => /配置できません/.test(document.body.innerText));
  out.invalidToastRect = await page.evaluate(() => { const e = [...document.querySelectorAll('body *')].filter((d) => [...d.childNodes].some((n) => n.nodeType === 3 && /配置できません/.test(n.textContent || '')))[0]; return window.__rg.rect(e || null); });
  await page.waitForTimeout(700);
  out.invalidTimeBefore = t0; out.invalidTimeAfter = (await readMits(page)).filter((m) => m.id === 'rg-dc').map((m) => m.time);
  out.invalidIconBackRect = await (async () => { const c = await iconCenter(page, 'H2', 51); return c && [Math.round(c.x * 100) / 100, Math.round(c.y * 100) / 100]; })();
  // 画面の上下端での自動スクロール: ドラッグ中に下端の近くで止める
  const q2 = await iconCenter(page, 'H1', 177) || await iconCenter(page, 'H1', 123);
  const sbox = await page.evaluate(() => window.__rg.rect(window.__rg.sc()));
  const top0 = await page.evaluate(() => window.__rg.sc().scrollTop);
  if (!q2) { out.autoScroll = 'icon-not-found'; return out; }
  await page.mouse.move(q2.x, q2.y); await page.mouse.down();
  await page.mouse.move(q2.x, sbox[1] + sbox[3] - 8, { steps: 10 });
  await page.waitForTimeout(900);
  const top1 = await page.evaluate(() => window.__rg.sc().scrollTop);
  await page.mouse.move(q2.x, sbox[1] + 8, { steps: 6 });
  await page.waitForTimeout(900);
  const top2 = await page.evaluate(() => window.__rg.sc().scrollTop);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(500);
  out.autoScroll = { downIncreased: top1 > top0, upDecreased: top2 < top1 };
  await page.evaluate(() => { window.__rg.sc().scrollTop = 0; });
  await page.waitForTimeout(300);
  return out;
};

/** B1.5: 競合の赤い輪・画面外の競合矢印・押すと飛ぶ(別読み込み。競合する配置を足して始める) */
PROBES.conflict = async (page, cond) => {
  const out = {};
  out.ring = await page.evaluate(() => document.querySelectorAll('.animate-conflict-pulse').length);
  out.ringCenters = await page.evaluate(() => window.__rg.centers('.animate-conflict-pulse')); // 脈動(拡大縮小)で寸法が揺れるので中心だけ
  const arrows = async () => page.evaluate(() => window.__rg.centers('button[aria-label*="競合あり"]')); // 脈動で寸法が揺れるので中心だけ
  out.arrows = await arrows();
  if (out.arrows.length) {
    const b = await page.evaluate(() => { const e = document.querySelector('button[aria-label*="競合あり"]'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(1600);
    out.afterClickScrollTop = await page.evaluate(() => Math.round(window.__rg.sc().scrollTop));
    out.arrowsAfter = await arrows();
    out.ringAfterCenters = await page.evaluate(() => window.__rg.centers('.animate-conflict-pulse'));
  }
  return out;
};

const MOVE_THEN_WAIT = async (page, x, y, ms = 400) => { await page.mouse.move(x, y); await page.waitForTimeout(ms); };

/** メモモードに入る(ボタンの押し方は標準と MIL-SPEC で違う=スイッチ。store で確実に入れて、入ったことを確かめる)。 */
async function enterMemoMode(page) {
  await withStore(page, MIT, (m) => m.useMitigationStore.getState().setToolMode('memo'));
  await page.waitForTimeout(500);
  const mode = await withStore(page, MIT, (m) => m.useMitigationStore.getState().toolMode);
  if (mode !== 'memo') throw new Error(`メモモードに入れない: ${mode}`);
}

/** B2.1/2.2/2.4/2.5: メモ */
PROBES.memo = async (page, cond) => {
  const out = {};
  await enterMemoMode(page);
  const target = async (sel, dx = 0.5) => page.evaluate(([sel, dx]) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.left + b.width * dx, y: b.top + b.height / 2, rect: window.__rg.rect(document.querySelector(sel)) }; }, [sel, dx]);
  const laneSel = cond.view === 'sheet' ? '[data-time-row="33"] [data-sheet-cols]' : '[data-time-row="33"] [data-job-col]';
  const saveMemo = async (text) => {
    const ok = await page.waitForSelector('textarea', { timeout: 2500 }).then(() => true, () => false);
    if (!ok) return false;
    await page.waitForTimeout(600); // 入力欄は出た後に画面の端へ寄せ直すので、落ち着いてから測る
    out.lastInputRect = await page.evaluate(() => window.__rg.rect(document.querySelector('textarea')));
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    return true;
  };
  // 作成(メンバー列)。複数のメンバー列で確かめる(先頭・先頭から 3 つ目)
  const cells = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }), laneSel);
  out.created = [];
  const mitsBefore = (await readMits(page)).length;
  for (const idx of [0, 1]) { // 画面に見えているメンバー列(スプシは横に長く、3 列目以降は画面の外)
    const c = cells[idx];
    await page.mouse.click(c.x, c.y);
    const opened = await saveMemo(`作成${idx}`);
    const ms = normMemoIds(await readMemos(page));
    out.created.push({ idx, mitsDelta: (await readMits(page)).length - mitsBefore, click: [Math.round(c.x * 100) / 100, Math.round(c.y * 100) / 100], inputOpened: opened, memo: opened ? ms[ms.length - 1] : null });
  }
  out.memoCountAfterCreate = (await readMemos(page)).length;
  // 情報列の上(時間の列)を押しても作らない
  const info = await target('[data-time-row="33"] [class*="--col-time-w"]');
  await page.mouse.click(info.x, info.y);
  await page.waitForTimeout(500);
  out.infoClickCreatesInput = await page.evaluate(() => !!document.querySelector('textarea'));
  if (out.infoClickCreatesInput) await page.keyboard.press('Escape');
  // 横に動かした状態で、同じ画面位置(情報列があった所)を押す
  const maxX = await page.evaluate(() => { const s = window.__rg.sc(); return s.scrollWidth - s.clientWidth; });
  if (maxX > 1) {
    await page.evaluate((x) => { window.__rg.sc().scrollLeft = x; }, maxX);
    await page.waitForTimeout(500);
    const before = (await readMemos(page)).length;
    await page.mouse.click(info.x, info.y);
    await page.waitForTimeout(500);
    out.scrolledInfoClickCreatesInput = await page.evaluate(() => !!document.querySelector('textarea'));
    if (out.scrolledInfoClickCreatesInput) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    out.scrolledMemoCountDelta = (await readMemos(page)).length - before;
    await page.evaluate(() => { window.__rg.sc().scrollLeft = 0; });
    await page.waitForTimeout(400);
  }
  // 既存メモのドラッグ・押して編集・右クリックで削除(Escape でメモモードが終わることがあるので入れ直す)
  const ensureMemoMode = async () => { await withStore(page, MIT, (m) => m.useMitigationStore.getState().setToolMode('memo')); await page.waitForTimeout(400); };
  await ensureMemoMode();
  const mm = await page.evaluate(() => { const e = document.querySelector('[data-memo-id="rg-memo-1"]'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, rect: window.__rg.rect(e) }; });
  out.memoRectBefore = mm && mm.rect;
  if (mm) {
    await dragBy(page, mm, 40, 25 * 2);
    await page.waitForTimeout(600);
    out.afterDrag = (await readMemos(page)).filter((m) => m.id === 'rg-memo-1');
    out.memoRectAfterDrag = await page.evaluate(() => window.__rg.rect(document.querySelector('[data-memo-id="rg-memo-1"]')));
    const m2 = await page.evaluate(() => { const b = document.querySelector('[data-memo-id="rg-memo-1"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await page.mouse.click(m2.x, m2.y);
    await page.waitForTimeout(500);
    out.editInput = await page.evaluate(() => { const t = document.querySelector('textarea'); return t ? { rect: window.__rg.rect(t), value: t.value } : null; });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    out.toolModeAfterEscape = await withStore(page, MIT, (m) => m.useMitigationStore.getState().toolMode);
    await withStore(page, MIT, (m) => m.useMitigationStore.getState().setToolMode('memo'));
    await page.waitForTimeout(400);
    const m3 = await page.evaluate(() => { const e = document.querySelector('[data-memo-id="rg-memo-3"]'); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    const nBefore = (await readMemos(page)).length;
    await page.mouse.click(m3.x, m3.y, { button: 'right' });
    await page.waitForTimeout(500);
    out.afterRightClickDelta = (await readMemos(page)).length - nBefore;
  }
  return out;
};

/** B2.5: 上限(100 件)で作れず通知が出る */
PROBES.memoLimit = async (page, cond) => {
  const out = {};
  await enterMemoMode(page);
  const laneSel = cond.view === 'sheet' ? '[data-time-row="33"] [data-sheet-cols]' : '[data-time-row="33"] [data-job-col]';
  const c = await page.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, laneSel);
  const n0 = (await readMemos(page)).length;
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(700);
  out.count = n0;
  out.inputOpened = await page.evaluate(() => !!document.querySelector('textarea'));
  out.toast = await page.evaluate(() => /メモは最大 100 件までです/.test(document.body.innerText));
  return out;
};

/** B3.1/B3.3/B3.4: 自分のカーソル送信・表示モード違い・ON/OFF */
PROBES.cursor = async (page, cond) => {
  const out = {};
  await withStore(page, 'src/store/useCursorSendStore.ts', (m) => {
    window.__sent = [];
    m.useCursorSendStore.setState({ broadcaster: (p) => { window.__sent.push({ pos: p.pos }); }, localClientId: 7 });
  });
  await withStore(page, 'src/store/useCollabPresenceStore.ts', (m) => m.useCollabPresenceStore.setState({ cursorEnabled: true }));
  await page.waitForTimeout(500);
  const lastSent = async () => page.evaluate(() => { const s = window.__sent; return s.length ? s[s.length - 1].pos : null; });
  const probeAt = async (name, x, y) => {
    await page.evaluate(() => { window.__sent.length = 0; });
    await page.mouse.move(x - 30, y - 10);
    await page.mouse.move(x, y, { steps: 3 });
    await page.waitForTimeout(500);
    out[name] = await lastSent();
  };
  const g = await page.evaluate(() => {
    const row = document.querySelector('[data-time-row="51"]').getBoundingClientRect();
    const jc = document.querySelectorAll('[data-time-row="51"] [data-job-col]');
    const lane = jc[1].getBoundingClientRect(); // 2 列目(スプシでも画面に見える)
    const tm = document.querySelector('[data-time-row="51"] [class*="--col-time-w"]').getBoundingClientRect();
    const mech = document.querySelector('[data-time-row="51"] [class*="--col-mechanic-w"]').getBoundingClientRect();
    return { lane: { x: lane.left + lane.width / 2, y: row.top + 12 }, time: { x: tm.left + tm.width / 2, y: row.top + 12 }, mech: { x: mech.left + 30, y: row.top + 12 } };
  });
  await probeAt('sentLane', g.lane.x, g.lane.y);
  await probeAt('sentTimeCol', g.time.x, g.time.y);
  await probeAt('sentMechanicCol', g.mech.x, g.mech.y);
  const maxX = await page.evaluate(() => { const s = window.__rg.sc(); return s.scrollWidth - s.clientWidth; });
  if (maxX > 1) {
    await page.evaluate((x) => { window.__rg.sc().scrollLeft = x; }, maxX);
    await page.waitForTimeout(500);
    await probeAt('scrolledSentSameLanePoint', g.lane.x, g.lane.y);
    await probeAt('scrolledSentSameTimeColPoint', g.time.x, g.time.y);
    await page.evaluate(() => { window.__rg.sc().scrollLeft = 0; });
    await page.waitForTimeout(400);
  }
  // 表示モードの違う相手(roster に view を載せる)=今のコードでは view を見ない(RosterEntry に view が無い)
  await injectPeers(page);
  out.remoteDrawn = await page.evaluate(() => document.querySelectorAll('[data-cursor-id]').length);
  await withStore(page, 'src/store/useCollabPresenceStore.ts', (m) => m.useCollabPresenceStore.setState({
    roster: m.useCollabPresenceStore.getState().roster.map((r) => ({ ...r, view: 'sheet' })),
  }));
  await page.waitForTimeout(500);
  out.remoteDrawnWhenPeerViewDiffers = await page.evaluate(() => document.querySelectorAll('[data-cursor-id]').length);
  out.rosterHasViewField = await withStore(page, 'src/lib/collab/presence.ts', (m) => typeof m.buildRoster === 'function' ? m.buildRoster.toString().includes('view') : null).catch(() => null);
  // ON/OFF: OFF にしたら送らない
  await withStore(page, 'src/store/useCollabPresenceStore.ts', (m) => m.useCollabPresenceStore.setState({ cursorEnabled: false }));
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__sent.length = 0; });
  await page.mouse.move(g.lane.x - 20, g.lane.y);
  await page.mouse.move(g.lane.x, g.lane.y + 10, { steps: 4 });
  await page.waitForTimeout(600);
  out.sentCountAfterOff = await page.evaluate(() => window.__sent.length);
  return out;
};

const HOVER_PROPS = ['background-color', 'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color', 'font-weight', 'opacity', 'outline-style', 'outline-color', 'box-shadow', 'color'];
const AFTER_PROPS = ['content', 'display', 'opacity', 'left', 'width', 'height', 'background-color', 'border-bottom-color', 'transform'];

/** B4.1/B4.2/B4.3/B4.5: ホバー・ホバー強調・列のツールチップ・進捗の記録モード */
PROBES.hover = async (page, cond) => {
  const out = {};
  const snapRow = async (t) => page.evaluate(({ t, HOVER_PROPS, AFTER_PROPS }) => {
    const G = window.__rg;
    const rows = [...document.querySelectorAll(`[data-time-row="${t}"]`)];
    const row = rows[0];
    const timeEl = row.querySelector('[class*="--col-time-w"]');
    const mech = row.querySelector('[class*="--col-mechanic-w"]');
    const plus = row.querySelector('button[aria-label*="イベントを追加"]');
    const job = row.querySelector('[data-job-col]');
    return {
      rowCss: G.css(row, HOVER_PROPS), rowAfter: G.css(row, AFTER_PROPS, '::after'), rowBefore: G.css(row, AFTER_PROPS, '::before'),
      timeCss: G.css(timeEl, HOVER_PROPS), mechCss: G.css(mech, HOVER_PROPS), plusCss: G.css(plus, HOVER_PROPS),
      jobCss: G.css(job, HOVER_PROPS), rowHoverMatches: rows.map((r) => r.matches(':hover')),
      hl: (() => { const h = document.querySelector('.table-hover-hl'); return h ? { display: h.style.display, rect: G.rect(h), transform: h.style.transform, w: h.style.width, h: h.style.height } : null; })(),
    };
  }, { t, HOVER_PROPS, AFTER_PROPS });
  const pos = await page.evaluate(() => {
    const rowEl = document.querySelector('[data-time-row="69"]');
    const row = rowEl.getBoundingClientRect();
    const jc = [...rowEl.querySelectorAll('[data-job-col]')];
    const lane = jc[1].getBoundingClientRect();
    const mech = rowEl.querySelector('[class*="--col-mechanic-w"]').getBoundingClientRect();
    const dmg = rowEl.querySelectorAll('[class*="--col-counter-w"]')[0].getBoundingClientRect();
    return { rowTop: row.top, lane: { x: lane.left + lane.width * 0.5, y: row.top + 12 }, mech: { x: mech.left + 20, y: row.top + 12 }, dmg: { x: dmg.left + dmg.width / 2, y: row.top + 12 }, away: { x: row.left + 100, y: row.top - 80 } };
  });
  await page.mouse.move(pos.away.x, pos.away.y); await page.waitForTimeout(1500);
  out.none = await snapRow(69);
  await MOVE_THEN_WAIT(page, pos.mech.x, pos.mech.y, 1500);
  out.infoSide = await snapRow(69);
  await MOVE_THEN_WAIT(page, pos.dmg.x, pos.dmg.y, 1500);
  out.counterSide = await snapRow(69);
  await MOVE_THEN_WAIT(page, pos.lane.x, pos.lane.y, 1500);
  out.laneSide = await snapRow(69);
  out.laneSideHl = await page.evaluate(() => { const h = document.querySelector('.table-hover-hl'); return h ? { shown: h.style.display === 'block', rect: window.__rg.rect(h) } : null; });
  // 情報列の上ではレーンの強調を出さない
  await MOVE_THEN_WAIT(page, pos.mech.x, pos.mech.y, 400);
  out.hlOverInfo = await page.evaluate(() => { const h = document.querySelector('.table-hover-hl'); return h ? { shown: h.style.display === 'block' } : null; });
  // 列のツールチップ(スプシのみ)。レーン側で止める → 固定列の上では出さない
  if (cond.view === 'sheet') {
    await MOVE_THEN_WAIT(page, pos.lane.x, pos.lane.y, 1200);
    out.colTooltipOverLane = await page.evaluate(() => { const t = document.querySelector('[data-sheet-col-tooltip]'); return t ? { id: t.getAttribute('data-sheet-col-tooltip'), rect: window.__rg.rect(t) } : null; });
    await MOVE_THEN_WAIT(page, pos.mech.x, pos.mech.y, 1000);
    out.colTooltipOverInfo = await page.evaluate(() => { const t = document.querySelector('[data-sheet-col-tooltip]'); return t ? { id: t.getAttribute('data-sheet-col-tooltip') } : null; });
  }
  // 進捗の記録モード(B4.5)
  await page.mouse.move(pos.away.x, pos.away.y);
  await withStore(page, 'src/components/progress/useProgressRecording.ts', (m) => m.useProgressRecording.getState().startRecordMode());
  await page.waitForTimeout(400);
  out.recordModeLaneHover = await (async () => { await MOVE_THEN_WAIT(page, pos.lane.x, pos.lane.y, 1500); return snapRow(69); })();
  out.recordModeInfoHover = await (async () => { await MOVE_THEN_WAIT(page, pos.mech.x, pos.mech.y, 1500); return snapRow(69); })();
  const mitsBefore = (await readMits(page)).length;
  const points = async () => withStore(page, MIT, (m) => m.useMitigationStore.getState().progress.points.map((p) => p.reachedPos));
  await page.mouse.click(pos.lane.x, pos.lane.y);
  await page.waitForTimeout(700);
  out.clickLaneRecordedPoints = await points();
  await withStore(page, 'src/components/progress/useProgressRecording.ts', (m) => m.useProgressRecording.getState().startRecordMode());
  await page.waitForTimeout(300);
  await page.mouse.click(pos.mech.x, pos.mech.y);
  await page.waitForTimeout(700);
  out.clickInfoRecordedPoints = await points();
  out.mitsDelta = (await readMits(page)).length - mitsBefore;
  out.selectorOpenedInRecordMode = await page.evaluate(() => !!document.querySelector('[data-tutorial-modal]'));
  return out;
};

/** B4.4: フェーズの開始/終了を表から選ぶモード(プレビュー枠・preview-highlight) */
PROBES.select = async (page) => {
  const out = {};
  const bandPos = await page.evaluate(() => {
    const e = [...document.querySelectorAll('div')].find((d) => d.children.length <= 2 && d.textContent.trim().startsWith('Phase 1') && d.getBoundingClientRect().height > 60);
    const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40 };
  });
  await page.mouse.click(bandPos.x, bandPos.y);
  await page.waitForTimeout(500);
  await page.getByText('フェーズを編集').click();
  await page.waitForTimeout(600);
  await page.getByText('タイムラインで選択').nth(1).click(); // 終了時間を表から選ぶ
  await page.waitForTimeout(600);
  const pts = await page.evaluate(() => {
    const row = document.querySelector('[data-time-row="123"]').getBoundingClientRect();
    const mech = document.querySelector('[data-time-row="123"] [class*="--col-mechanic-w"]').getBoundingClientRect();
    const lane = document.querySelectorAll('[data-time-row="123"] [data-job-col]')[1].getBoundingClientRect();
    return { info: { x: mech.left + 20, y: row.top + 12 }, lane: { x: lane.left + lane.width / 2, y: row.top + 12 } };
  });
  const snap = async () => page.evaluate(() => {
    const G = window.__rg;
    const sheet = G.sheet();
    return {
      containerClass: ['phase-select-preview', 'label-select-preview'].filter((c) => sheet.classList.contains(c) || G.sc().classList.contains(c)),
      highlightedRows: [...document.querySelectorAll('.preview-highlight')].length,
      highlightedTimes: [...new Set([...document.querySelectorAll('.preview-highlight')].map((e) => e.closest('[data-time-row]')?.getAttribute('data-time-row') ?? e.getAttribute('data-time-row')))].sort(),
      overlay: (() => { const o = [...sheet.querySelectorAll('.border-app-blue')].find((e) => e.className.includes('z-20')); return o ? { display: o.style.display, rect: G.rect(o) } : null; })(),
    };
  });
  await page.mouse.move(pts.info.x, pts.info.y); await page.waitForTimeout(500);
  out.hoverInfo = await snap();
  await page.mouse.move(pts.lane.x, pts.lane.y); await page.waitForTimeout(500);
  out.hoverLane = await snap();
  await page.mouse.click(pts.lane.x, pts.lane.y); await page.waitForTimeout(600);
  out.afterClickPhases = await withStore(page, MIT, (m) => m.useMitigationStore.getState().phases.map((p) => [p.startTime, p.endTime]));
  out.afterClick = await snap();
  return out;
};

/** B5.1〜5.5: 行の開閉・ジャンプ・リキャスト行・列の折りたたみ・戦闘前 */
PROBES.rows = async (page) => {
  const out = {};
  const centerTime = async () => page.evaluate(() => {
    const sc = window.__rg.sc(); const sr = sc.getBoundingClientRect(); const cy = sr.top + sr.height / 2;
    let best = null, bd = 1e9;
    document.querySelectorAll('[data-time-row]').forEach((e) => { const b = e.getBoundingClientRect(); const d = Math.abs(b.top + b.height / 2 - cy); if (d < bd) { bd = d; best = e.getAttribute('data-time-row'); } });
    return { time: Number(best), scrollTop: Math.round(sc.scrollTop) };
  });
  // 5.2 ジャンプ(進捗の時刻へ・プラン切替で先頭へ)。コンパクト表示のうちに行う
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('progress:jump-to-time', { detail: { time: 300 } })));
  await page.waitForTimeout(1800);
  out.afterJumpTo300 = await centerTime();
  await page.evaluate(() => { const s = window.__rg.sc(); s.scrollLeft = 60; });
  await page.waitForTimeout(300);
  await withStore(page, 'src/store/usePlanStore.ts', (m) => m.usePlanStore.setState({ currentPlanId: 'rg-debug-2' }));
  await page.waitForTimeout(1200);
  out.afterPlanSwitch = await page.evaluate(() => { const s = window.__rg.sc(); return { top: Math.round(s.scrollTop), left: Math.round(s.scrollLeft) }; });
  await withStore(page, 'src/store/usePlanStore.ts', (m) => m.usePlanStore.setState({ currentPlanId: 'rg-debug' }));
  await page.waitForTimeout(800);
  // 5.1 見ていた時刻が展開しても画面中央に残る
  await page.evaluate(() => { window.__rg.sc().scrollTop = 200; });
  await page.waitForTimeout(700);
  out.beforeExpand = await centerTime();
  await toggleExpand(page);
  await page.waitForTimeout(1500);
  out.afterExpand = await centerTime();
  out.rowCountExpanded = await page.evaluate(() => document.querySelectorAll('[data-time-row]').length);
  await toggleExpand(page);
  await page.waitForTimeout(1500);
  out.afterCollapseBack = await centerTime();
  // 5.3 リキャスト行(縦スクロールで今の時刻のアイコン)
  const recast = async () => page.evaluate(() => ({
    cells: [...document.querySelectorAll('.recast-cell')].map((e) => ({ member: e.getAttribute('data-member'), active: e.getAttribute('data-recast-active'), rect: window.__rg.rect(e), imgs: e.querySelectorAll('img').length })),
  }));
  await page.evaluate(() => { window.__rg.sc().scrollTop = 0; });
  await page.waitForTimeout(600);
  out.recastTop = await recast();
  await page.evaluate(() => { window.__rg.sc().scrollTop = 250; });
  await page.waitForTimeout(800);
  out.recastScrolled250 = await recast();
  await page.evaluate(() => { window.__rg.sc().scrollTop = 0; });
  await page.waitForTimeout(500);
  // 5.4 フェーズ列・ラベル列の折りたたみ(情報列の幅が変わる)
  const infoGeom = async () => page.evaluate(() => {
    const G = window.__rg;
    const q = (s) => G.rects(`[data-time-row="33"] ${s}`);
    return { phase: q('[data-phase-col]'), label: q('[data-label-col]'), time: q('[class*="--col-time-w"]'), mechanic: q('[class*="--col-mechanic-w"]'), jobCols: q('[data-job-col]'), members: G.rects('[data-member-id]'), scrollWidth: G.sc().scrollWidth, sheetW: G.sheet().offsetWidth };
  });
  out.infoInitial = await infoGeom();
  await page.keyboard.press('Shift+P'); await page.waitForTimeout(700);
  out.infoPhaseCollapsed = await infoGeom();
  await page.keyboard.press('Shift+L'); await page.waitForTimeout(700);
  out.infoBothCollapsed = await infoGeom();
  await page.keyboard.press('Shift+P'); await page.waitForTimeout(500);
  await page.keyboard.press('Shift+L'); await page.waitForTimeout(700);
  out.infoRestored = await infoGeom();
  // 5.5 戦闘前(-10 秒)は常に表示(切替の UI は無い=showPreStart は固定 true)
  out.preStartRowExists = await page.evaluate(() => !!document.querySelector('[data-time-row="-10"]'));
  return out;
};

/** B6.2/B6.3: 表示の切替・列を隠す・パーティの表示/非表示 */
PROBES.view = async (page, cond) => {
  const out = {};
  const dims = async () => page.evaluate(() => { const G = window.__rg; const s = G.sc(); return { scrollWidth: s.scrollWidth, clientWidth: s.clientWidth, sheetW: G.sheet().offsetWidth, members: G.rects('[data-member-id]'), rowParts: document.querySelectorAll('[data-time-row]').length, sheetCols: document.querySelectorAll('[data-sheet-cols]').length }; });
  out.initial = await dims();
  await page.getByText(cond.view === 'lanes' ? 'スプシ' : 'ふつう', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  out.afterToggleView = await dims();
  await page.getByText(cond.view === 'lanes' ? 'ふつう' : 'スプシ', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  out.afterToggleBack = await dims();
  // スプシで列を隠す・罫線の別設定はここでは「スプシ表示で行罫線設定を切り替えた」結果のみ(UI: 行罫線トグルは store)
  await page.getByText('スプシ', { exact: true }).first().click();
  await page.waitForTimeout(1200);
  out.sheetDims = await dims();
  await withStore(page, 'src/store/useMitigationStore.ts', (m) => m.useMitigationStore.getState().setSheetRowBorders?.call ? 0 : 0).catch(() => {});
  await withStore(page, 'src/store/useThemeStore.ts', (m) => m.useThemeStore.getState().setTimelineView('lanes'));
  await page.waitForTimeout(800);
  // 6.3 パーティの非表示/表示
  await page.getByRole('button', { name: 'D4を非表示' }).click();
  await page.waitForTimeout(900);
  out.afterHideD4 = await dims();
  await page.getByRole('button', { name: 'D3を非表示' }).click();
  await page.waitForTimeout(900);
  out.afterHideD3D4 = await dims();
  await page.getByRole('button', { name: 'D4を表示' }).click().catch(() => {});
  await page.getByRole('button', { name: 'D3を表示' }).click().catch(() => {});
  await page.waitForTimeout(900);
  out.afterShowBack = await dims();
  return out;
};

/** B9.4〜9.7 と B9.5/B9.6: サイドバー・文字の拡大・閲覧専用・キーボード */
PROBES.misc = async (page, cond) => {
  const out = {};
  const dims = async () => snapGeom(page, { times: [51] });
  // 9.4 サイドバーの開閉(S キー)
  out.sidebarOpen = await dims();
  await page.mouse.move(5, 5);
  await page.keyboard.press('s'); await page.waitForTimeout(1500);
  out.sidebarClosed = await dims();
  await page.keyboard.press('s'); await page.waitForTimeout(1500);
  out.sidebarReopened = await dims();
  // 9.5 文字の拡大設定(UI 未実装。変数だけ 1.3 にする)
  await page.evaluate(() => document.documentElement.style.setProperty('--text-scale-multiplier', '1.3'));
  await page.waitForTimeout(1000);
  out.textScale13 = await dims();
  await page.evaluate(() => document.documentElement.style.removeProperty('--text-scale-multiplier'));
  await page.waitForTimeout(700);
  // 9.7 キーボードで表の中の要素へ移ったとき(固定列の裏に隠れないか): 軽減アイコンへフォーカスを移して scrollLeft と位置を記録
  const focusIcon = async (which) => page.evaluate((which) => {
    const G = window.__rg; const sc = G.sc();
    const icons = [...sc.querySelectorAll('.cursor-grab')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const el = which === 'rightmost' ? icons[icons.length - 1] : icons[0];
    if (!el) return { found: false };
    el.setAttribute('tabindex', '0');
    el.focus();
    return { found: true, scrollLeftAfter: G.r3(sc.scrollLeft), rect: G.rect(el), scroller: G.rect(sc) };
  }, which);
  const maxX = await page.evaluate(() => { const s = window.__rg.sc(); return s.scrollWidth - s.clientWidth; });
  if (maxX > 1) {
    await page.evaluate(() => { window.__rg.sc().scrollLeft = 0; }); await page.waitForTimeout(400);
    out.focusRightmostFromLeft = await focusIcon('rightmost'); // 右の端のアイコン: 横に動いて見える所へ来るか
    await page.waitForTimeout(500);
    out.focusRightmostAfter = await page.evaluate(() => ({ scrollLeft: window.__rg.r3(window.__rg.sc().scrollLeft) }));
    await page.evaluate((x) => { window.__rg.sc().scrollLeft = x; }, maxX); await page.waitForTimeout(500);
    out.focusLeftmostFromRight = await focusIcon('leftmost'); // 左のアイコン(固定列のすぐ右・または裏)
    await page.waitForTimeout(500);
    out.focusLeftmostAfter = await page.evaluate(() => ({ scrollLeft: window.__rg.r3(window.__rg.sc().scrollLeft) }));
    await page.evaluate(() => { window.__rg.sc().scrollLeft = 0; });
    await page.waitForTimeout(400);
  }
  // 9.6 閲覧専用(readOnly): 置けない・動かせない(store の閲覧専用を立てる)
  await withStore(page, MIT, (m) => { m.useMitigationStore.setState({ _collabReadonly: true, _collabActive: false }); });
  await page.waitForTimeout(500);
  const n0 = (await readMits(page)).length;
  const sel = cond.view === 'sheet' ? '[data-time-row="33"] [data-sheet-cols]' : '[data-time-row="33"] [data-job-col]';
  const c = await page.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.left + 6, y: b.top + b.height / 2 }; }, sel);
  await page.mouse.click(c.x, c.y); await page.waitForTimeout(600);
  out.readOnlyClickMitsDelta = (await readMits(page)).length - n0;
  out.readOnlySelectorOpen = await page.evaluate(() => !!document.querySelector('[data-tutorial-modal]'));
  const ip = await iconCenter(page, 'H1', 123);
  await dragBy(page, ip, 0, 75); await page.waitForTimeout(700);
  out.readOnlyDragTime = (await readMits(page)).filter((m) => m.id === 'sp2-m4').map((m) => m.time);
  if (ip) await page.mouse.click(ip.x, ip.y, { button: 'right' });
  await page.waitForTimeout(500);
  out.readOnlyRightClickMitsDelta = (await readMits(page)).length - n0;
  return out;
};

/** B7.5/B7.7: MIL-SPEC の照準・行の描き込みの動き */
PROBES.milspec = async (page) => {
  const out = {};
  const ret = async () => page.evaluate(() => [...document.querySelectorAll('.milspec-ret')].map((e) => ({ head: e.hasAttribute('data-head'), on: e.classList.contains('on'), flip: e.classList.contains('flip'), rect: window.__rg.rect(e), tag: e.querySelector('.milspec-ret-tag')?.textContent ?? '' })));
  const ic = await iconCenter(page, 'H1', 123);
  await page.mouse.move(5, 5);
  if (ic) await MOVE_THEN_WAIT(page, ic.x, ic.y, 700);
  out.overIcon = await ret();
  const mech = await page.evaluate(() => { const b = document.querySelector('[data-time-row="69"] [class*="--col-mechanic-w"]').getBoundingClientRect(); return { x: b.left + 20, y: b.top + 12 }; });
  await MOVE_THEN_WAIT(page, mech.x, mech.y, 700);
  out.overMechanic = await ret();
  // 見出しの照準が引く対象は `#timeline-header-inner > :nth-child(-n+4)`(最初の 4 つ)。3 つ目(時刻)に乗せる
  const head = await page.evaluate(() => { const b = document.querySelector('#timeline-header-inner > :nth-child(3)').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  const tcell = await page.evaluate(() => { const b = document.querySelector('[data-time-row="69"]').children[2].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await MOVE_THEN_WAIT(page, tcell.x, tcell.y, 700);
  out.overTimeCell = await ret();
  await MOVE_THEN_WAIT(page, head.x, head.y, 700);
  out.overHeader = await ret();
  // 右端(見えている範囲の端)に近いアイコンで照準のタグが左へ折り返す
  const maxX = await page.evaluate(() => { const s = window.__rg.sc(); return s.scrollWidth - s.clientWidth; });
  if (maxX > 1) {
    await page.evaluate((x) => { window.__rg.sc().scrollLeft = x; }, maxX); await page.waitForTimeout(500);
    const ic2 = await iconCenter(page, 'D2', 339).catch(() => null);
    const ic3 = await page.evaluate(() => { const e = [...document.querySelectorAll('[data-mit-icon]')].pop(); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    const t = ic3 || ic2;
    if (t && t.y > 0 && t.y < 679) { await MOVE_THEN_WAIT(page, t.x, t.y, 700); out.overIconScrolledMax = await ret(); }
    await page.evaluate(() => { window.__rg.sc().scrollLeft = 0; });
  }
  return out;
};

/** B7.7: 行の描き込み(動きを減らす設定を切った別ページで。プラン切替をきっかけに milspec-pr が付くか) */
async function probePrint(cond) {
  const { browser, page } = await openPage(cond, { motion: 'no-preference', extraInit: `(() => { window.__prSeen = new Set(); new MutationObserver((ms) => { for (const m of ms) if (m.target.classList && m.target.classList.contains('milspec-pr')) window.__prSeen.add(m.target.getAttribute('data-time-row')); }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] }); })();` });
  try {
    const out = {};
    await page.evaluate(() => { window.__prSeen.clear(); });
    // きっかけ = プランの切替(MilspecRowPrinter)。見えている行に順に milspec-pr が付く
    await withStore(page, 'src/store/usePlanStore.ts', (m) => m.usePlanStore.setState({ currentPlanId: 'rg-debug-2' }));
    await page.waitForTimeout(2800);
    out.printedRowsSeen = await page.evaluate(() => window.__prSeen.size > 0);
    out.printedRowCount = await page.evaluate(() => window.__prSeen.size);
    out.visibleRows = await page.evaluate(() => { const s = window.__rg.sc().getBoundingClientRect(); return [...document.querySelectorAll('[data-time-row]')].filter((e) => { const b = e.getBoundingClientRect(); return b.bottom > s.top && b.top < s.bottom; }).length; });
    out.leftoverClassCount = await page.evaluate(() => document.querySelectorAll('.milspec-pr').length); // アニメが終われば 0
    return out;
  } finally { await browser.close(); }
}

/** B8.1: スマホ(390×844)の DOM の骨組みと位置 */
async function probeMobile(theme) {
  const cond = { id: `mobile-${theme.id}`, vp: { w: 390, h: 844, dsf: 3 }, theme, view: 'lanes', party: 8 };
  const { browser, page } = await (async () => {
    const b = await launch({ theme: theme.mode, viewport: { width: 390, height: 844 }, dsf: 3 });
    const storage = buildStorage(cond);
    await b.page.addInitScript(({ storage, theme }) => {
      try {
        for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, JSON.stringify(v));
        localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: theme.mode, themeStyle: theme.style, contentLanguage: 'ja', mobileEffectBarMode: 'icon', timelineView: 'lanes' }, version: 3 }));
      } catch { /* 無視 */ }
    }, { storage, theme });
    await b.page.addInitScript(HELPERS_SRC);
    await b.page.goto(`${BASE_URL}/miti`, { waitUntil: 'domcontentloaded' });
    await b.page.waitForFunction(() => document.querySelectorAll('[data-time-row]').length > 3, null, { timeout: 30000 });
    await b.page.waitForTimeout(theme.style === 'military' ? 2200 : 1500);
    return b;
  })();
  try {
    return await page.evaluate(async () => {
      const G = window.__rg;
      const root = document.querySelector('[data-timeline-root]');
      const norm = (html) => html.replace(/ style="[^"]*"/g, '').replace(/\s+/g, ' ');
      const enc = new TextEncoder().encode(norm(root.outerHTML));
      const digest = await crypto.subtle.digest('SHA-256', enc);
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const tagCount = {}; root.querySelectorAll('*').forEach((e) => { tagCount[e.tagName] = (tagCount[e.tagName] || 0) + 1; });
      return {
        skeletonSha256: hex, elementCount: root.querySelectorAll('*').length, tagCount,
        rowCount: document.querySelectorAll('[data-time-row]').length,
        firstRows: [...document.querySelectorAll('[data-time-row]')].slice(0, 6).map(G.rect),
        scroller: { rect: G.rect(G.sc()), scrollWidth: G.sc().scrollWidth, clientWidth: G.sc().clientWidth },
        header: G.rect(document.querySelector('#timeline-header-inner')),
      };
    });
  } finally { await browser.close(); }
}

// ───────────────────────────── 実行 ─────────────────────────────
function wantProbe(name) { return !PROBE_FILTER || PROBE_FILTER.has(name); }

// ───────────────────────────── 比較 ─────────────────────────────
function isAllowed(p) { return ALLOW.some((a) => p.includes(a)); }
/** @returns {string[]} 差分(許容外) */
function diffAny(a, b, p, acc, allowedAcc) {
  const rec = (msg) => (isAllowed(p) ? allowedAcc : acc).push(`${p}: ${msg}`);
  if (typeof a === 'number' && typeof b === 'number') {
    const tol = p.includes('/precise/') ? TOL_PRECISE : TOL;
    if (Math.abs(a - b) > tol) rec(`${a} -> ${b} (差 ${Math.round((b - a) * 1000) / 1000})`);
    return;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    if (a !== b) rec(`${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    return;
  }
  if (Array.isArray(a) !== Array.isArray(b)) { rec('配列とオブジェクトの違い'); return; }
  if (Array.isArray(a)) {
    if (a.length !== b.length) { rec(`長さ ${a.length} -> ${b.length}`); return; }
    a.forEach((_, i) => diffAny(a[i], b[i], `${p}[${i}]`, acc, allowedAcc));
    return;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in a)) rec(`キー追加 ${k}`);
    else if (!(k in b)) rec(`キー消失 ${k}`);
    else diffAny(a[k], b[k], `${p}/${k}`, acc, allowedAcc);
  }
}

// ───────────────────────────── main ─────────────────────────────
const JOBS = Math.max(1, Number(typeof args.jobs === 'string' ? args.jobs : 3));

/** 同時に JOBS 個まで走らせる。 */
async function pool(tasks) {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) { const i = next++; await tasks[i](); }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, tasks.length) }, worker));
}
const errMsg = (e) => String(e && e.message ? e.message : e).split('\n')[0];

/** 動作確認の名前を、実際に走らせる単位(別ページ)へ展開する。--probe の絞り込みも適用。 */
function expandProbes(names) {
  const out = [];
  for (const parent of names) {
    const subs = parent === 'drag' ? ['drag', 'conflict'] : parent === 'memo' ? ['memo', 'memoLimit'] : [parent];
    for (const sub of subs) if (!PROBE_FILTER || PROBE_FILTER.has(sub) || PROBE_FILTER.has(parent)) out.push(sub);
  }
  return [...new Set(out)];
}

/** 条件ごとの動作確認。各確認は新しいページ(状態が混ざらない)。 */
async function runBehaviorFor(cond, subs) {
  const items = {}, errors = [];
  const over = {
    conflict: { timelineMitigations: [
      ...MITIGATION_FIXTURE.map((m) => ({ ...m })),
      { id: 'rg-c1', mitigationId: 'tactician', ownerId: 'D1', time: 465, duration: 15 }, // 画面の下にある競合(画面外の矢印)
      { id: 'rg-c2', mitigationId: 'tactician', ownerId: 'D1', time: 483, duration: 15 },
      { id: 'rg-c3', mitigationId: 'vengeance', ownerId: 'MT', time: 69, duration: 15 }, // 51 秒の復讐の再使用時間の中(見える位置)
    ] },
    drag: { timelineMitigations: [
      ...MITIGATION_FIXTURE.map((m) => ({ ...m })),
      { id: 'rg-tp', mitigationId: 'temperance', ownerId: 'H2', time: 33, duration: 20 },
      { id: 'rg-dc', mitigationId: 'divine_caress', ownerId: 'H2', time: 51, duration: 10 }, // テンパランスの窓(30 秒)の中
    ] },
    memoLimit: { memos: Array.from({ length: 100 }, (_, i) => ({ id: `rg-lim-${i}`, text: `m${i}`, timeSec: 15 + (i % 30) * 18, xRatio: 0.55 + (i % 10) * 0.03, createdAt: i, updatedAt: i })) },
  };
  for (const sub of subs) {
    const t0 = Date.now();
    let ctx;
    try {
      ctx = await openPage(cond, { over: over[sub] || {} });
      items[`probe.${sub}`] = await PROBES[sub](ctx.page, cond);
    } catch (e) {
      items[`probe.${sub}`] = { error: errMsg(e) };
      errors.push(`${cond.id} ${sub}: ${errMsg(e)}`);
    } finally {
      if (ctx) await ctx.browser.close();
    }
    const bad = items[`probe.${sub}`].error;
    console.log(`  beh ${cond.id} ${sub} (${((Date.now() - t0) / 1000).toFixed(1)}s)${bad ? ' ERROR ' + bad : ''}`);
  }
  return { items, errors };
}

async function main() {
  if (args.list) {
    for (const c of ALL_CONDS) console.log(c.id);
    console.log('--- 動作の確認(項目 → 条件) ---');
    for (const [k, v] of Object.entries(BEH)) console.log(`${k}: ${v.join(', ')}`);
    return 0;
  }
  if (COMPARE && !fs.existsSync(fileOf(COMPARE))) {
    console.error(`baseline が無い: ${fileOf(COMPARE)}(先に --out=${COMPARE} で取る)`);
    return 1;
  }
  const selCond = (c) => !ONLY || c.id.includes(ONLY);
  const result = {
    meta: { baseUrl: BASE_URL, tolerancePx: TOL, tolerancePrecisePx: TOL_PRECISE, only: ONLY, node: process.version, gitSha: gitSha() },
    conds: {},
  };
  const slot = (id) => (result.conds[id] ??= { items: {} }).items;
  const errors = [];
  const t00 = Date.now();

  const tasks = [];
  if (!args['beh-only'] && wantProbe('geom')) {
    for (const cond of ALL_CONDS.filter(selCond)) {
      tasks.push(async () => {
        const t0 = Date.now();
        try {
          Object.assign(slot(cond.id), await probeGeom(cond));
          console.log(`geom ${cond.id} ok (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        } catch (e) {
          errors.push(`geom ${cond.id}: ${errMsg(e)}`);
          slot(cond.id).geom = { error: errMsg(e) };
          console.log(`geom ${cond.id} ERROR ${errMsg(e)}`);
        }
      });
    }
  }
  if (!args['geom-only']) {
    const byCond = new Map();
    for (const [probeName, conds] of Object.entries(BEH)) {
      for (const id of conds) {
        const cond = condById(id);
        if (!cond || !selCond(cond)) continue;
        if (!byCond.has(id)) byCond.set(id, []);
        byCond.get(id).push(probeName);
      }
    }
    for (const [id, names] of byCond) {
      const subs = expandProbes(names);
      if (!subs.length) continue;
      tasks.push(async () => {
        const r = await runBehaviorFor(condById(id), subs);
        Object.assign(slot(id), r.items);
        errors.push(...r.errors);
      });
    }
    if (wantProbe('print')) {
      for (const id of BEH.milspec) {
        const cond = condById(id);
        if (!cond || !selCond(cond)) continue;
        tasks.push(async () => {
          try { slot(id)['probe.print'] = await probePrint(cond); console.log(`  beh ${id} print ok`); } catch (e) { errors.push(`${id} print: ${errMsg(e)}`); slot(id)['probe.print'] = { error: errMsg(e) }; }
        });
      }
    }
    if (wantProbe('mobile')) {
      for (const theme of MOBILE_THEMES) {
        const id = `mobile-390-${theme.id}`;
        if (ONLY && !id.includes(ONLY)) continue;
        tasks.push(async () => {
          try { slot(id).mobile = await probeMobile(theme); console.log(`  mobile ${id} ok`); } catch (e) { errors.push(`${id} mobile: ${errMsg(e)}`); slot(id).mobile = { error: errMsg(e) }; }
        });
      }
    }
  }
  if (args['no-run']) {
    // 保存済みの結果ファイルを読むだけ(比較のやり直し用)
    const all = JSON.parse(fs.readFileSync(fileOf(OUT), 'utf8')).conds;
    for (const [id, v] of Object.entries(all)) if (!ONLY || id.includes(ONLY)) result.conds[id] = v;
  } else {
    await pool(tasks);
  }

  fs.mkdirSync(BASE_DIR, { recursive: true });
  result.conds = JSON.parse(JSON.stringify(result.conds)); // NaN/Infinity は保存すると null になるので、比較も同じ形で行う
  // 並べ順を固定(並行で走らせても出力が変わらない)
  const sorted = {};
  for (const k of Object.keys(result.conds).sort()) {
    sorted[k] = { items: Object.fromEntries(Object.keys(result.conds[k].items).sort().map((i) => [i, result.conds[k].items[i]])) };
  }
  result.conds = sorted;
  if (!args['no-run']) fs.writeFileSync(fileOf(OUT), JSON.stringify(result, null, 1));
  console.log(`\n保存: ${fileOf(OUT)}(${((Date.now() - t00) / 1000).toFixed(0)}s・条件 ${Object.keys(result.conds).length})`);

  let code = 0;
  if (errors.length) {
    console.error(`\n確認の失敗 ${errors.length} 件:`);
    for (const e of errors.slice(0, 30)) console.error(`  - ${e}`);
    code = 2;
  }

  if (COMPARE) {
    const base = JSON.parse(fs.readFileSync(fileOf(COMPARE), 'utf8'));
    const acc = [], allowedAcc = [];
    let compared = 0;
    for (const id of Object.keys(result.conds)) {
      if (!base.conds[id]) { acc.push(`${id}: baseline にこの条件が無い`); continue; }
      compared++;
      const a = base.conds[id].items, b = result.conds[id].items;
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(k in b) && (args['beh-only'] || args['geom-only'] || PROBE_FILTER)) continue; // 今回取っていない項目は比べない
        if (!(k in a)) { acc.push(`${id}/${k}: baseline に無い項目`); continue; }
        if (!(k in b)) { acc.push(`${id}/${k}: 今回の結果に無い項目`); continue; }
        diffAny(a[k], b[k], `${id}/${k}`, acc, allowedAcc);
      }
    }
    console.log(`\n比較 ${COMPARE}: ${compared} 条件・許容 ${TOL}px(precise は ${TOL_PRECISE}px)`);
    if (allowedAcc.length) {
      console.log(`--allow(${ALLOW.join(', ')}) で見逃した差分 ${allowedAcc.length} 件(報告書に理由を書くこと)。先頭 10 件:`);
      for (const d of allowedAcc.slice(0, 10)) console.log(`  ~ ${d}`);
    }
    if (acc.length) {
      console.error(`意図しない差分 ${acc.length} 件。先頭 40 件:`);
      for (const d of acc.slice(0, 40)) console.error(`  ! ${d}`);
      code = 1;
    } else {
      console.log('差 0(許容内)');
    }
  }
  return code;
}

export { openPage, PROBES, condById, iconCenter, withStore, readMits, readMemos };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(3); });
}
