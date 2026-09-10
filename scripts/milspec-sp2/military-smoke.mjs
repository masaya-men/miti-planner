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

/** viewport ごとにモジュールレベル状態をリセット (複数幅で回すと stepNum が累積し
 *  results も混ざって出力が読みにくくなるため、各幅の実行前に必ず呼ぶ)。 */
function resetState() {
  stepNum = 0;
  results.length = 0;
  page = undefined;
  rec = undefined;
}

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

/** width から 16:9 の height を導出 (--width=N 単一指定時)。
 *  既知幅は実解像度、それ以外は width*9/16 を丸め・下限 800。 */
function heightForWidth(w) {
  if (w === 1920) return 1080;
  if (w === 2560) return 1440;
  return Math.max(800, Math.round((w * 9) / 16));
}

/**
 * process.argv から実行する viewport 群を決める。
 *   --viewport   : [1489×900, 1920×1080, 2560×1440] を順に (3 幅)
 *   --width=N    : [N×heightForWidth(N)] のみ (単一)
 *   (引数なし)   : [1489×900] のみ (従来挙動を厳密に維持)
 * @returns {{ width: number, height: number }[]}
 */
function parseViewports(argv) {
  const args = argv.slice(2);
  if (args.includes('--viewport')) {
    return [
      { width: 1489, height: 900 },
      { width: 1920, height: 1080 },
      { width: 2560, height: 1440 },
    ];
  }
  const wArg = args.find((a) => /^--width=\d+$/.test(a));
  if (wArg) {
    const w = parseInt(wArg.slice('--width='.length), 10);
    return [{ width: w, height: heightForWidth(w) }];
  }
  return [{ width: 1489, height: 900 }];
}

/**
 * 1 つの viewport で全ステップを実行する。旧 main() の中身をそのまま切り出したもの
 * (ステップロジック・しきい値・座標計算は一切不変)。process.exit せず結果オブジェクトを
 * 返す — 最終的な exit code は main() が全幅の結果を集約して決める。
 *
 * @param {{ width: number, height: number }} viewport
 * @param {{ tagOutput?: boolean }} [opts] tagOutput: PASS/FAIL 行に [W×H] を付ける (複数幅実行時)
 * @returns {Promise<{ viewport: {width:number,height:number}, ok: boolean, steps: number, warns?: number, reason?: string, results: any[] }>}
 */
