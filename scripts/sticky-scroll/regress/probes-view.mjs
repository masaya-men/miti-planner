import { PROBES, MOVE_THEN_WAIT } from './helpers.mjs';
import { withStore, MIT, readMits, toggleExpand } from './page.mjs';
import { injectPeers } from './geom.mjs';

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
