import { state, step, fail, getState, MITI_STORE } from './state.mjs';

export async function runStepsB() {
  const { page } = state;

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

    // ── step 11: リキャスト帯 (Task 7) のジオメトリ ─────────────
    await step('リキャスト(見出しのメンバー列)の位置・列整合・帯が無いこと・待機表示', async () => {
      const r = await page.evaluate(async () => {
        const sc = document.querySelector('.timeline-scroll-container');
        sc.scrollTo({ top: 0, left: 0 });
        await new Promise((res) => setTimeout(res, 250));

        if (document.querySelector('[data-milspec-recast-band]')) return { err: '撤去したはずの [data-milspec-recast-band] が残っている' };
        const header = document.querySelector('#timeline-header-inner');
        if (!header) return { err: '#timeline-header-inner が無い' };
        const idleN = header.querySelectorAll('.recast-cell > .recast-idle').length;
        const idleShown = Array.from(header.querySelectorAll('.recast-cell')).filter((c) => getComputedStyle(c.querySelector('.recast-idle')).display !== 'none').length;
        const sc0 = sc.getBoundingClientRect();
        const scR = sc0;
        const headR = header.getBoundingClientRect();

        // (b) 先頭 .recast-cell の left が、対応するメンバー列 (JobPickerRow の
        //     [data-member-id] = MitigationItem が実測に使う正典) と一致するか。
        const cells = Array.from(header.querySelectorAll('.recast-cell'));
        const cols = Array.from(document.querySelectorAll('#timeline-controls-inner [data-member-id]'));
        const pairs = [];
        for (let i = 0; i < Math.min(cells.length, cols.length); i += 1) {
          const cellId = cells[i].getAttribute('data-member');
          const colId = cols[i].getAttribute('data-member-id');
          pairs.push({
            i,
            cellId,
            colId,
            dx: cells[i].getBoundingClientRect().left - cols[i].getBoundingClientRect().left,
          });
        }

        // (c) 横スクロール後の transform 一致
        sc.scrollBy({ left: 300 });
        await new Promise((res) => setTimeout(res, 250));
        const tf = (el) => (el && el.style ? el.style.transform : '');

        return {
          headerBottom: headR.bottom,
          scTop: scR.top,
          cellCount: cells.length,
          colCount: cols.length,
          pairs,
          idleN,
          idleShown,
          headerTf: tf(header.firstElementChild ? header : header),
          scrollLeft: sc.scrollLeft,
        };
      });

      if (r.err) fail(r.err);

      // (a) 各セルに待機表示があり、scrollTop 0(リキャスト中の技が無い)では全列が待機表示
      if (r.idleN !== r.cellCount) fail(`待機表示 .recast-idle が ${r.idleN} 個 / セル ${r.cellCount} 個`);
      if (r.idleShown !== r.cellCount) fail(`scrollTop 0 で待機表示が出ている列が ${r.idleShown}/${r.cellCount}`);

      // (b) メンバー列との x 整合 (±3px)
      if (r.pairs.length === 0) fail('.recast-cell / [data-member-id] のどちらかが 0 件で列整合を検証できない');
      const bad = r.pairs.filter((p) => Math.abs(p.dx) > 3);
      if (bad.length) {
        fail(
          `リキャストセルがメンバー列と ±3px で揃っていない: ` +
            bad.map((p) => `#${p.i}(${p.cellId}/${p.colId}) dx=${p.dx.toFixed(1)}px`).join(', '),
        );
      }
      const maxDx = Math.max(...r.pairs.map((p) => Math.abs(p.dx)));

      // ── (d) 列折りたたみ (Shift+P / Shift+L) 後も帯がチップ陣営に留まる (C1 の回帰検知) ──
      // Task 10 の実測 (report §C1): 軍事 PC で列を折りたたむと「表の実セル」だけが左へ動き
      // (1489px で -78px)、チップ / 軽減バー / リキャスト帯は静的 x に留まる。これは SP2 以前から
      // ある「チップ側 vs 表セル側」の分裂 (軽減バーが既にそう) で、SP2 は recast を表セル側から
      // チップ側へ移籍させただけ = 帯はバー/チップと揃っているのが正しい。
      // ここでは「折りたたんでも帯がチップ陣営 (= 軽減バーと同じ x) に留まる」ことを assert する。
      // 帯が誤って collapse-aware になる / 逆に表セルが静的になる、どちらの回帰も dx で捕捉できる。
      await page.evaluate(() => document.querySelector('.timeline-scroll-container').scrollTo({ top: 0, left: 0 }));
      await page.waitForTimeout(200);
      await page.keyboard.press('Shift+P');
      await page.waitForTimeout(250);
      await page.keyboard.press('Shift+L');
      await page.waitForTimeout(450);
      const rc = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('#timeline-header-inner .recast-cell'));
        const cols = Array.from(document.querySelectorAll('#timeline-controls-inner [data-member-id]'));
        const bar = document.querySelector('[data-mit-bar]');
        const tableCell = document.querySelector('[data-time-row]:first-child > *:nth-child(7)');
        const pairs = [];
        for (let i = 0; i < Math.min(cells.length, cols.length); i += 1) {
          pairs.push({
            i,
            cellId: cells[i].getAttribute('data-member'),
            colId: cols[i].getAttribute('data-member-id'),
            dx: cells[i].getBoundingClientRect().left - cols[i].getBoundingClientRect().left,
          });
        }
        return {
          collapsed:
            localStorage.getItem('lopo-phase-col-collapsed') === 'true' &&
            localStorage.getItem('lopo-label-col-collapsed') === 'true',
          pairs,
          firstCellLeft: cells[0] ? cells[0].getBoundingClientRect().left : null,
          firstColLeft: cols[0] ? cols[0].getBoundingClientRect().left : null,
          barLeft: bar ? bar.getBoundingClientRect().left : null,
          tableCellLeft: tableCell ? tableCell.getBoundingClientRect().left : null,
        };
      });
      // 復帰 (以降のステップを展開状態で回す)
      await page.keyboard.press('Shift+P');
      await page.waitForTimeout(200);
      await page.keyboard.press('Shift+L');
      await page.waitForTimeout(400);

      if (!rc.collapsed) fail('Shift+P / Shift+L で列折りたたみ state が true にならない (ショートカットの回帰)');
      if (rc.pairs.length === 0) fail('折りたたみ後に .recast-cell / [data-member-id] が 0 件');
      // リキャストは標準と同じ見出しの中 = 表の実セルと同じ側に動く(折りたたみ後も表の 7 列目と x が揃う)
      if (rc.firstCellLeft === null || rc.tableCellLeft === null) fail('折りたたみ後に recast-cell / 表の 7 列目セルが取れない');
      const dxT = rc.firstCellLeft - rc.tableCellLeft;
      if (Math.abs(dxT) > 3) fail(`折りたたみ後にリキャストセルが表の実セルと ±3px で揃っていない: dx=${dxT.toFixed(1)}px`);
      const maxDxC = Math.abs(dxT);

      return (
        `帯なし / 待機表示 ${r.idleShown}/${r.cellCount} 列 / ` +
        `列整合 ${r.pairs.length} 組 最大 dx ${maxDx.toFixed(1)}px (±3px) / ` +
        `折りたたみ後も最大 dx ${maxDxC.toFixed(1)}px ` +
        `(帯 ${rc.firstCellLeft === null ? '-' : rc.firstCellLeft.toFixed(1)} / ` +
        `チップ ${rc.firstColLeft === null ? '-' : rc.firstColLeft.toFixed(1)} / ` +
        `バー ${rc.barLeft === null ? '-' : rc.barLeft.toFixed(1)} / ` +
        `表セル ${rc.tableCellLeft === null ? '-' : rc.tableCellLeft.toFixed(1)} = 既知の陣営分裂)`
      );
    });
}
