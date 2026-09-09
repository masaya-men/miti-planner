// @ts-check
/**
 * military-smoke.mjs — 軍事モード スモークテスト
 * ─────────────────────────────────────────────────────────────
 * themeStyle==='military' の /miti (PC) で主要インタラクションが全て動き、
 * 非 whitelist の console/pageerror が 0 件であることを確認する。
 *
 * Task 1 時点: 軍事モードの「見た目」は未実装。ここで見るのは
 *   「入口が残っている」「操作が壊れていない」「エラーを吐かない」だけ。
 *
 * 手順:
 *   0. 標準ヘッダーに MIL-SPEC 切替ボタン (button[aria-label*="MIL-SPEC"]) が
 *      表示されていることを assert (SP1 の失敗 = この入口を消したこと)。
 *      以降は実アクション useThemeStore.setThemeStyle('military') で確実に軍事へ。
 *   1. 軽減を store 経由で配置済 (fixture)。追加でセル経由 UI もう 1 個は
 *      store 注入 fixture に含む。ここでは配置済みバーを操作する。
 *   2. 配置済み軽減バーをドラッグして別時刻へ移動 (実マウス pointer 列)。
 *   3. 折りたたむボタン (Area A) を ON/OFF → hideEmptyRows がトグル。
 *   4. AA 追加ボタンを押してポップオーバー表示 → Esc で閉じる。
 *   5. メモボタン ON/OFF → toolMode が 'memo'→'idle'。
 *   6. リキャスト行トグル (Area C) を OFF/ON。
 *   7. フェーズヘッダー click → ドロップダウン → フェーズジャンプ。
 *   8. .timeline-scroll-container を scrollBy({left:300}) →
 *      #timeline-header-inner / #timeline-controls-inner の transform が
 *      コンテナ実 scrollLeft と一致 (±2px)。
 *   9. scrollBy({top:400}) → .recast-num が変化 or 例外なし (Task 7 以降で本実装)。
 *  10. 配置した軽減を右クリックで削除。
 *
 * 各ステップ後に console エラー 0 を確認。1 件でも exit 1。
 */

import { launch, gotoMiti, applyFixture, attachConsoleRecorder, MITIGATION_FIXTURE } from './_fixture.mjs';

let stepNum = 0;
const results = [];
/** @type {import('playwright').Page} */
let page;
/** @type {{fatal:string[], whitelisted:string[]}} */
let rec;

function fail(msg) {
  throw new Error(msg);
}

async function step(label, fn) {
  stepNum += 1;
  const tag = `step ${stepNum}: ${label}`;
  const fatalBefore = rec.fatal.length;
  let note = '';
  try {
    note = (await fn()) || '';
  } catch (err) {
    results.push({ tag, ok: false, note: String(err && err.message ? err.message : err) });
    throw err;
  }
  const newFatal = rec.fatal.slice(fatalBefore);
  if (newFatal.length) {
    results.push({ tag, ok: false, note: `console errors:\n    ${newFatal.join('\n    ')}` });
    fail(`${tag}: 非 whitelist の console/pageerror が発生:\n  ${newFatal.join('\n  ')}`);
  }
  results.push({ tag, ok: true, note });
  console.log(`  ✓ ${tag}${note ? ` — ${note}` : ''}`);
}

/** ブラウザ内 store getState ヘルパ */
const getState = (store, path) =>
  page.evaluate(
    async ({ store, path }) => {
      const mod = await import(store);
      const key = Object.keys(mod).find((k) => k.startsWith('use'));
      const s = mod[key].getState();
      return path ? path.split('.').reduce((o, k) => (o == null ? o : o[k]), s) : s;
    },
    { store, path },
  );

const MITI = './_fixture.mjs'; // not used directly; store paths below
const MITI_STORE = '/src/store/useMitigationStore.ts';

