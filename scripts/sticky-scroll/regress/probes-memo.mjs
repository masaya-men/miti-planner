import { PROBES, dragBy, enterMemoMode } from './helpers.mjs';
import { withStore, MIT, readMits, readMemos, normMemoIds } from './page.mjs';

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
