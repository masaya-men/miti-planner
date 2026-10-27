import { state, step, fail, getState, MITI_STORE } from './state.mjs';

export async function runStepsC() {
  const { page } = state;

    // ── step 12: リキャスト帯 — T/H セルに 6 アイコンが折り返さない ──
    // RecastRow.tsx:29 の LIMIT_TH = 6。T/H 列の内幅は
    //   --col-th-w(151px) - padding-left(--col-member-pad-x + 2px)
    // しかなく、24px アイコン 6 個(144px)がギリギリ収まる設計。帯側の CSS で
    // flex gap を足すと折り返し、帯は overflow:hidden なので 2 行目が切れて消える。
    // 「6 個同時可視」はクールダウンのタイミング依存なので、レイアウト検証としては
    // DOM 側で --cd-display を強制 flex にして測る(計測専用・製品コード不変・測定後に戻す)。
    await step('リキャスト帯: T/H セルで 6 アイコンが 1 行に収まる (折り返しクリップ回帰)', async () => {
      const r = await page.evaluate(async () => {
        const { useMitigationStore } = await import('/src/store/useMitigationStore.ts');
        const s = useMitigationStore.getState();
        const tank = s.partyMembers.find((m) => m.role === 'tank');
        if (!tank) return { err: 'tank メンバーが居ない' };

        // T/H の上限 6 種ぶん「過去に一度でも置いた」状態を作る = セルに 6 アイコンが mount される。
        // id はハードコードせず実マスターデータから採る(EXCLUDED_FROM_RECAST_ROW は除外)。
        const { useMasterDataStore } = await import('/src/store/useMasterDataStore.ts');
        const mod = await import('/src/data/mockData.ts');
        const defs = useMasterDataStore.getState().skills?.mitigations ?? mod.MITIGATIONS;
        const { EXCLUDED_FROM_RECAST_ROW } = await import('/src/utils/recastRow.ts');
        const species = defs
          .map((d) => d.id)
          .filter((id) => !EXCLUDED_FROM_RECAST_ROW.has(id))
          .slice(0, 6);
        if (species.length < 6) return { err: `軽減マスターから 6 種を採れない (${species.length} 種)` };
        const extra = species.map((mid, i) => ({
          id: `wrapprobe-${i}`,
          mitigationId: mid,
          ownerId: tank.id,
          time: 300 + i * 5,
        }));
        useMitigationStore.setState({ timelineMitigations: [...s.timelineMitigations, ...extra] });
        await new Promise((res) => setTimeout(res, 500));

        const cell = document.querySelector(`#timeline-header-inner .recast-cell[data-member="${tank.id}"]`);
        if (!cell) return { err: '帯の中に tank の .recast-cell が無い' };
        const icons = Array.from(cell.querySelectorAll('.recast-icon'));
        if (icons.length < 6) return { err: `tank セルのアイコンが ${icons.length} 個しか mount されていない (6 個必要)` };

        // 計測のためだけに 6 個を強制表示 (RecastRow.update() が書く --cd-display と同じ値)
        const probe = icons.slice(0, 6);
        for (const el of probe) el.style.setProperty('--cd-display', 'flex');
        await new Promise((res) => setTimeout(res, 150));

        const cs = getComputedStyle(cell);
        const cellRect = cell.getBoundingClientRect();
        const tops = probe.map((el) => Math.round(el.getBoundingClientRect().top));
        const rects = probe.map((el) => el.getBoundingClientRect());
        const rowCount = new Set(tops).size;
        const maxBottom = Math.max(...rects.map((x) => x.bottom));
        const bandRect = document.querySelector('#timeline-header-inner').getBoundingClientRect();

        // 後片付け: 強制表示を解除して store も元に戻す (以降のステップに影響させない)
        for (const el of probe) el.style.removeProperty('--cd-display');
        useMitigationStore.setState({ timelineMitigations: s.timelineMitigations });
        await new Promise((res) => setTimeout(res, 200));

        return {
          gap: cs.gap,
          columnGap: cs.columnGap,
          flexWrap: cs.flexWrap,
          cellWidth: cellRect.width,
          cellPaddingLeft: cs.paddingLeft,
          iconW: rects[0].width,
          rowCount,
          iconBottomOverflow: maxBottom - bandRect.bottom,
          scrollOverflow: cell.scrollWidth - cell.clientWidth,
        };
      });

      if (r.err) fail(r.err);

      // 6 個が 1 行 = top が全て同じ
      if (r.rowCount !== 1) {
        fail(
          `T/H セルで 6 アイコンが ${r.rowCount} 行に折り返している ` +
            `(gap=${r.gap} / flex-wrap=${r.flexWrap} / セル幅 ${r.cellWidth.toFixed(1)}px ` +
            `padding-left ${r.cellPaddingLeft} / アイコン ${r.iconW}px) — 見出しは高さが決まっているので 2 行目が切れる`,
        );
      }
      // 帯の下端から溢れていない
      if (r.iconBottomOverflow > 0.5) {
        fail(`アイコンが帯の下端から ${r.iconBottomOverflow.toFixed(1)}px 溢れている (クリップされる)`);
      }
      // 横方向にも溢れていない
      if (r.scrollOverflow > 1) {
        fail(`T/H セルが横に ${r.scrollOverflow}px 溢れている (アイコンが隠れる)`);
      }

      return (
        `6 アイコン × ${r.iconW}px が 1 行 (gap=${r.gap} / flex-wrap=${r.flexWrap}) / ` +
        `セル幅 ${r.cellWidth.toFixed(1)}px - padding-left ${r.cellPaddingLeft} / ` +
        `帯下端の溢れ ${r.iconBottomOverflow.toFixed(1)}px / 横溢れ ${r.scrollOverflow}px`
      );
    });

    // ── step 13: 計器スクロールバー (Task 8) ──────────────────
    // 軍事 PC では src/index.css:1629 の「縦バー width:0」を .theme-military .milspec-app で
    // 上書きし 14px の計器バーを可視化する。syncPadding がその幅を header/controls/recast 帯の
    // paddingRight に反映する。
    // ⚠ headless Chromium は overlay 型で ::-webkit-scrollbar を幅0で返す環境がある
    //   (project_sf_military_theme 追記11)。その場合 offsetWidth-clientWidth も paddingRight も
    //   0 になる → WARN スキップ (実機 Chrome / headed で確認)。
    //   機械確認できるのは「CSS 構文が通り目盛りキャップ ::after が生成される」ことと
    //   「syncPadding が header/controls/recast を同じ値で揃える」の2点。
    await step('計器スクロールバー: 縦バー可視化 + syncPadding + 目盛りキャップ ::after', async () => {
      const r = await page.evaluate(async () => {
        const sc = document.querySelector('.timeline-scroll-container');
        sc.scrollTo({ top: 0, left: 0 });
        await new Promise((res) => setTimeout(res, 200));
        const headerOuter = document.querySelector('#timeline-header-inner')?.parentElement;
        const controlsOuter = document.querySelector('#timeline-controls-inner')?.parentElement;
        const px = (v) => parseFloat(v) || 0;
        const capOf = (el) => {
          if (!el) return null;
          const cs = getComputedStyle(el, '::after');
          return { w: px(cs.width), hasTicks: /repeating-linear-gradient/.test(cs.backgroundImage), pos: getComputedStyle(el).position };
        };
        return {
          barWidth: sc.offsetWidth - sc.clientWidth,
          scrollable: sc.scrollHeight > sc.clientHeight,
          headerPadR: headerOuter ? px(getComputedStyle(headerOuter).paddingRight) : null,
          controlsPadR: controlsOuter ? px(getComputedStyle(controlsOuter).paddingRight) : null,
          headerCap: capOf(headerOuter),
        };
      });

      // (1) 目盛りキャップ ::after — headless でも計算される (通常の疑似要素)。CSS 構文/セレクタの機械確認。
      for (const [name, cap] of [['header', r.headerCap]]) {
        if (!cap) fail(`${name} の外枠が見つからない`);
        if (cap.pos !== 'relative') fail(`${name} 外枠が position:relative でない (${cap.pos}) — ::after の基準が壊れる`);
        if (!(cap.w >= 12 && cap.w <= 16)) fail(`${name} の目盛りキャップ ::after 幅が 14px 近傍でない (${cap.w}px)`);
        if (!cap.hasTicks) fail(`${name} の目盛りキャップ ::after に repeating-linear-gradient (目盛り) が無い`);
      }

      // (2) 縦バー幅 + syncPadding。headless で 0 なら WARN スキップ。
      if (r.barWidth <= 0) {
        return (
          `WARN: headless で縦スクロールバー幅 = ${r.barWidth} (overlay 型・::-webkit-scrollbar 非描画)。` +
          `実機 Chrome / headed で 14px + paddingRight 一致を要確認。` +
          `目盛りキャップ ::after は生成確認済 (header ${r.headerCap.w}px)`
        );
      }
      if (!(r.barWidth >= 10 && r.barWidth <= 20)) {
        fail(`縦スクロールバー幅が 14px 近傍でない (${r.barWidth}px)`);
      }
      // syncPadding: header / controls / recast 帯が同じバー幅で揃う (±1.5px)
      for (const [name, v] of [['header', r.headerPadR], ['controls', r.controlsPadR]]) {
        if (v === null) continue;
        if (Math.abs(v - r.barWidth) > 1.5) {
          fail(`${name} の paddingRight (${v}px) がスクロールバー幅 (${r.barWidth}px) と一致しない — syncPadding 未反映`);
        }
      }
      return `縦バー幅 ${r.barWidth}px / paddingRight header ${r.headerPadR} controls ${r.controlsPadR} / 目盛りキャップ ::after OK`;
    });

    // ── step 15: CSS セレクタの構造前提を自己防衛 (レビュー M8 / T4 #4) ──
    // (a) ゼブラ (:nth-child(even)) と 4n 溝 (:nth-child(4n)) は「sheetContainer の先頭に
    //     [data-time-row] が連続している」ことに依存する。将来ここに 1 個何かを挿すと
    //     ゼブラが 1 行ずれるだけで、テストも既存の smoke も落ちない = 無音の破綻。
    // (b) Task 4/5/8 と Task 10(A1/A3) が使う `div:has(> #timeline-header-inner)` /
    //     `.timeline-scroll-container > div:has(> [data-time-row])` は「直親/直子が一意」
    //     という前提に立っている。どちらも件数を数えて固定する。
    await step('CSS 構造前提: sheetContainer 先頭の行連続性 + :has() アンカーの一意性', async () => {
      const r = await page.evaluate(() => {
        const sheets = document.querySelectorAll('.timeline-scroll-container > div:has(> [data-time-row])');
        if (sheets.length !== 1) return { err: `sheetContainer アンカーが ${sheets.length} 個 (期待 1 個)` };
        const sheet = sheets[0];
        const kids = Array.from(sheet.children);
        const isRow = (el) => el.hasAttribute('data-time-row');
        let lead = 0;
        while (lead < kids.length && isRow(kids[lead])) lead += 1;
        const rowAfterNonRow = kids.slice(lead).some(isRow);
        const headerOuters = document.querySelectorAll('div:has(> #timeline-header-inner)');
        return {
          firstIsRow: kids.length > 0 && isRow(kids[0]),
          childCount: kids.length,
          leadRun: lead,
          totalRows: kids.filter(isRow).length,
          rowAfterNonRow,
          headerOuterCount: headerOuters.length,
        };
      });
      if (r.err) fail(r.err);
      if (!r.firstIsRow) {
        fail(`sheetContainer の先頭子が [data-time-row] ではない — :nth-child(even)/(4n) のゼブラ・溝が 1 行ずれる`);
      }
      if (r.rowAfterNonRow) {
        fail(
          `[data-time-row] が先頭の連続ランになっていない (先頭 ${r.leadRun} 個の後にも行がある / 全 ${r.totalRows} 行) ` +
            `— 行の間に非行要素が挟まると :nth-child の行番号がずれる`,
        );
      }
      if (r.headerOuterCount !== 1) {
        fail(`div:has(> #timeline-header-inner) が ${r.headerOuterCount} 個 (期待 1 個) — Task 4/5/8/10 のアンカーが曖昧になる`);
      }
      return `sheetContainer 直下 ${r.childCount} 子 / 先頭から ${r.leadRun} 個連続で行 (全 ${r.totalRows} 行・行後に行なし) / ヘッダー外枠アンカー 1 個`;
    });
}
