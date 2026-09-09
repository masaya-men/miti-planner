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
  mitbar: { mock: '.tbody', app: '.timeline-scroll-container' },
  workspace: { mock: '.workspace', app: '.milspec-ws' },
  jobchips: { mock: '.subtoolbar .cb-e', app: '#timeline-controls-inner' },
  scrollbar: { mock: '.tbody', app: '.timeline-scroll-container' },
  wscap: { mock: '.ws-cap', app: '.milspec-ws-code-r' },
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
  const { browser, page } = await launch({ theme: 'dark' });
  try {
    await page.goto(pathToFileURL(MOCKUP_PATH).href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    // dev コントロールパネルを隠す
    await page.evaluate(() => {
      for (const id of ['ctl', 'tune']) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      }
    });
    await page.waitForTimeout(150);
    return await shot(page, cfg.mock, join(COMPARE_DIR, `${zone}-mock.png`));
  } finally {
    await browser.close();
  }
}

async function captureApp(zone, cfg) {
  const { browser, page } = await launch({ theme: 'dark' });
  const rec = attachConsoleRecorder(page);
  try {
    await gotoMiti(page);
    await applyFixture(page, { military: true });
    await page.waitForTimeout(300);
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
