// @ts-check
/**
 * compare.mjs — 視覚忠実度プロトコル用の突き合わせスクショ採取
 * ─────────────────────────────────────────────────────────────
 *   node scripts/milspec-sp2/compare.mjs <zone>
 *
 * 指定 zone について:
 *   - モック側: docs/.private/theme-refs/milspec-mockup.html を開き
 *     (#ctl / #tune の dev パネルを display:none にしてから) 対応要素を
 *     .compare/<zone>-mock.png へ撮る
 *   - アプリ側: dev の軍事モード /miti (fixture 状態) を開き、対応する実要素を
 *     .compare/<zone>-app.png へ撮る
 *   - 2 枚のパスを print して終了 (画像比較の判断は実装者が Read で行う)
 *
 * Task 1 時点ではアプリ側の軍事要素はほぼ未実装。見つかった要素だけ撮り、
 * 見つからなければ warning を出して crash しない。
 * zone 一覧: controlbar header recast tbody mitbar workspace jobchips scrollbar wscap
 *
 * 視覚忠実度プロトコル (プラン §テスト戦略) は実装者が完遂する。
 * masaya レビューは Task 10 の 1 回のみ。
 */

import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { launch, gotoMiti, applyFixture, attachConsoleRecorder, BASE_URL } from './_fixture.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPARE_DIR = join(__dirname, '.compare');
const MOCKUP_PATH = join(__dirname, '..', '..', 'docs', '.private', 'theme-refs', 'milspec-mockup.html');

/**
 * zone → { mock: モック CSS セレクタ, app: アプリ CSS セレクタ, outer?: 親要素を撮る }
 * app セレクタは Task 7〜 で実装される想定の前方互換セレクタを含む (未実装なら warn)。
 */
const ZONES = {
  controlbar: { mock: '.subtoolbar', app: '#timeline-controls-inner', outer: true },
  header: { mock: '.thead', app: '#timeline-header-inner', outer: true },
  recast: { mock: '.recast-row', app: '[data-milspec-recast-band]' },
  tbody: { mock: '.tbody', app: '.timeline-scroll-container' },
  // Task 6: mit-bar/mit-icon の意匠は 6px 幅の細片なので、全体表ではなく MitigationItem 1 個
  // (icon チップ + 効果棒パイプ) を接写する。captureApp が clip を自前計算する。
  mitbar: { mock: '.tbody', app: '[data-mit-bar]' },
  workspace: { mock: '.workspace', app: '.milspec-ws' },
  // Task 6: ジョブチップ .cj = JobPickerRow の各セル。8 セルを束ねた矩形を clip で撮る。
  jobchips: { mock: '.subtoolbar .cb-e', app: '#timeline-controls-inner [data-member-id]' },
  // Task 8: 計器スクロールバー。::-webkit-scrollbar は headless 非描画 → headed 実 Chrome で撮る。
  // 「ヘッダー目盛りキャップ → リキャスト帯キャップ → 稼働バー」が縦に連続する右端の柱を
  // 縦ストリップで clip する。captureMock/captureApp が専用ロジックで矩形を計算する。
  scrollbar: { mock: '.table', app: '.timeline-scroll-container', headed: true },
  // Task 2: 端末キャップ + ROSTER ノート。cap/note は右端に絶対配置された小片なので、
  // 位置・帯幅・文字サイズ・不透明度を「表に対して」評価できるよう装甲板ごと撮る
  // (mock .workspace / app .milspec-ws)。要素単体だと 14px の帯や極小テキストしか写らない。
  wscap: { mock: '.workspace', app: '.milspec-ws' },
  // Task 9: 全ゾーン最終突き合わせ。workspace 全体を 1 枚で撮り、モック DOM(2088-2213)を
  // 要素単位で app と照合する(SP1 タービン欠落の再発防止)。lethal 行注入で致命セルも入れる。
  full: { mock: '.workspace', app: '.milspec-ws' },
};

async function shot(page, selector, outPath, { outer = false } = {}) {
  const handle = await page.$(selector);
  if (!handle) {
    console.warn(`  ! セレクタ "${selector}" が見つからない — スキップ`);
    return null;
  }
  let target = handle;
  if (outer) {
    const parent = await handle.evaluateHandle((el) => el.parentElement);
    const asEl = parent.asElement();
    if (asEl) target = asEl;
  }
  const box = await target.boundingBox();
  if (!box || box.width < 1 || box.height < 1) {
    console.warn(`  ! "${selector}" の描画サイズが 0 — スキップ`);
    return null;
  }
  await target.screenshot({ path: outPath });
  console.log(`  ✓ ${outPath}  (${Math.round(box.width)}x${Math.round(box.height)})`);
  return outPath;
}

