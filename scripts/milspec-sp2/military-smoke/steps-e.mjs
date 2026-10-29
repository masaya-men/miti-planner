import { state, step, fail, getState, MITI_STORE } from './state.mjs';
import { launch, gotoMiti, applyFixture } from '../_fixture.mjs';

export async function runStepsE(viewport) {
  const { page } = state;

    // ── step 23〜26: v11 フッター・レール・電源 ──
    await step('レールの取っ手でサイドバーが閉じて開く(aria-expanded)', async () => {
      const h = page.locator('.milspec-rail-handle');
      if ((await h.count()) !== 1) fail('レールの取っ手が無い');
      const a0 = await h.getAttribute('aria-expanded');
      await h.click();
      await page.waitForTimeout(1200);
      const a1 = await h.getAttribute('aria-expanded');
      if (a1 === a0) fail(`サイドバーが閉じない(aria-expanded ${a0} → ${a1})`);
      await h.click();
      await page.waitForTimeout(1200);
      const a2 = await h.getAttribute('aria-expanded');
      if (a2 !== a0) fail(`もう一度押しても開かない(${a0} → ${a1} → ${a2})`);
      return `aria-expanded ${a0} → ${a1} → ${a2}`;
    });

    await step('フッターの「法的情報」で一覧が開き、4 つのリンクが出て、閉じられる', async () => {
      const btn = page.locator('[data-ms-zone="footer"] .milspec-ftr-legalwrap button.milspec-flink');
      if ((await btn.count()) !== 1) fail('法的情報ボタンが無い');
      if ((await btn.getAttribute('aria-expanded')) !== 'false') fail('最初から開いている');
      await btn.click();
      await page.waitForTimeout(400);
      const hrefs = await page.locator('.milspec-legal-pop a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      if (hrefs.join(',') !== '/privacy,/terms,/about,/about#contact') fail(`一覧のリンクが想定と違う: ${hrefs.join(',')}`);
      if ((await btn.getAttribute('aria-expanded')) !== 'true') fail('開いたのに aria-expanded が true でない');
      await page.locator('.milspec-ftr-backdrop').click({ position: { x: 5, y: 5 }, force: true });
      await page.waitForTimeout(400);
      if ((await page.locator('.milspec-legal-pop').count()) !== 0) fail('外側を押しても一覧が閉じない');
      return `リンク ${hrefs.join(' ')} → 外側クリックで閉じる`;
    });

    await step('MIL-SPEC を開くと電源が 2 秒以内に on になる(動きありの別ブラウザ)', async () => {
      const l2 = await launch({ theme: 'dark', viewport: { width: 1489, height: 900 }, motion: 'no-preference' });
      let ms;
      try {
        const pg = l2.page;
        await gotoMiti(pg);
        const t0 = Date.now();
        await applyFixture(pg, { military: true });
        const first = await pg.evaluate(() => document.documentElement.dataset.msPower);
        try {
          await pg.waitForFunction(() => document.documentElement.dataset.msPower === 'on', null, { timeout: 2000 });
        } catch { fail(`2 秒待っても電源が on にならない(最初 ${first})`); }
        ms = Date.now() - t0;
      } finally { await l2.browser.close(); }
      return `fixture 適用から ${ms}ms で on`;
    });

    await step('操作列の削除キー: メニュー → 確認ダイアログ → キャンセルで軽減は消えない', async () => {
      const before = await getState(MITI_STORE, 'timelineMitigations').then((m) => (Array.isArray(m) ? m.length : -1));
      const key = page.locator('#timeline-controls-inner [data-deck="clear"]').first();
      if ((await key.count()) === 0) fail('削除キー ([data-deck=clear]) が見つからない');
      await key.click();
      const menuRed = page.locator('div.fixed.z-\\[9999\\].w-\\[190px\\] button').first();
      try { await menuRed.waitFor({ state: 'visible', timeout: 3000 }); } catch { fail('削除キーを押しても削除メニューが出ない ' + await page.evaluate(() => [...document.body.children].map((e) => e.tagName + '.' + String(e.className).slice(0, 50)).join(' / '))); }
      await menuRed.click();
      const dlg = page.locator('div.fixed.inset-0.z-\\[99999\\]');
      try { await dlg.first().waitFor({ state: 'visible', timeout: 3000 }); } catch { fail('「すべての軽減」を押しても確認ダイアログが出ない'); }
      await page.keyboard.press('Escape');
      try { await dlg.first().waitFor({ state: 'detached', timeout: 3000 }); } catch { fail('Esc で確認ダイアログが閉じない'); }
      const after = await getState(MITI_STORE, 'timelineMitigations').then((m) => (Array.isArray(m) ? m.length : -1));
      if (after !== before) fail(`キャンセルしたのに軽減の数が変わった (${before} → ${after})`);
      return `確認ダイアログを出してキャンセル・軽減 ${before} 件のまま`;
    });

    await step('操作列の PiP ロッカー: 押すとメニューが出て、外へ出ると閉じる', async () => {
      const sw = page.locator('#timeline-controls-inner [data-deck="pip"]').first();
      if ((await sw.count()) === 0) return 'WARN: PiP ロッカーが無い(この環境は PiP 非対応)';
      const menu = page.locator('div.w-max.frame-surface.rounded-xl');
      await sw.click();
      try { await menu.first().waitFor({ state: 'visible', timeout: 3000 }); } catch { fail('PiP ロッカーを押してもメニューが出ない'); }
      await page.mouse.move(5, 5);
      try { await menu.first().waitFor({ state: 'detached', timeout: 3000 }); } catch { fail('マウスが外へ出てもメニューが閉じない'); }
      return 'メニュー開閉 OK';
    });

    await step('並び替えで差込口が滑り、終わった後に差込口とリキャスト帯の列が揃う(dx≤1)', async () => {
      const keys = page.locator('[data-ms-zone="header"] .milspec-h4-kc[role="group"]').filter({ has: page.locator('button[aria-pressed]') });
      const groups = await keys.evaluateAll((gs) => gs.map((g) => g.querySelectorAll('button[aria-pressed]').length));
      const gi = groups.findIndex((n) => n === 2);
      if (gi < 0) fail('SORT の 2 キーの組が見つからない');
      const btns = keys.nth(gi).locator('button[aria-pressed]');
      const measure = () => page.evaluate(() => {
        const sc = document.querySelector('.timeline-scroll-container');
        if (sc) sc.scrollLeft = 0;
        const jacks = Array.from(document.querySelectorAll('#timeline-controls-inner [data-member-id]'));
        return jacks.map((j) => {
          const id = j.getAttribute('data-member-id');
          const c = document.querySelector(`#timeline-header-inner .recast-cell[data-member="${id}"]`);
          return { id, x: j.getBoundingClientRect().left, dx: c ? c.getBoundingClientRect().left - j.getBoundingClientRect().left : null };
        });
      });
      const settle = async () => {
        // 動きが止まるまで(2 回続けて同じ位置)待つ
        let prev = '';
        for (let i = 0; i < 30; i += 1) {
          const cur = JSON.stringify((await measure()).map((m) => Math.round(m.x)));
          if (cur === prev) return;
          prev = cur;
          await page.waitForTimeout(100);
        }
      };
      await settle();
      const a = await measure();
      const idx = await btns.evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-pressed') === 'false'));
      if (idx < 0) fail('押されていないキーが見つからない(並び替えを試せない)');
      await btns.nth(idx).click();
      await settle();
      const b = await measure();
      const moved = b.some((m, i) => Math.abs(m.x - a[i].x) > 1);
      const bad = b.filter((m) => m.dx !== null && Math.abs(m.dx) > 1);
      await btns.nth(1 - idx).click(); // 元へ戻す
      await settle();
      if (!moved) fail('並び替えで差込口の位置が変わらない');
      if (bad.length) fail(`並び替え後に差込口とリキャスト帯の列がずれる: ${JSON.stringify(bad)}`);
      return `位置が変わり、列整合 dx≤1 (${b.length} 列)`;
    });

    await step('照準: 効果アイコンに実マウスを載せると照準の枠がそのアイコンに乗る', async () => {
      await page.evaluate(() => { const sc = document.querySelector('.timeline-scroll-container'); if (sc) { sc.scrollTop = 0; sc.scrollLeft = 0; } });
      await page.waitForTimeout(200);
      const t = await page.evaluate(() => {
        const sc = document.querySelector('.timeline-scroll-container').getBoundingClientRect();
        for (const el of document.querySelectorAll('[data-mit-icon]')) {
          const r = el.getBoundingClientRect();
          if (r.width > 4 && r.left >= sc.left && r.right <= sc.right && r.top >= sc.top + 20 && r.bottom <= sc.bottom) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
        return null;
      });
      if (!t) fail('画面内に効果アイコンが無い');
      await page.mouse.move(t.x - 60, t.y);
      await page.mouse.move(t.x, t.y, { steps: 4 });
      try {
        await page.waitForFunction(() => document.querySelector('.milspec-ret.on:not([data-head])'), null, { timeout: 2500 });
      } catch { fail('効果アイコンを指しても照準が出ない'); }
      await page.waitForTimeout(450); // 吸い付く動きが終わるまで
      const d = await page.evaluate(({ x, y }) => {
        const ret = document.querySelector('.milspec-ret.on:not([data-head])').getBoundingClientRect();
        return { dx: ret.left + ret.width / 2 - x, dy: ret.top + ret.height / 2 - y, w: ret.width };
      }, t);
      if (Math.abs(d.dx) > 14 || Math.abs(d.dy) > 14) fail(`照準がアイコンに乗っていない (中心差 ${d.dx.toFixed(1)},${d.dy.toFixed(1)})`);
      await page.mouse.move(5, 5);
      return `中心差 ${d.dx.toFixed(1)},${d.dy.toFixed(1)}px`;
    });

    await step('MODE レバーで電源断 → 標準テーマへ戻る(<html> の data-ms-power も消える)', async () => {
      const lv = page.locator('[data-ms-zone="header"] button.milspec-mlv');
      if ((await lv.count()) !== 1) fail('MODE レバーが無い');
      if ((await lv.getAttribute('aria-checked')) !== 'true') fail('電源が入っているのにレバーが on でない');
      await lv.click();
      try {
        await page.waitForFunction(() => !document.querySelector('.milspec-app'), null, { timeout: 4000 });
      } catch { fail('MODE レバーを上げても標準へ戻らない(.milspec-app が残る)'); }
      const left = await page.evaluate(() => document.documentElement.dataset.msPower ?? null);
      if (left !== null) fail(`標準へ戻ったのに data-ms-power が残る(${left})`);
      return '標準へ戻り .milspec-app と data-ms-power が消えた';
    });
}
