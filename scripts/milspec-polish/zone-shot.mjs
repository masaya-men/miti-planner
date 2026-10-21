// @ts-check
/**
 * zone-shot.mjs — 承認済み見本(v11)と本体の「同じ区画」を同条件で撮って並べて見られるようにする。
 *  条件: viewport 1489×679 / deviceScaleFactor 2 / reducedMotion なし(光の確認のため)。
 *  使い方:
 *    node scripts/milspec-polish/zone-shot.mjs --zone=sidebar --mock=<見本 html の絶対パス> --out=<出力フォルダ> [--theme=dark|light] [--lang=ja|en]
 *  出力: <out>/sidebar-mock-<theme>.png / <out>/sidebar-app-<theme>-<lang>.png / <out>/sidebar-app-energy.png
 *  検査(失敗なら exit 1):
 *   - 刻印はみ出し: 本体の .milspec-key-lb で scrollWidth > clientWidth + 1
 *   - 光: コンテンツのキーを押した 400ms 後に .milspec-pz-c が 1 本以上ある
 *  前提: dev サーバ http://localhost:5173(本体側)。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, gotoMiti, applyFixture } from '../milspec-sp2/_fixture.mjs';

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const zone = arg('zone', 'sidebar');
const mock = arg('mock', '');
const out = arg('out', '');
const theme = arg('theme', 'dark') === 'light' ? 'light' : 'dark';
const lang = arg('lang', 'ja');
if (zone !== 'sidebar') { console.error(`未対応の zone: ${zone}(今は sidebar のみ)`); process.exit(2); }
if (!out) { console.error('--out=<出力フォルダ> が必要'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

const VP = { width: 1489, height: 679 };
let failed = 0;

// ── 見本 ──────────────────────────────────────────────
if (mock) {
  const { browser, page } = await launch({ theme, viewport: VP, dsf: 2, motion: 'no-preference' });
  await page.goto(pathToFileURL(path.resolve(mock)).href, { waitUntil: 'load' });
  await page.waitForTimeout(3500); // 起動のレバー演出が終わるまで
  if (theme === 'light') {
    await page.locator('.vr').first().click(); // 見本のテーマ縦ロッカー
    await page.waitForTimeout(1800); // 走査線 + 塗り替え
  }
  await page.locator('#z-sb').screenshot({ path: path.join(out, `sidebar-mock-${theme}.png`) });
  console.log(`撮影: sidebar-mock-${theme}.png`);
  await browser.close();
}

// ── 本体 ──────────────────────────────────────────────
{
  const { browser, page } = await launch({ theme, viewport: VP, dsf: 2, motion: 'no-preference' });
  // launch の初期化スクリプトのあとに実行され、言語だけ差し替える
  await page.addInitScript((l) => {
    try {
      const raw = localStorage.getItem('theme-storage');
      const j = raw ? JSON.parse(raw) : { state: {}, version: 2 };
      j.state.contentLanguage = l;
      localStorage.setItem('theme-storage', JSON.stringify(j));
    } catch { /* 無視 */ }
  }, lang);
  await gotoMiti(page);
  await applyFixture(page, { military: true });
  await page.waitForTimeout(3500); // 起動演出
  const zoneEl = page.locator('[data-ms-zone="sidebar"]');
  await zoneEl.screenshot({ path: path.join(out, `sidebar-app-${theme}-${lang}.png`) });
  console.log(`撮影: sidebar-app-${theme}-${lang}.png`);

  // 刻印はみ出し
  const over = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-ms-zone="sidebar"] .milspec-key-lb'))
      .filter((e) => e.scrollWidth > e.clientWidth + 1)
      .map((e) => `${(e.textContent || '').trim()} (scrollWidth ${e.scrollWidth} > clientWidth ${e.clientWidth})`));
  if (over.length) { failed++; console.error('NG 刻印はみ出し: ' + over.join(' / ')); } else console.log('OK 刻印はみ出しなし');

  // 光: 押されていないコンテンツのキーを押して 400ms 後
  const key = page.locator('[data-ms-zone="sidebar"] [role="group"] button.milspec-key[aria-pressed="false"]').first();
  if ((await key.count()) === 0) { failed++; console.error('NG 押せるコンテンツのキーがない'); }
  else {
    await key.click();
    await page.waitForTimeout(400);
    const n = await page.locator('[data-ms-zone="sidebar"] .milspec-pz-c').count();
    await zoneEl.screenshot({ path: path.join(out, 'sidebar-app-energy.png') });
    if (n < 1) { failed++; console.error('NG 光(.milspec-pz-c)が 0 本'); } else console.log(`OK 光 ${n} 本`);
  }
  await browser.close();
}
process.exit(failed ? 1 : 0);
