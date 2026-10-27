import { launch } from '../../milspec-sp2/_fixture.mjs';
import { BASE_URL } from './config.mjs';
import { buildStorage } from './data.mjs';

// ───────────────────────────── ページ操作の共通 ─────────────────────────────
/** @param {typeof ALL_CONDS[number] | {vp:any, theme:any, view:string, party:number}} cond */
export async function openPage(cond, { over = {}, motion = 'reduce', extraInit } = {}) {
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
export const HELPERS_SRC = `(() => {
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
export const toggleExpand = async (page) => {
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
export async function withStore(page, rel, fn, arg) {
  const url = await page.evaluate((rel) => {
    const hit = performance.getEntriesByType('resource').map((x) => x.name).find((n) => n.includes('/' + rel));
    return hit || '/' + rel;
  }, rel);
  return page.evaluate(async ({ url, src, arg }) => {
    const m = await import(/* @vite-ignore */ url);
    return new Function('m', 'arg', `return (${src})(m, arg)`)(m, arg);
  }, { url, src: fn.toString(), arg });
}
export const MIT = 'src/store/useMitigationStore.ts';
export const readMits = (page) => withStore(page, MIT, (m) => m.useMitigationStore.getState().timelineMitigations.map((x) => ({ id: x.id, mitigationId: x.mitigationId, ownerId: x.ownerId, time: x.time })).sort((a, b) => (a.ownerId + a.time + a.mitigationId).localeCompare(b.ownerId + b.time + b.mitigationId)));
export const readMemos = (page) => withStore(page, MIT, (m) => m.useMitigationStore.getState().memos.map((x) => ({ id: x.id, text: x.text, timeSec: x.timeSec, xRatio: x.xRatio })));
export const normMemoIds = (list) => list.map((x) => ({ ...x, id: x.id.startsWith('memo_') ? 'memo_NEW' : x.id }));
export const normMitIds = (list) => list.map((x) => ({ ...x, id: /^rg-m|^sp2-m/.test(x.id) ? x.id : 'mit_NEW' })); // 新規 id は乱数
