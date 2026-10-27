import crypto from 'node:crypto';
import { launch } from '../../milspec-sp2/_fixture.mjs';
import { BASE_URL } from './config.mjs';
import { buildStorage } from './data.mjs';
import { PROBES, dragBy, iconCenter, MOVE_THEN_WAIT } from './helpers.mjs';
import { openPage, withStore, MIT, readMits, HELPERS_SRC } from './page.mjs';
import { snapGeom } from './geom.mjs';

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
export async function probePrint(cond) {
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
export async function probeMobile(theme) {
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
