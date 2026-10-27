import { openPage, toggleExpand, withStore } from './page.mjs';

// ───────────────────────────── 幾何の記録 ─────────────────────────────
/** 画面上の位置・寸法の静止画。scroll を動かした状態でも同じ形で取る。 */
export async function snapGeom(page, { times = [15, 51] } = {}) {
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

export async function injectPeers(page) {
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
export async function probeGeom(cond) {
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
