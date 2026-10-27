import { state, step, fail, getState, MITI_STORE } from './state.mjs';
import { launch, gotoMiti, applyFixture } from '../_fixture.mjs';

export async function runStepsD(viewport) {
  const { page } = state;

    // ── step 16〜18: v11 サイドバー(コンテンツキー / シリーズ開閉 / まとめて共有) ──
    await step('コンテンツキーで絶タブ(aria-pressed がちょうど 1 つ・押したキーへ移る)', async () => {
      const keys = page.locator('[data-ms-zone="sidebar"] [role="group"] button.milspec-key');
      const n = await keys.count();
      if (n !== 4) fail(`コンテンツのキーが ${n} 個 (期待 4 個)`);
      // 押したあとに locator が別のキーへ解決し直されないよう、位置(nth)で固定する
      const before = await keys.evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed')));
      const idx = before.findIndex((v) => v === 'false');
      if (idx < 0) fail('押せる(aria-pressed=false の)コンテンツキーが無い');
      const target = keys.nth(idx);
      const label = ((await target.textContent()) || '').trim();
      await target.click();
      await page.waitForTimeout(400);
      const pressed = await keys.evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed')));
      if (pressed.filter((v) => v === 'true').length !== 1) fail(`押された状態のキーがちょうど 1 つではない: ${pressed.join(',')}`);
      if ((await target.getAttribute('aria-pressed')) !== 'true') fail(`押したキー「${label}」が押された状態にならない`);
      // 後続 step のため元のタブへ戻す
      const orig = before.findIndex((v) => v === 'true');
      if (orig >= 0) { await keys.nth(orig).click(); await page.waitForTimeout(400); }
      return `「${label}」へ切替 (${pressed.join(',')}) → 元のタブへ復帰`;
    });

    await step('シリーズの開閉で aria-expanded が反転する', async () => {
      const fold = page.locator('[data-ms-zone="sidebar"] .milspec-tr-fold').first();
      if ((await fold.count()) === 0) fail('シリーズの開閉ボタン (.milspec-tr-fold) が無い');
      const a0 = await fold.getAttribute('aria-expanded');
      await fold.click();
      await page.waitForTimeout(700);
      const a1 = await fold.getAttribute('aria-expanded');
      if (a1 === a0) fail(`aria-expanded が反転しない (${a0} → ${a1})`);
      await fold.click();
      await page.waitForTimeout(700);
      const a2 = await fold.getAttribute('aria-expanded');
      if (a2 !== a0) fail(`もう一度押しても元に戻らない (${a0} → ${a1} → ${a2})`);
      return `aria-expanded ${a0} → ${a1} → ${a2}`;
    });

    await step('まとめて共有キーで選択の帯が出て、Escape で消える', async () => {
      const share = page.locator('[data-ms-zone="sidebar"] button.milspec-key').filter({ hasText: /まとめて共有|Share/ }).first();
      if ((await share.count()) === 0) fail('まとめて共有キーが無い');
      await share.click();
      await page.waitForTimeout(500);
      if ((await page.locator('[data-ms-zone="sidebar"] .milspec-sb-selbar').count()) !== 1) fail('選択の帯 (.milspec-sb-selbar) が出ない');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      if ((await page.locator('[data-ms-zone="sidebar"] .milspec-sb-selbar').count()) !== 0) fail('Escape で選択の帯が消えない');
      return '帯が出る → Escape で消える';
    });

    // ── step 19〜22: v11 ヘッダー(タービン / 取っ手の開閉 / SORT / 昼夜ロッカー) ──
    await step('電源投入で TRB が自動で押され、タービンが回り出す(無効化・琥珀・羽根)→ 止まると戻り、手動でも回せる', async () => {
      // タービンは「動きを減らす」だと動かない(マウント時に判定)。この step だけ動きありの別ブラウザで検査する
      const l2 = await launch({ theme: 'dark', viewport: { width: 1489, height: 900 }, motion: 'no-preference' });
      let st, st2;
      try {
        const pg = l2.page;
        await gotoMiti(pg);
        await applyFixture(pg, { military: true });
        const trb = pg.locator('[data-ms-zone="header"] button.milspec-tsw');
        if ((await trb.count()) !== 1) fail(`TRB ボタンが ${await trb.count()} 個 (期待 1 個)`);
        const read = () => pg.evaluate(() => {
          const b = document.querySelector('[data-ms-zone="header"] button.milspec-tsw');
          const led = b && b.querySelector('.milspec-led');
          const vane = document.querySelector('[data-ms-zone="header"] .milspec-h3-vanes');
          return { disabled: !!b && b.disabled, warn: !!led && led.classList.contains('is-warn'), vane: vane ? getComputedStyle(vane).transform : null };
        });
        // 電源投入(約 0.9 秒)の 1 秒後に TRB が自動で押される(見本 js:1165-1178)= 回転中になる
        try {
          await pg.waitForFunction(() => { const b = document.querySelector('[data-ms-zone="header"] button.milspec-tsw'); return !!b && b.disabled; }, null, { timeout: 8000 });
        } catch { fail('電源投入後に TRB が自動で押されない(無効化されない)'); }
        await pg.waitForTimeout(500);
        st = await read();
        if (!st.disabled) fail('自動起動の回転中なのにボタンが無効化されていない');
        if (!st.warn) fail('回転中なのにランプが琥珀(is-warn)でない');
        if (!st.vane || st.vane === 'none') fail(`羽根が回っていない(transform ${st.vane})`);
        // 回転が止まる(ボタンが戻る)まで待つ
        await pg.waitForFunction(() => { const b = document.querySelector('[data-ms-zone="header"] button.milspec-tsw'); return !!b && !b.disabled; }, null, { timeout: 25000 });
        // 戻った後に手動で押してもう一度回す
        await trb.click();
        await pg.waitForTimeout(500);
        st2 = await read();
        if (!st2.disabled) fail('手動で TRB を押したのにボタンが無効化されない');
        if (!st2.warn) fail('手動で TRB を押したのにランプが琥珀にならない');
        await pg.waitForFunction(() => { const b = document.querySelector('[data-ms-zone="header"] button.milspec-tsw'); return !!b && !b.disabled; }, null, { timeout: 25000 });
      } finally { await l2.browser.close(); }
      return `自動起動 無効化 → 琥珀 → vanes ${st.vane.slice(0, 24)} → 停止で復帰 → 手動でも回る`;
    });

    await step('通気口の取っ手でヘッダーが閉じて開く(aria-expanded)', async () => {
      const pull = page.locator('[data-ms-zone="vent"] button[data-vent-pull]');
      if ((await pull.count()) !== 1) fail('通気口の取っ手が無い');
      const a0 = await pull.getAttribute('aria-expanded');
      await pull.click();
      await page.waitForTimeout(1800);
      const a1 = await pull.getAttribute('aria-expanded');
      if (a1 === a0) fail(`ヘッダーが閉じない(aria-expanded ${a0} → ${a1})`);
      await pull.click();
      await page.waitForTimeout(1800);
      const a2 = await pull.getAttribute('aria-expanded');
      if (a2 !== a0) fail(`もう一度押しても開かない(${a0} → ${a1} → ${a2})`);
      return `aria-expanded ${a0} → ${a1} → ${a2}`;
    });

    await step('SORT の 2 キー: 押したほうが沈み、もう片方が戻る', async () => {
      const keys = page.locator('[data-ms-zone="header"] .milspec-h4-kc[role="group"]').filter({ has: page.locator('button[aria-pressed]') });
      const groups = await keys.evaluateAll((gs) => gs.map((g) => g.querySelectorAll('button[aria-pressed]').length));
      const gi = groups.findIndex((n) => n === 2);
      if (gi < 0) fail(`SORT の 2 キーの組が見つからない(組ごとのキー数 ${groups.join(',')})`);
      const btns = keys.nth(gi).locator('button[aria-pressed]');
      const read = () => btns.evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed')));
      const p0 = await read();
      if (p0.filter((v) => v === 'true').length !== 1) fail(`最初から沈んでいるキーがちょうど 1 つではない: ${p0.join(',')}`);
      const idx = p0.findIndex((v) => v === 'false');
      await btns.nth(idx).click();
      await page.waitForTimeout(400);
      const p1 = await read();
      if (p1[idx] !== 'true' || p1.filter((v) => v === 'true').length !== 1) fail(`押したキーだけが沈まない: ${p0.join(',')} → ${p1.join(',')}`);
      await btns.nth(1 - idx).click(); // 元へ戻す
      await page.waitForTimeout(400);
      const p2 = await read();
      if (p2.join(',') !== p0.join(',')) fail(`元へ戻らない: ${p0.join(',')} → ${p1.join(',')} → ${p2.join(',')}`);
      return `${p0.join(',')} → ${p1.join(',')} → ${p2.join(',')}`;
    });

    await step('縦ロッカーで昼夜が切り替わる(<html> の theme-light)', async () => {
      const rk = page.locator('[data-ms-zone="header"] button.milspec-vr');
      if ((await rk.count()) !== 1) fail('縦ロッカーが無い');
      const isLight = () => page.evaluate(() => document.documentElement.classList.contains('theme-light'));
      const l0 = await isLight();
      await rk.click();
      await page.waitForTimeout(1500);
      const l1 = await isLight();
      if (l1 === l0) fail(`昼夜が切り替わらない(theme-light ${l0} → ${l1})`);
      await rk.click();
      await page.waitForTimeout(1500);
      const l2 = await isLight();
      if (l2 !== l0) fail(`もう一度押しても戻らない(${l0} → ${l1} → ${l2})`);
      return `theme-light ${l0} → ${l1} → ${l2}`;
    });
}