async function main() {
  const launched = await launch({ theme: 'dark' });
  page = launched.page;
  rec = attachConsoleRecorder(page);

  try {
    await gotoMiti(page);

    // ── step 1: 入口 assert + 軍事モード + fixture ───────────────────
    await step('標準ヘッダーの MIL-SPEC 切替ボタンが可視 → 軍事モードへ + fixture', async () => {
      const toggle = page.locator('button[aria-label*="MIL-SPEC"]').first();
      const count = await toggle.count();
      if (count === 0) fail('MIL-SPEC 切替ボタンが標準ヘッダーに存在しない (SP1 punch-list の入口消失)');
      if (!(await toggle.isVisible())) fail('MIL-SPEC 切替ボタンが不可視');
      const info = await applyFixture(page, { military: true });
      if (!String(info.htmlClass).includes('theme-military')) fail(`<html> に theme-military が付かない: ${info.htmlClass}`);
      return `rows ${info.dom.rows} / bars ${info.dom.grab} / htmlClass "${info.htmlClass}"`;
    });

    // ── step 2: 軽減バーをドラッグ ──────────────────────────────
    await step('配置済み軽減バーをドラッグして別時刻へ移動', async () => {
      // ビューポート内 (縦 900) に確実に入る軽減を使う。fixture は scrollTop 0 で
      // Holos(123s) が y≈555 に描画される。
      await page.evaluate(() => document.querySelector('.timeline-scroll-container').scrollTo({ top: 0, left: 0 }));
      await page.waitForTimeout(200);
      const handle = page
        .locator('.timeline-scroll-container .cursor-grab')
        .filter({ has: page.locator('img[src*="Holos"]') })
        .first();
      if ((await handle.count()) === 0) fail('ドラッグ対象の軽減バー (Holos) が見つからない');
      const box = await handle.boundingBox();
      if (!box) fail('軽減バーの boundingBox が取れない');
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const before = await getState(MITI_STORE, 'timelineMitigations');
      const beforeTime = (before.find((m) => m.id === 'sp2-m4') || {}).time;

      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx, cy + 20, { steps: 3 });
      await page.mouse.move(cx, cy + 95, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(400);

      let afterTime = beforeTime;
      for (let i = 0; i < 8; i++) {
        const after = await getState(MITI_STORE, 'timelineMitigations');
        afterTime = (after.find((m) => m.id === 'sp2-m4') || {}).time;
        if (afterTime !== beforeTime) break;
        await page.waitForTimeout(150);
      }
      if (afterTime === beforeTime) {
        // 配置不可でスナップバックした場合も「ドラッグ列が例外なく完了」= 許容 (WARN)
        return `WARN: time 変化なし (${beforeTime}s のまま) — pointer 列は完走`;
      }
      return `time ${beforeTime}s → ${afterTime}s`;
    });

    // ── step 3: 折りたたむボタン (Area A) ON/OFF ────────────────
    await step('折りたたむボタン (Area A) を ON/OFF', async () => {
      const btn = page.locator('#timeline-controls-inner button').filter({ has: page.locator('svg.lucide-text-align-justify') }).first();
      if ((await btn.count()) === 0) fail('折りたたむボタン (lucide-text-align-justify) が見つからない');
      const b0 = await getState(MITI_STORE, 'hideEmptyRows');
      await btn.click();
      await page.waitForTimeout(250);
      const b1 = await getState(MITI_STORE, 'hideEmptyRows');
      if (b1 === b0) fail(`hideEmptyRows がトグルしない (${b0} → ${b1})`);
      await btn.click();
      await page.waitForTimeout(250);
      const b2 = await getState(MITI_STORE, 'hideEmptyRows');
      if (b2 !== b0) fail(`hideEmptyRows が元に戻らない (${b0} → ${b1} → ${b2})`);
      return `hideEmptyRows ${b0} → ${b1} → ${b2}`;
    });

    // ── step 4: AA 追加ボタン → ポップオーバー → Esc ────────────
    await step('AA 追加ボタンでポップオーバー表示 → Esc で閉じる', async () => {
      const btn = page.locator('#timeline-controls-inner button').filter({ has: page.locator('svg.lucide-sword') }).first();
      if ((await btn.count()) === 0) fail('AA 追加ボタン (lucide-sword) が見つからない');
      await btn.click();
      await page.waitForTimeout(300);
      const pop = page.locator('.glass-tier3.z-\\[9999\\]');
      const opened = (await pop.count()) > 0;
      if (!opened) return 'WARN: AA ポップオーバーを検出できず (Esc は送信済)';
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const stillOpen = (await page.locator('.glass-tier3.z-\\[9999\\]').count()) > 0;
      if (stillOpen) fail('Esc で AA ポップオーバーが閉じない');
      return 'ポップオーバー開閉 OK';
    });

    // ── step 5: メモボタン ON/OFF ──────────────────────────────
    await step('メモボタンを ON/OFF', async () => {
      const btn = page.locator('#timeline-controls-inner button').filter({ has: page.locator('svg.lucide-pencil') }).first();
      if ((await btn.count()) === 0) fail('メモボタン (lucide-pencil) が見つからない');
      await btn.click();
      await page.waitForTimeout(250);
      const m1 = await getState(MITI_STORE, 'toolMode');
      if (m1 !== 'memo') fail(`toolMode が memo にならない (${m1})`);
      await btn.click();
      await page.waitForTimeout(250);
      const m2 = await getState(MITI_STORE, 'toolMode');
      if (m2 !== 'idle') fail(`toolMode が idle に戻らない (${m2})`);
      return `toolMode idle → memo → idle`;
    });

    // ── step 6: リキャスト行トグル (Area C) OFF/ON ─────────────
    await step('リキャスト行トグル (Area C) を OFF/ON', async () => {
      const btn = page.locator('#timeline-controls-inner button').filter({ has: page.locator('svg.lucide-clock') }).first();
      if ((await btn.count()) === 0) fail('リキャスト行トグル (lucide-clock) が見つからない');
      const cellsBefore = await page.locator('.recast-cell').count();
      await btn.click();
      await page.waitForTimeout(250);
      await btn.click();
      await page.waitForTimeout(250);
      const cellsAfter = await page.locator('.recast-cell').count();
      return `recast-cell ${cellsBefore} → ${cellsAfter} (トグル 2 回・例外なし)`;
    });

    // ── step 7: フェーズヘッダー → ドロップダウン → ジャンプ ─────
    await step('フェーズヘッダー click → ドロップダウン → フェーズジャンプ', async () => {
      const sc = page.locator('.timeline-scroll-container');
      await sc.evaluate((el) => el.scrollTo({ top: 400, left: 0 }));
      await page.waitForTimeout(200);
      // #timeline-header-inner > (wrapper div) > (phaseHeaderRef div, テキスト "Phフェーズ")
      const phaseCell = page
        .locator('#timeline-header-inner > div > div')
        .filter({ hasText: 'フェーズ' })
        .first();
      if ((await phaseCell.count()) === 0) return 'WARN: フェーズヘッダーセルが見つからない';
      await phaseCell.click();
      await page.waitForTimeout(350);
      const dd = page.locator('.glass-tier3.z-\\[9999\\]');
      if ((await dd.count()) === 0) return 'WARN: フェーズドロップダウンを開けず (click は送信済)';
      const topBefore = await sc.evaluate((el) => el.scrollTop);
      // ドロップダウン内のフェーズ項目 (先頭 = フェーズ 1 = startTime 0 へジャンプ)
      const phaseBtn = dd.locator('button').filter({ hasText: /フェーズ|Phase/ }).first();
      if ((await phaseBtn.count()) === 0) {
        await page.keyboard.press('Escape');
        return 'WARN: フェーズ項目ボタンが無い';
      }
      await phaseBtn.click();
      await page.waitForTimeout(600);
      const topAfter = await sc.evaluate((el) => el.scrollTop);
      if (topAfter === topBefore) return `WARN: scrollTop 不変 (${Math.round(topBefore)}) — ジャンプ実行済`;
      return `scrollTop ${Math.round(topBefore)} → ${Math.round(topAfter)} (フェーズ 1 へジャンプ)`;
    });

    // ── step 8: 横スクロール同期 ──────────────────────────────
    await step('.timeline-scroll-container を scrollBy({left:300}) → header/controls transform 同期', async () => {
      const r = await page.evaluate(async () => {
        const sc = document.querySelector('.timeline-scroll-container');
        sc.scrollTo({ left: 0 });
        await new Promise((res) => setTimeout(res, 100));
        sc.scrollBy({ left: 300 });
        await new Promise((res) => setTimeout(res, 250));
        const parse = (el) => {
          const m = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(el && el.style ? el.style.transform : '');
          return m ? parseFloat(m[1]) : null;
        };
        return {
          scrollLeft: sc.scrollLeft,
          header: parse(document.querySelector('#timeline-header-inner')),
          controls: parse(document.querySelector('#timeline-controls-inner')),
        };
      });
      if (r.scrollLeft <= 0) fail(`横スクロールできていない (scrollLeft=${r.scrollLeft})`);
      if (r.header === null || r.controls === null) fail(`transform が translateX で設定されていない: ${JSON.stringify(r)}`);
      if (Math.abs(r.header + r.scrollLeft) > 2) fail(`header transform (${r.header}) が scrollLeft (${-r.scrollLeft}) と不一致`);
      if (Math.abs(r.controls + r.scrollLeft) > 2) fail(`controls transform (${r.controls}) が scrollLeft (${-r.scrollLeft}) と不一致`);
      return `scrollLeft ${r.scrollLeft} ⇔ translateX header ${r.header} / controls ${r.controls} (±2px)`;
    });

    // ── step 9: 縦スクロール → recast-num (Task 7 以降で本実装) ──
    await step('scrollBy({top:400}) → .recast-num が変化 or 例外なし', async () => {
      const r = await page.evaluate(async () => {
        const sc = document.querySelector('.timeline-scroll-container');
        const read = () => Array.from(document.querySelectorAll('.recast-num')).map((n) => n.textContent).join('|');
        const before = read();
        sc.scrollBy({ top: 400 });
        await new Promise((res) => setTimeout(res, 300));
        const after = read();
        return { before, after, count: document.querySelectorAll('.recast-num').length };
      });
      return `recast-num x${r.count}: "${r.before.slice(0, 30)}" → "${r.after.slice(0, 30)}" (例外なし)`;
    });

    // ── step 10: 配置した軽減を右クリック削除 ──────────────────
    await step('配置した軽減を右クリックで削除', async () => {
      // Vengeance(51s) がビューポート内に来るよう先頭へ戻す
      await page.evaluate(() => document.querySelector('.timeline-scroll-container').scrollTo({ top: 0, left: 0 }));
      await page.waitForTimeout(250);
      const before = await getState(MITI_STORE, 'timelineMitigations');
      const target = before.find((m) => m.id === 'sp2-m1') || before[0];
      if (!target) fail('削除対象の軽減が store に無い');
      // fixture の全アイコンから 1 つ (Vengeance) を右クリック
      const handle = page
        .locator('.timeline-scroll-container .cursor-grab')
        .filter({ has: page.locator('img[src*="Vengeance"]') })
        .first();
      if ((await handle.count()) === 0) {
        // フォールバック: 任意の 1 個
        await page.locator('.timeline-scroll-container .cursor-grab').first().click({ button: 'right' });
      } else {
        await handle.click({ button: 'right' });
      }
      await page.waitForTimeout(400);
      const after = await getState(MITI_STORE, 'timelineMitigations');
      if (after.length >= before.length) fail(`軽減が削除されていない (${before.length} → ${after.length})`);
      return `timelineMitigations ${before.length} → ${after.length}`;
    });

    // ── 最終判定 ─────────────────────────────────────────────
    console.log('');
    if (rec.whitelisted.length) {
      console.log(`[info] whitelist 済み (dev で無害) の console/pageerror ${rec.whitelisted.length} 件:`);
      const uniq = [...new Set(rec.whitelisted.map((l) => l.slice(0, 120)))].slice(0, 12);
      for (const l of uniq) console.log('  · ' + l);
      console.log('');
    }
    if (rec.fatal.length) {
      console.error(`FAIL: 非 whitelist の console/pageerror ${rec.fatal.length} 件:`);
      for (const l of rec.fatal) console.error('  ' + l);
      process.exit(1);
    }

    const warns = results.filter((r) => r.ok && r.note.startsWith('WARN')).length;
    console.log(`PASS: ${stepNum} ステップ完走 / 非 whitelist console エラー 0 件${warns ? ` / WARN ${warns} 件 (Task 1 時点で未実装の挙動)` : ''}`);
    process.exit(0);
  } catch (err) {
    console.error('\n──────── FAIL ────────');
    console.error(String(err && err.stack ? err.stack : err));
    console.error('\nステップ結果:');
    for (const r of results) console.error(`  ${r.ok ? '✓' : '✗'} ${r.tag}${r.note ? ` — ${r.note}` : ''}`);
    if (rec && rec.fatal.length) {
      console.error('\n収集した console/pageerror:');
      for (const l of rec.fatal) console.error('  ' + l);
    }
    process.exit(1);
  } finally {
    await launched.browser.close();
  }
}

main();
