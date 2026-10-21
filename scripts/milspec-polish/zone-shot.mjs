// @ts-check
/**
 * zone-shot.mjs — 承認済み見本(v11)と本体の「同じ区画」を同条件で撮って並べて見られるようにする。
 *  条件: viewport 1489×(--height, 既定 679) / deviceScaleFactor 2 / reducedMotion なし(光の確認のため)。
 *  使い方:
 *    node scripts/milspec-polish/zone-shot.mjs --zone=sidebar|header --mock=<見本 html の絶対パス> --out=<出力フォルダ> [--theme=dark|light] [--lang=ja|en|ko|zh|zh-Hant] [--height=679] [--width=1489] [--sb=open|closed]
 *    --zone=header は 見本 #z-hdr 上端〜#z-vent 下端 / 本体 [data-ms-zone="header"] 上端〜[data-ms-zone="vent"] 下端 を全幅で 1 枚に撮る。
 *      出力: header-mock-<theme>.png / header-app-<theme>-<lang>-<幅>x<高さ>-sb<open|closed>.png / header-menu-<名前>-....png
 *      検査: 取り込み・その他・表示メンバー・言語・チュートリアルのメニューを順に開き、メニューの矩形がボタンの近く
 *            (ボタンの下か上で、横位置がボタンと重なる・viewport 内)にあるかを DOM で確認する。
 *    --zone=footer|rail は 見本 #z-ftr / #z-rail と 本体 [data-ms-zone="footer"|"rail"] を撮る。電源投入の 1.5 秒後に撮る(--power=on 既定)。
 *      --power=off は電源断の状態(MODE レバーを上げ、電源断の暗転が終わった直後)で撮る。
 *      検査: 区画の矩形が viewport 内・幅と高さが 0 でない。footer は「法的情報」を開いた状態も撮り、一覧が viewport 内か確認する。
 *      出力: <zone>-mock-<theme>.png / <zone>-app-<theme>-<lang>-<幅>x<高さ>-<power>.png / footer-legal-....png
 *  出力: <out>/sidebar-mock-<theme>.png / <out>/sidebar-app-<theme>-<lang>.png / <out>/sidebar-app-energy.png
 *  検査(失敗なら exit 1):
 *   - 刻印はみ出し: 本体の .milspec-key-lb で scrollWidth > clientWidth + 1
 *   - 英語の副題: --lang=en のとき .milspec-stencil-sub が無い(または ASCII のみ)
 *   - 高さ追従: 区画の下端に S3 の装甲・キー・飾りが揃う / ツリー箱と S3・補修板が重ならない / PLAN CORE の IC が箱の下寄り
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
if (!['sidebar', 'header', 'footer', 'rail'].includes(zone)) { console.error(`未対応の zone: ${zone}(sidebar / header / footer / rail)`); process.exit(2); }
if (!out) { console.error('--out=<出力フォルダ> が必要'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

const height = Number(arg('height', '679')) || 679;
const width = Number(arg('width', '1489')) || 1489;
const sbMode = arg('sb', 'open') === 'closed' ? 'closed' : 'open';
const VP = { width, height };
const tag = height === 679 ? '' : `-h${height}`;
let failed = 0;

const power = arg('power', 'on') === 'off' ? 'off' : 'on';

if (zone === 'header') {
  await runHeader();
  process.exit(failed ? 1 : 0);
}
if (zone === 'footer' || zone === 'rail') {
  await runFooterRail(zone);
  process.exit(failed ? 1 : 0);
}

// ── フッター / レール ─────────────────────────────────
async function runFooterRail(z) {
  const mockSel = z === 'footer' ? '#z-ftr' : '#z-rail';
  if (mock) {
    const { browser, page } = await launch({ theme, viewport: VP, dsf: 2, motion: 'no-preference' });
    await page.goto(mock.startsWith('file:') ? mock : pathToFileURL(path.resolve(mock)).href, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    if (theme === 'light') { await page.locator('.vr').first().click(); await page.waitForTimeout(1800); }
    await page.locator(mockSel).screenshot({ path: path.join(out, `${z}-mock-${theme}.png`) });
    console.log(`撮影: ${z}-mock-${theme}.png`);
    await browser.close();
  }
  const { browser, page } = await launch({ theme, viewport: VP, dsf: 2, motion: 'no-preference' });
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
  // 電源投入(レバーが 0.7 秒後に下りて約 0.94 秒で on)の 1.5 秒後に撮る
  try {
    await page.waitForFunction(() => document.documentElement.dataset.msPower === 'on', null, { timeout: 4000 });
  } catch { failed++; console.error('NG 電源が on にならない'); }
  await page.waitForTimeout(1500);
  if (power === 'off') {
    await page.locator('[data-ms-zone="header"] button.milspec-mlv').click();
    // 標準へ戻る直前まで待つ余裕がないため、電源断(300ms)の途中〜直後を撮る
    await page.waitForTimeout(350);
  }
  const base = `${z}-app-${theme}-${lang}-${width}x${height}-power${power}`;
  const el = page.locator(`[data-ms-zone="${z}"]`);
  if ((await el.count()) !== 1) { failed++; console.error(`NG 本体の ${z} 区画が見つからない`); await browser.close(); return; }
  const r = await el.boundingBox();
  if (!r || r.width < 10 || r.height < 10 || r.x < -1 || r.y < -1 || r.x + r.width > width + 1 || r.y + r.height > height + 1) {
    failed++; console.error(`NG ${z} 区画の矩形が不正: ${JSON.stringify(r)}`);
  } else console.log(`OK ${z} 区画 ${Math.round(r.width)}x${Math.round(r.height)} @(${Math.round(r.x)},${Math.round(r.y)})`);
  await el.screenshot({ path: path.join(out, `${base}.png`) });
  console.log(`撮影: ${base}.png`);
  if (z === 'footer' && power === 'on') {
    await page.locator('[data-ms-zone="footer"] .milspec-ftr-legalwrap button.milspec-flink').click();
    await page.waitForTimeout(500);
    const pop = await page.locator('.milspec-legal-pop').boundingBox();
    if (!pop || pop.x < 0 || pop.y < 0 || pop.x + pop.width > width || pop.y + pop.height > height) {
      failed++; console.error(`NG 法的情報の一覧が viewport 外/無い: ${JSON.stringify(pop)}`);
    } else console.log(`OK 法的情報の一覧 ${Math.round(pop.width)}x${Math.round(pop.height)} @(${Math.round(pop.x)},${Math.round(pop.y)})`);
    await page.screenshot({ path: path.join(out, `footer-legal-${theme}-${lang}-${width}x${height}.png`), clip: { x: 0, y: Math.max(0, height - 260), width, height: Math.min(260, height) } });
  }
  await browser.close();
}

// ── ヘッダー + 通気口 ─────────────────────────────────
async function runHeader() {
  // 見本: #z-hdr 上端〜#z-vent 下端(全幅)
  if (mock) {
    const { browser, page } = await launch({ theme, viewport: VP, dsf: 2, motion: 'no-preference' });
    await page.goto(mock.startsWith('file:') ? mock : pathToFileURL(path.resolve(mock)).href, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    if (theme === 'light') { await page.locator('.vr').first().click(); await page.waitForTimeout(1800); }
    const a = await page.locator('#z-hdr').boundingBox();
    const b = await page.locator('#z-vent').boundingBox();
    if (!a || !b) { failed++; console.error('NG 見本の #z-hdr / #z-vent が見つからない'); }
    else {
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x + a.width, b.x + b.width);
      await page.screenshot({ path: path.join(out, `header-mock-${theme}.png`), fullPage: true,
        clip: { x: x0, y: a.y, width: x1 - x0, height: b.y + b.height - a.y } });
      console.log(`撮影: header-mock-${theme}.png`);
    }
    await browser.close();
  }

  const { browser, page } = await launch({ theme, viewport: VP, dsf: 2, motion: 'no-preference' });
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
  await page.waitForTimeout(3500);
  const handle = page.locator('.milspec-rail-handle');
  if ((await handle.count()) > 0) {
    const cur = await handle.getAttribute('aria-expanded');
    if ((cur === 'true') !== (sbMode === 'open')) { await handle.click(); await page.waitForTimeout(600); }
  }
  const clip = await page.evaluate(() => {
    const h = document.querySelector('[data-ms-zone="header"]')?.getBoundingClientRect();
    const v = document.querySelector('[data-ms-zone="vent"]')?.getBoundingClientRect();
    if (!h || !v) return null;
    const x0 = Math.min(h.left, v.left), x1 = Math.max(h.right, v.right);
    return { x: x0, y: h.top, width: x1 - x0, height: v.bottom - h.top };
  });
  const base = `header-app-${theme}-${lang}-${width}x${height}-sb${sbMode}`;
  if (!clip) { failed++; console.error('NG 本体の header / vent 区画が見つからない'); }
  else {
    await page.screenshot({ path: path.join(out, `${base}.png`), clip });
    console.log(`撮影: ${base}.png`);
  }

  // メニュー: 順に開き、メニューの矩形がボタンの近くにあるか(DOM の矩形で判定)
  const slots = page.locator('[data-ms-zone="header"] .milspec-h4-slot button.milspec-keybtn');
  const n = await slots.count();
  if (n !== 5) { failed++; console.error(`NG メニューのボタンが 5 個でない(${n})`); }
  else {
    // DOM 順: AUX(チュートリアル)→ COM(言語)→ PARTY OPS(取り込み・その他)→ 表示メンバー
    const names = ['tutorial', 'language', 'import', 'more', 'visibility'];
    for (let i = 0; i < 5; i++) {
      const btn = slots.nth(i);
      const br = await btn.boundingBox();
      // 押す前から出ている fixed 要素(トースト等)をメニューと取り違えないよう、印を付けておく
      await page.evaluate(() => document.querySelectorAll('body *').forEach((e) => e.setAttribute('data-zs-pre', '1')));
      // 表示メンバーは標準と同じくホバーで開く(クリックだと開いた直後に閉じ直す)
      if (names[i] === 'visibility') await btn.hover(); else await btn.click();
      await page.waitForTimeout(450);
      const res = await page.evaluate((b) => {
        const vw = innerWidth, vh = innerHeight;
        const cands = Array.from(document.body.querySelectorAll('*')).filter((e) => {
          const cs = getComputedStyle(e);
          if (e.hasAttribute('data-zs-pre') || cs.position !== 'fixed') return false;
          const r = e.getBoundingClientRect();
          return r.width > 60 && r.height > 30 && r.width < vw * 0.8;
        }).map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
        if (!cands.length) return { found: false };
        const m = cands.sort((p, q) => (q.r - q.l) * (q.b - q.t) - (p.r - p.l) * (p.b - p.t))[0];
        const hOverlap = m.l < b.x + b.width && m.r > b.x;
        const near = (m.t >= b.y + b.height - 6 && m.t <= b.y + b.height + 80) || (m.b <= b.y + 6 && m.b >= b.y - 80);
        const inside = m.l >= -1 && m.t >= -1 && m.r <= vw + 1 && m.b <= vh + 1;
        return { found: true, m, hOverlap, near, inside };
      }, br);
      await page.screenshot({ path: path.join(out, `header-menu-${names[i]}-${theme}-${lang}-${width}x${height}.png`) });
      if (!res.found) { failed++; console.error(`NG メニュー ${names[i]}: 開いたメニューが見つからない`); }
      else if (!res.hOverlap || !res.near || !res.inside) {
        failed++; console.error(`NG メニュー ${names[i]}: ボタンの近くにない ` + JSON.stringify({ btn: br, ...res }));
      } else console.log(`OK メニュー ${names[i]} はボタンの近く(${Math.round(res.m.l)},${Math.round(res.m.t)})`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.mouse.click(2, height - 2); // 閉じきらないものの保険
      await page.waitForTimeout(250);
      await page.evaluate(() => document.querySelectorAll('[data-zs-pre]').forEach((e) => e.removeAttribute('data-zs-pre')));
    }
  }
  await browser.close();
}


// ── 見本 ──────────────────────────────────────────────
if (mock) {
  const { browser, page } = await launch({ theme, viewport: VP, dsf: 2, motion: 'no-preference' });
  await page.goto(mock.startsWith('file:') ? mock : pathToFileURL(path.resolve(mock)).href, { waitUntil: 'load' });
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
  await zoneEl.screenshot({ path: path.join(out, `sidebar-app-${theme}-${lang}${tag}.png`) });
  console.log(`撮影: sidebar-app-${theme}-${lang}.png`);

  // 刻印はみ出し
  const over = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-ms-zone="sidebar"] .milspec-key-lb'))
      .filter((e) => e.scrollWidth > e.clientWidth + 1)
      .map((e) => `${(e.textContent || '').trim()} (scrollWidth ${e.scrollWidth} > clientWidth ${e.clientWidth})`));
  if (over.length) { failed++; console.error('NG 刻印はみ出し: ' + over.join(' / ')); } else console.log('OK 刻印はみ出しなし');

  // 英語: 刻印の副題(日本語へのフォールバック)が出ていない
  if (lang === 'en') {
    const subs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-ms-zone="sidebar"] .milspec-stencil .milspec-stencil-sub'))
        .map((e) => (e.textContent || '').trim()).filter((t) => /[^\x00-\x7f]/.test(t)));
    if (subs.length) { failed++; console.error('NG 英語なのに副題が非 ASCII: ' + subs.join(' / ')); } else console.log('OK 英語の副題に日本語なし');
  }

  // 高さ追従(矩形の数値で判定)。sbY は sidebarGeometry と同じ式: y>300 のものは (H-679) だけ動く
  const geo = await page.evaluate(() => {
    const z = document.querySelector('[data-ms-zone="sidebar"]').getBoundingClientRect();
    const rel = (e) => { const r = e.getBoundingClientRect(); return { top: r.top - z.top, bottom: r.bottom - z.top, h: r.height }; };
    const q = (sel) => document.querySelector(`[data-ms-zone="sidebar"] ${sel}`);
    const kcs = Array.from(document.querySelectorAll('[data-ms-zone="sidebar"] .milspec-sb-kc'));
    const core = q('.milspec-sb-core');
    const ic = q('.milspec-plan-core rect.ic');
    const tree = q('.milspec-sb-treebox');
    return {
      H: z.height,
      armor: rel(q('[data-ms-armor="sb"]')),
      kc: kcs.map(rel),
      plate: q('.milspec-maint') ? rel(q('.milspec-maint')) : null,
      barcode: q('.milspec-barcode') ? rel(q('.milspec-barcode')) : null,
      tree: tree ? rel(tree) : null,
      core: core ? rel(core) : null,
      ic: ic ? rel(ic) : null,
    };
  });
  const sbY = (y) => (y > 300 ? y + (geo.H - 679) : y);
  const near = (a, b, label) => { if (Math.abs(a - b) > 2) { failed++; console.error(`NG ${label}: 実測 ${a.toFixed(1)} / 期待 ${b.toFixed(1)}`); } else console.log(`OK ${label} (${a.toFixed(1)})`); };
  console.log(`区画の高さ H=${geo.H.toFixed(1)}`);
  // (a) 下端に揃う: 装甲の下端 = 区画の下端、キー列(service/dock)・点検板・バーコードの top = sbY(基準 y)
  near(geo.armor.bottom, geo.H, '(a) 装甲の下端が区画の下端');
  near(geo.kc[geo.kc.length - 2].top, sbY(619), '(a) SERVICE キー列の位置');
  near(geo.kc[geo.kc.length - 1].top, sbY(646), '(a) DOCK キー列の位置');
  if (geo.plate) near(geo.plate.top, sbY(628.2), '(a) 点検板の位置');
  if (geo.barcode) near(geo.barcode.top, sbY(628.8), '(a) バーコードの位置');
  // (b) ツリー箱の下端が補修板(594.4)・S3(612)より上
  if (geo.tree) {
    const lim = Math.min(sbY(594.4), sbY(612));
    if (geo.tree.bottom > lim + 0.5) { failed++; console.error(`NG (b) ツリー箱の下端 ${geo.tree.bottom.toFixed(1)} が補修板/S3 の上端 ${lim.toFixed(1)} を越える`); }
    else console.log(`OK (b) ツリー箱の下端 ${geo.tree.bottom.toFixed(1)} <= ${lim.toFixed(1)}`);
  } else { failed++; console.error('NG ツリー箱が見つからない'); }
  // (c) PLAN CORE の IC が箱の下寄り(IC の中心が箱の高さの 50% より下)
  if (geo.ic && geo.core) {
    const ratio = ((geo.ic.top + geo.ic.h / 2) - geo.core.top) / geo.core.h;
    if (ratio < 0.5) { failed++; console.error(`NG (c) IC が箱の上寄り(中心 ${(ratio * 100).toFixed(0)}%)`); } else console.log(`OK (c) IC は箱の下寄り(中心 ${(ratio * 100).toFixed(0)}%)`);
  } else { failed++; console.error('NG PLAN CORE の IC が見つからない'); }

  // 光: 押されていないコンテンツのキーを押して 400ms 後
  const key = page.locator('[data-ms-zone="sidebar"] [role="group"] button.milspec-key[aria-pressed="false"]').first();
  if ((await key.count()) === 0) { failed++; console.error('NG 押せるコンテンツのキーがない'); }
  else {
    await key.click();
    await page.waitForTimeout(400);
    const n = await page.locator('[data-ms-zone="sidebar"] .milspec-pz-c').count();
    await zoneEl.screenshot({ path: path.join(out, `sidebar-app-energy${tag}.png`) });
    if (n < 1) { failed++; console.error('NG 光(.milspec-pz-c)が 0 本'); } else console.log(`OK 光 ${n} 本`);
  }
  await browser.close();
}
process.exit(failed ? 1 : 0);