async function captureMock(zone, cfg) {
  const { browser, page } = await launch({ theme: 'dark', headed: !!cfg.headed });
  try {
    await page.goto(pathToFileURL(MOCKUP_PATH).href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    // dev コントロールパネルを隠す + トレース下敷き(allagan-*.png)を無効化。
    // #stage.trace は .app を opacity:0.72 にして参照写真を透かす(=旧アプリUIの文字が
    // ゴーストで写り込む)。突き合わせでは自レイヤーのみ 100% で撮る。
    await page.evaluate(() => {
      for (const id of ['ctl', 'tune']) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      }
      document.getElementById('stage')?.classList.remove('trace');
    });
    await page.waitForTimeout(150);
    // Task 8: 計器スクロールバー — .table(thead + recast-row + tbody)の右端 72px を
    // 縦ストリップで clip。目盛りキャップ → 稼働バーが縦に連続するかを見る。
    if (zone === 'scrollbar') {
      const clip = await page.evaluate(() => {
        const t = document.querySelector('.table');
        if (!t) return null;
        const b = t.getBoundingClientRect();
        const w = 60;
        return {
          x: Math.max(0, b.right - w),
          y: Math.max(0, b.top),
          width: w,
          height: Math.min(b.height, 900 - Math.max(0, b.top)),
        };
      });
      if (!clip) { console.warn('  ! scrollbar mock: .table が無い'); return null; }
      const outPath = join(COMPARE_DIR, `${zone}-mock.png`);
      await page.screenshot({ path: outPath, clip });
      console.log(`  ✓ ${outPath}  (${Math.round(clip.width)}x${Math.round(clip.height)} clip)`);
      return outPath;
    }
    // モック側は cfg.outer を渡さない (= セレクタ要素そのものを撮る)。モックのゾーン
    // セレクタは既にアプリ側の外側ラッパ相当の粒度で選んであるため、揃える必要がない。
    return await shot(page, cfg.mock, join(COMPARE_DIR, `${zone}-mock.png`));
  } finally {
    await browser.close();
  }
}

/** 表を写す zone は「致命行」を 1 本作る。fixture の被ダメ(120k)は H1 HP(≈187k)未満で
 *  .dmg-slot.lethal が 1 つも出ないため、mockup .trow.lethal .td-mit(赤発光の凹み)を
 *  突き合わせられない。1 イベントだけ被ダメを HP 超へ引き上げる(store 注入・製品コード不変)。 */
const LETHAL_ZONES = new Set(['tbody', 'mitbar', 'scrollbar', 'full']);

/** コントロールバー系 zone は mockup が「折りたたむ ON / 罫線 ON」を描いている(.cb-tgl.on / .cb-ico.on)。
 *  突き合わせのため実アプリも同じ ON 状態にしてから撮る(store・製品コード不変)。 */
const CONTROLBAR_ON_ZONES = new Set(['controlbar', 'jobchips']);

