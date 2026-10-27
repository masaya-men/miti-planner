import { PROBES, dragBy, iconCenter } from './helpers.mjs';
import { readMits, normMitIds } from './page.mjs';

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