async function runOnce(viewport, { tagOutput = false } = {}) {
  resetState();
  const tag = tagOutput ? ` [${viewport.width}×${viewport.height}]` : '';
  const launched = await launch({ theme: 'dark', viewport });
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
    await step('リキャスト帯 [data-milspec-recast-band] の位置・列整合・スクロール同期', async () => {
      const r = await page.evaluate(async () => {
        const sc = document.querySelector('.timeline-scroll-container');
        sc.scrollTo({ top: 0, left: 0 });
        await new Promise((res) => setTimeout(res, 250));

        const band = document.querySelector('[data-milspec-recast-band]');
        if (!band) return { err: '[data-milspec-recast-band] が存在しない (軍事 PC で帯が mount されていない)' };
        const header = document.querySelector('#timeline-header-inner');
        const inner = document.querySelector('#timeline-recast-inner');
        const label = band.querySelector('.milspec-rc-label');
        if (!header) return { err: '#timeline-header-inner が無い' };
        if (!inner) return { err: '#timeline-recast-inner が無い' };
        if (!label) return { err: '.milspec-rc-label が無い' };

        const bandR = band.getBoundingClientRect();
        const headR = header.getBoundingClientRect();
        const scR = sc.getBoundingClientRect();

        // (b) 先頭 .recast-cell の left が、対応するメンバー列 (JobPickerRow の
        //     [data-member-id] = MitigationItem が実測に使う正典) と一致するか。
        const cells = Array.from(band.querySelectorAll('.recast-cell'));
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
          bandTop: bandR.top,
          bandBottom: bandR.bottom,
          bandHeight: bandR.height,
          headerBottom: headR.bottom,
          scTop: scR.top,
          labelWidth: label.getBoundingClientRect().width,
          cellCount: cells.length,
          colCount: cols.length,
          pairs,
          headerTf: tf(header),
          recastTf: tf(inner),
          scrollLeft: sc.scrollLeft,
        };
      });

      if (r.err) fail(r.err);

      // (a) 帯は列見出しの下・表本体の上
      if (r.bandTop < r.headerBottom - 1) {
        fail(`帯の top (${r.bandTop.toFixed(1)}) が #timeline-header-inner の bottom (${r.headerBottom.toFixed(1)}) より上`);
      }
      if (r.bandBottom > r.scTop + 1) {
        fail(`帯の bottom (${r.bandBottom.toFixed(1)}) が .timeline-scroll-container の top (${r.scTop.toFixed(1)}) より下`);
      }

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

      // (c) 横スクロール同期
      if (r.headerTf !== r.recastTf) {
        fail(`横スクロール後の transform 不一致: header "${r.headerTf}" / recast "${r.recastTf}"`);
      }
      if (!/translateX\(-\d/.test(r.recastTf)) {
        fail(`リキャスト帯が translateX で追従していない: "${r.recastTf}" (scrollLeft=${r.scrollLeft})`);
      }

      return (
        `帯 top ${r.bandTop.toFixed(1)} (header bottom ${r.headerBottom.toFixed(1)} / body top ${r.scTop.toFixed(1)}) ` +
        `h=${r.bandHeight.toFixed(1)} / label w=${r.labelWidth.toFixed(1)} / ` +
        `列整合 ${r.pairs.length} 組 最大 dx ${maxDx.toFixed(1)}px (±3px) / transform ${r.recastTf} 一致`
      );
    });

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

        const cell = document.querySelector(`[data-milspec-recast-band] .recast-cell[data-member="${tank.id}"]`);
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
        const band = document.querySelector('[data-milspec-recast-band]');
        const bandRect = band.getBoundingClientRect();

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
            `padding-left ${r.cellPaddingLeft} / アイコン ${r.iconW}px) — 帯は overflow:hidden なので 2 行目が切れる`,
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
        const band = document.querySelector('[data-milspec-recast-band]');
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
          bandPadR: band ? px(getComputedStyle(band).paddingRight) : null,
          headerCap: capOf(headerOuter),
          bandCap: capOf(band),
        };
      });

      // (1) 目盛りキャップ ::after — headless でも計算される (通常の疑似要素)。CSS 構文/セレクタの機械確認。
      for (const [name, cap] of [['header', r.headerCap], ['recast-band', r.bandCap]]) {
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
          `目盛りキャップ ::after は生成確認済 (header ${r.headerCap.w}px / band ${r.bandCap.w}px)`
        );
      }
      if (!(r.barWidth >= 10 && r.barWidth <= 20)) {
        fail(`縦スクロールバー幅が 14px 近傍でない (${r.barWidth}px)`);
      }
      // syncPadding: header / controls / recast 帯が同じバー幅で揃う (±1.5px)
      for (const [name, v] of [['header', r.headerPadR], ['controls', r.controlsPadR], ['recast', r.bandPadR]]) {
        if (v === null) continue;
        if (Math.abs(v - r.barWidth) > 1.5) {
          fail(`${name} の paddingRight (${v}px) がスクロールバー幅 (${r.barWidth}px) と一致しない — syncPadding 未反映`);
        }
      }
      return `縦バー幅 ${r.barWidth}px / paddingRight header ${r.headerPadR} controls ${r.controlsPadR} recast ${r.bandPadR} / 目盛りキャップ ::after OK`;
    });

    // ── 最終判定 (この viewport) ──────────────────────────────
    console.log('');
    if (rec.whitelisted.length) {
      console.log(`[info] whitelist 済み (dev で無害) の console/pageerror ${rec.whitelisted.length} 件:`);
      const uniq = [...new Set(rec.whitelisted.map((l) => l.slice(0, 120)))].slice(0, 12);
      for (const l of uniq) console.log('  · ' + l);
      console.log('');
    }
    if (rec.fatal.length) {
      console.error(`FAIL${tag}: 非 whitelist の console/pageerror ${rec.fatal.length} 件:`);
      for (const l of rec.fatal) console.error('  ' + l);
      return {
        viewport,
        ok: false,
        steps: stepNum,
        reason: `非 whitelist console/pageerror ${rec.fatal.length} 件`,
        results: results.slice(),
      };
    }

    const warns = results.filter((r) => r.ok && r.note.startsWith('WARN')).length;
    console.log(`PASS${tag}: ${stepNum} ステップ完走 / 非 whitelist console エラー 0 件${warns ? ` / WARN ${warns} 件 (Task 1 時点で未実装の挙動)` : ''}`);
    return { viewport, ok: true, steps: stepNum, warns, results: results.slice() };
  } catch (err) {
    console.error(`\n──────── FAIL${tag} ────────`);
    console.error(String(err && err.stack ? err.stack : err));
    console.error('\nステップ結果:');
    for (const r of results) console.error(`  ${r.ok ? '✓' : '✗'} ${r.tag}${r.note ? ` — ${r.note}` : ''}`);
    if (rec && rec.fatal.length) {
      console.error('\n収集した console/pageerror:');
      for (const l of rec.fatal) console.error('  ' + l);
    }
    const failed = results.find((r) => !r.ok);
    return {
      viewport,
      ok: false,
      steps: stepNum,
      reason: failed ? `${failed.tag} — ${failed.note}` : String(err && err.message ? err.message : err),
      results: results.slice(),
    };
  } finally {
    await launched.browser.close();
  }
}

async function main() {
  const viewports = parseViewports(process.argv);
  const multi = viewports.length > 1;
  /** @type {Awaited<ReturnType<typeof runOnce>>[]} */
  const summary = [];

  for (const vp of viewports) {
    if (multi) console.log(`\n=== viewport ${vp.width}×${vp.height} ===\n`);
    summary.push(await runOnce(vp, { tagOutput: multi }));
  }

  if (multi) {
    console.log('\n──────── viewport 集計 ────────');
    for (const r of summary) {
      const v = `${r.viewport.width}×${r.viewport.height}`;
      console.log(
        r.ok
          ? `  ✓ ${v}: ${r.steps}/13 pass${r.warns ? ` (WARN ${r.warns})` : ''}`
          : `  ✗ ${v}: ${r.reason}`,
      );
    }
  }

  const failed = summary.filter((r) => !r.ok);
  if (failed.length) {
    console.error(
      `\nFAIL: ${failed.map((r) => `${r.viewport.width}×${r.viewport.height}`).join(', ')} で失敗 (詳細は上記)`,
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[military-smoke] ERROR:', err && err.stack ? err.stack : err);
  process.exit(1);
});