async function captureApp(zone, cfg) {
  const { browser, page } = await launch({ theme: 'dark', headed: !!cfg.headed });
  const rec = attachConsoleRecorder(page);
  try {
    await gotoMiti(page);
    await applyFixture(page, { military: true });
    if (LETHAL_ZONES.has(zone)) {
      const lethal = await page.evaluate(async () => {
        const { useMitigationStore } = await import('/src/store/useMitigationStore.ts');
        const s = useMitigationStore.getState();
        const evs = s.timelineEvents.map((e, i) => (i === 1 ? { ...e, damageAmount: 900000 } : e));
        useMitigationStore.setState({ timelineEvents: evs });
        await new Promise((r) => setTimeout(r, 400));
        return document.querySelectorAll('.dmg-slot.lethal').length;
      });
      console.log(`  · 致命行注入: .dmg-slot.lethal ×${lethal}`);
    }
    if (CONTROLBAR_ON_ZONES.has(zone)) {
      await page.evaluate(async () => {
        const { useMitigationStore } = await import('/src/store/useMitigationStore.ts');
        const s = useMitigationStore.getState();
        if (s.hideEmptyRows) s.setHideEmptyRows(false); // 折りたたむ = ON (!hideEmptyRows)
        if (!s.showRowBorders) s.setShowRowBorders(true); // 罫線 = ON
        await new Promise((r) => setTimeout(r, 300));
      });
    }
    // Task 7: リキャスト帯はスクロール位置 = 現在時刻。scrollTop 0(戦闘開始前)では
    // どの軽減もリキャスト中でないため --cd-display:none で全アイコンが消え、
    // モック(7 セルにアイコン)と突き合わせられない。可視アイコン数が最大になる
    // スクロール位置を走査してからそこで撮る(store・製品コード不変)。
    if (zone === 'recast') {
      const info = await page.evaluate(async () => {
        const sc = document.querySelector('.timeline-scroll-container');
        if (!sc) return null;
        const visible = () =>
          Array.from(document.querySelectorAll('[data-milspec-recast-band] .recast-icon')).filter(
            (el) => getComputedStyle(el).display !== 'none',
          ).length;
        let bestTop = 0;
        let bestN = -1;
        for (let top = 0; top <= sc.scrollHeight - sc.clientHeight; top += 50) {
          sc.scrollTo({ top, left: 0 });
          await new Promise((r) => setTimeout(r, 40));
          const n = visible();
          if (n > bestN) { bestN = n; bestTop = top; }
        }
        sc.scrollTo({ top: bestTop, left: 0 });
        await new Promise((r) => setTimeout(r, 350));
        return { bestTop, bestN, total: document.querySelectorAll('[data-milspec-recast-band] .recast-icon').length };
      });
      if (info) console.log(`  · リキャスト最大可視位置: scrollTop ${info.bestTop} → アイコン ${info.bestN}/${info.total} 個`);
    }

    await page.waitForTimeout(300);

    // Task 8: 計器スクロールバー — ヘッダー外枠 top から scroll container bottom までの
    // 右端 72px を縦ストリップで clip。ヘッダー目盛りキャップ → リキャスト帯キャップ →
    // 稼働バーが縦に連続しているかを見る。headed 実 Chrome でのみ ::-webkit-scrollbar が描画される。
    if (zone === 'scrollbar') {
      const clip = await page.evaluate(() => {
        const sc = document.querySelector('.timeline-scroll-container');
        const headerOuter = document.querySelector('#timeline-header-inner')?.parentElement;
        if (!sc) return null;
        const scB = sc.getBoundingClientRect();
        const topB = (headerOuter || sc).getBoundingClientRect();
        const w = 60;
        return {
          x: Math.max(0, scB.right - w),
          y: Math.max(0, topB.top),
          width: w,
          height: Math.min(scB.bottom - topB.top, 900 - Math.max(0, topB.top)),
          barWidth: sc.offsetWidth - sc.clientWidth,
        };
      });
      if (!clip) { console.warn('  ! scrollbar app: .timeline-scroll-container が無い'); return null; }
      console.log(`  · 実測縦バー幅(offsetWidth-clientWidth) = ${clip.barWidth}px ${clip.barWidth > 0 ? '(描画されている)' : '(!! 0 = このブラウザは ::-webkit-scrollbar 非描画)'}`);
      const outPath = join(COMPARE_DIR, `${zone}-app.png`);
      await page.screenshot({ path: outPath, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height } });
      console.log(`  ✓ ${outPath}  (${Math.round(clip.width)}x${Math.round(clip.height)} clip)`);
      if (rec.fatal.length) {
        console.warn(`  ! アプリ側で非 whitelist の console/pageerror ${rec.fatal.length} 件:`);
        for (const l of rec.fatal.slice(0, 5)) console.warn('    ' + l);
      }
      return outPath;
    }

    // Task 6: mitbar / jobchips は「対象要素群を束ねた矩形」を clip で撮る接写。
    if (zone === 'mitbar' || zone === 'jobchips') {
      const outPath = join(COMPARE_DIR, `${zone}-app.png`);
      if (zone === 'mitbar') {
        // mockup .tbody は非コンパクト(全行展開)で効果棒が effect 時間ぶんの高さで伸びる。
        // 実アプリの既定は hideEmptyRows=true で棒が 24px に潰れるため、突き合わせ用に展開する。
        await page.evaluate(async () => {
          const { useMitigationStore } = await import('/src/store/useMitigationStore.ts');
          const s = useMitigationStore.getState();
          if (s.hideEmptyRows) s.setHideEmptyRows(false);
          await new Promise((r) => setTimeout(r, 400));
        });
        // いちばん背の高い効果棒(vengeance 等)を選び、その MitigationItem container 上端が
        // viewport 上部に来るよう縦スクロール(fixture の軽減は全て fold 下)。
        await page.evaluate(async () => {
          const sc = document.querySelector('.timeline-scroll-container');
          const bars = Array.from(document.querySelectorAll('[data-mit-bar]'));
          let best = null;
          let bestH = -1;
          for (const b of bars) {
            const h = parseFloat(b.style.height || '0') || b.getBoundingClientRect().height;
            if (h > bestH) { bestH = h; best = b; }
          }
          const cont = best && best.parentElement;
          const top = cont ? parseFloat(cont.style.top || '0') || 0 : 0;
          if (cont) cont.setAttribute('data-mitbar-probe', '1');
          if (sc) sc.scrollTo({ top: Math.max(0, top - 24), left: 0 });
          await new Promise((r) => setTimeout(r, 500));
        });
      }
      const clip = await page.evaluate((z) => {
        if (z === 'mitbar') {
          const cont = document.querySelector('[data-mitbar-probe]');
          const bar = cont && cont.querySelector('[data-mit-bar]');
          if (!cont || !bar) return null;
          const cb = cont.getBoundingClientRect();
          const bb = bar.getBoundingClientRect();
          const padX = 20;
          const x = Math.max(0, Math.min(cb.left, bb.left) - padX);
          const y = Math.max(0, cb.top - 16);
          const right = Math.max(cb.right, bb.right) + padX;
          const bottom = Math.min(bb.bottom + 12, 892); // viewport(900) 内にクランプ
          return { x, y, width: right - x, height: Math.max(2, bottom - y) };
        }
        const nodes = Array.from(document.querySelectorAll('#timeline-controls-inner [data-member-id]'));
        if (!nodes.length) return null;
        const rects = nodes.map((n) => n.getBoundingClientRect());
        const pad = 4;
        const x = Math.max(0, Math.min(...rects.map((r) => r.left)) - pad);
        const y = Math.max(0, Math.min(...rects.map((r) => r.top)) - pad);
        const right = Math.max(...rects.map((r) => r.right)) + pad;
        const bottom = Math.max(...rects.map((r) => r.bottom)) + pad;
        return { x, y, width: right - x, height: bottom - y };
      }, zone);
      if (!clip || clip.width < 2 || clip.height < 2) {
        console.warn(`  ! ${zone}: clip 矩形を計算できない — スキップ`);
        return null;
      }
      await page.screenshot({ path: outPath, clip });
      console.log(`  ✓ ${outPath}  (${Math.round(clip.width)}x${Math.round(clip.height)} clip)`);
      if (rec.fatal.length) {
        console.warn(`  ! アプリ側で非 whitelist の console/pageerror ${rec.fatal.length} 件 (compare は継続):`);
        for (const l of rec.fatal.slice(0, 5)) console.warn('    ' + l);
      }
      return outPath;
    }

    const out = await shot(page, cfg.app, join(COMPARE_DIR, `${zone}-app.png`), { outer: cfg.outer });
    if (rec.fatal.length) {
      console.warn(`  ! アプリ側で非 whitelist の console/pageerror ${rec.fatal.length} 件 (compare は継続):`);
      for (const l of rec.fatal.slice(0, 5)) console.warn('    ' + l);
    }
    return out;
  } finally {
    await browser.close();
  }
}

async function main() {
  const zone = process.argv[2];
  if (!zone || !ZONES[zone]) {
    console.error(`usage: node scripts/milspec-sp2/compare.mjs <zone>\n  zone: ${Object.keys(ZONES).join(' ')}`);
    process.exit(2);
  }
  const cfg = ZONES[zone];
  mkdirSync(COMPARE_DIR, { recursive: true });

  console.log(`zone "${zone}"  (mock: ${cfg.mock}  /  app: ${cfg.app}${cfg.outer ? ' [outer]' : ''})`);
  console.log(`\nモック (${MOCKUP_PATH}):`);
  const mockPath = await captureMock(zone, cfg);
  console.log(`\nアプリ (${BASE_URL}/miti · 軍事モード · fixture):`);
  const appPath = await captureApp(zone, cfg);

  console.log('\n── 出力 ──');
  console.log(`mock: ${mockPath || '(未取得)'}`);
  console.log(`app : ${appPath || '(未取得 — Task 1 時点では未実装の軍事要素が多い)'}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[compare] ERROR:', err);
  process.exit(1);
});
