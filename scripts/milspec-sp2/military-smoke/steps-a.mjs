import { state, step, fail, getState, MITI_STORE } from './state.mjs';
import { applyFixture } from '../_fixture.mjs';
import { readFileSync } from 'node:fs';

// 切替ボタンの aria-label は翻訳 app.theme_style_switch(「見た目を切り替える」等)。どの言語で開いても見つかるよう 5 言語分を並べる
const TOGGLE_SELECTOR = ['ja', 'en', 'zh', 'zh-Hant', 'ko']
  .map((lng) => JSON.parse(readFileSync(new URL(`../../../src/locales/${lng}.json`, import.meta.url), 'utf8')).app.theme_style_switch)
  .map((label) => `button[aria-label="${label}"]`)
  .join(', ');

export async function runStepsA(viewport) {
  const { page } = state;

    // ── step 1: 入口 assert + 軍事モード + fixture ───────────────────
    await step('標準ヘッダーの MIL-SPEC 切替ボタンが可視 → 軍事モードへ + fixture', async () => {
      const toggle = page.locator(TOGGLE_SELECTOR).first();
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
      // ここまでの分岐 (対象が無い / 画面外) は fixture の行配置ずれ由来 = WARN 許容。
      // ドラッグ「列を実行したのに time が変わらない」場合はドラッグ機構の回帰 = hard fail。
      if ((await handle.count()) === 0) return 'WARN: ドラッグ対象 (Holos) が見つからない — fixture の行配置が変わった可能性';
      const box = await handle.boundingBox();
      if (!box) return 'WARN: Holos バーの boundingBox が取れない (画面外)';
      const vp = page.viewportSize();
      if (box.y < 0 || box.y + box.height > vp.height - 130) {
        return `WARN: Holos バーがドラッグ余地のある viewport 内に無い (y=${Math.round(box.y)})`;
      }
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
        fail(
          `ドラッグ列 (down → move×N → up) を実行したが timelineMitigations['sp2-m4'].time が ` +
            `${beforeTime}s のまま変化しない — ドラッグ機構の回帰`,
        );
      }
      return `time ${beforeTime}s → ${afterTime}s`;
    });

    // ── step 3: 折りたたむボタン (Area A) ON/OFF ────────────────
    await step('Undo / Redo が軍事モードでも 1 往復する (Ctrl+Z / Ctrl+Y)', async () => {
      // GC2 が名指ししている「編集機能を壊さない」項目のうち Undo/Redo は本ブランチで
      // 一度も踏まれていなかった (レビュー I5)。直前の step 2 のドラッグ移動を 1 往復する。
      // 前ステップが WARN でドラッグしていなくても成立するよう、特定 id の time ではなく
      // timelineMitigations のスナップショット全体で比較する (= 何であれ 1 手戻って 1 手進む)。
      // 往復後は必ず元の状態へ戻るので後続ステップ (削除 / tank セル) に影響しない。
      const snap0 = JSON.stringify(await getState(MITI_STORE, 'timelineMitigations'));
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(350);
      const snap1 = JSON.stringify(await getState(MITI_STORE, 'timelineMitigations'));
      if (snap1 === snap0) fail('Ctrl+Z で timelineMitigations が変化しない — Undo の回帰');
      await page.keyboard.press('Control+y');
      await page.waitForTimeout(350);
      const snap2 = JSON.stringify(await getState(MITI_STORE, 'timelineMitigations'));
      if (snap2 !== snap0) {
        fail(
          `Ctrl+Y で Undo 前の状態に戻らない — Redo の回帰 ` +
            `(${JSON.parse(snap0).length} → ${JSON.parse(snap1).length} → ${JSON.parse(snap2).length} 件)`,
        );
      }
      return `Undo で変化 (${JSON.parse(snap0).length} → ${JSON.parse(snap1).length} 件) → Redo で完全復帰`;
    });

    await step('折りたたむボタン (Area A) を ON/OFF', async () => {
      const btn = page.locator('#timeline-controls-inner [data-deck="expand"]').first();
      if ((await btn.count()) === 0) fail('表を展開スライド ([data-deck=expand]) が見つからない');
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
      const btn = page.locator('#timeline-controls-inner [data-deck="aa"]').first();
      if ((await btn.count()) === 0) fail('AA 追加キー ([data-deck=aa]) が見つからない');
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
      const btn = page.locator('#timeline-controls-inner [data-deck="memo"]').first();
      if ((await btn.count()) === 0) fail('メモロッカー ([data-deck=memo]) が見つからない');
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
      const btn = page.locator('#timeline-controls-inner [data-deck="recast"]').first();
      if ((await btn.count()) === 0) fail('リキャストロッカー ([data-deck=recast]) が見つからない');
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
      // ここまでの分岐 (ヘッダー無し / ドロップダウン開かず / フェーズ項目無し) は WARN 許容。
      // 「ドロップダウンが開き、フェーズ 1 ボタンを click した」のに scrollTop が動かない
      // 場合はフェーズジャンプの回帰 = hard fail。
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
        return 'WARN: フェーズ項目ボタンが無い (fixture にフェーズが入っていない?)';
      }
      await phaseBtn.click();
      await page.waitForTimeout(600);
      const topAfter = await sc.evaluate((el) => el.scrollTop);
      if (topAfter === topBefore) {
        fail(
          `フェーズドロップダウンを開きフェーズ 1 ボタンを click したが .timeline-scroll-container の ` +
            `scrollTop が ${Math.round(topBefore)} のまま変化しない — フェーズジャンプの回帰`,
        );
      }
      return `scrollTop ${Math.round(topBefore)} → ${Math.round(topAfter)} (フェーズ 1 へジャンプ)`;
    });
}
