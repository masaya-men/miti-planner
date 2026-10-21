// @ts-check
// 注意: これは各区画(header/footer 等)を作り直す計画の合格ゲート。旧 header/footer 部品が残る間は
// 1280 幅などで失敗するのが想定内(後続の区画計画で作り直すまで厳格なまま維持する)。
/**
 * zone-fit.mjs — 軍事テーマの全画面幅で「操作部品が隠れていない」ことを機械検証する。
 *  幅 1280 / 1489 / 1920 / 2560 × サイドバー開・閉 で、.milspec-app 内の見えている
 *  button, a[href], [role="button"], [role="tab"], input, select すべてについて
 *   (a) 矩形が viewport 内にある
 *   (b) 中心点の document.elementFromPoint がその要素自身か子孫である(他の物に覆われていない)
 *  表の縦スクロール領域(.timeline-scroll-container)の中の要素は、スクロール領域の矩形の内側に
 *  あるものだけを対象にする。違反があれば要素の aria-label/テキストと幅を出して exit 1。
 * 違反は要素の所属区画([data-ms-zone])別にも数える。
 *  --gate=header,vent,sidebar,rail を付けると、その区画の違反だけを exit 1 の対象にする(他の区画は件数を出すだけ)。
 *  付けないときは従来どおり全違反が対象。
 * 前提: dev サーバ http://localhost:5173。
 */
import { launch, gotoMiti, applyFixture } from '../milspec-sp2/_fixture.mjs';

const WIDTHS = [[1280, 720], [1489, 679], [1920, 1080], [2560, 1440]];
const SEL = 'button, a[href], [role="button"], [role="tab"], input, select';
let fail = 0;
const gateArg = process.argv.find((a) => a.startsWith('--gate='));
const GATE = gateArg ? gateArg.slice(7).split(',').filter(Boolean) : null;
/** @type {Record<string, number>} */
const perZone = {};

for (const [w, h] of WIDTHS) {
  const { browser, page } = await launch({ theme: 'dark', viewport: { width: w, height: h } });
  await gotoMiti(page);
  await applyFixture(page, { military: true });
  await page.waitForTimeout(1500);
  for (const open of [true, false]) {
    const handle = page.locator('.milspec-rail-handle');
    const cur = await handle.getAttribute('aria-expanded');
    if ((cur === 'true') !== open) { await handle.click(); await page.waitForTimeout(500); }
    const bad = [];
    const hSet = new Set();
    for (const pass of ['左端', '右端']) {
      // 表の横スクロール(.timeline-scroll-container)を左端 / 右端にして、それぞれ見えている部品を検査する
      await page.evaluate((p) => {
        const sc = document.querySelector('.timeline-scroll-container');
        if (sc) sc.scrollLeft = p === '右端' ? sc.scrollWidth : 0;
      }, pass);
      await page.waitForTimeout(250);
      const got = await page.evaluate(({ SEL, w, h }) => {
      const app = document.querySelector('.milspec-app');
      if (!app) return { out: [{ name: '(.milspec-app なし)', why: 'missing' }], hNames: [] };
      const out = [];
      const hNames = [];
      for (const el of app.querySelectorAll(SEL)) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // 祖先に visibility:hidden / display:none / opacity:0 / 幅0のoverflow隠しがあるものは「見えていない」
        let hiddenAnc = false;
        for (let a = el.parentElement; a && a !== app; a = a.parentElement) {
          const c = getComputedStyle(a);
          if (c.visibility === 'hidden' || c.display === 'none' || Number(c.opacity) === 0) { hiddenAnc = true; break; }
        }
        if (hiddenAnc) continue;
        // 縦スクロール領域(表・サイドバーのツリー等)の中の要素は、その領域の矩形の内側にあるものだけを対象にする
        let clipped = false; let hClipped = false;
        for (let a = el.parentElement; a && a !== app; a = a.parentElement) {
          const c = getComputedStyle(a);
          if (/(auto|scroll)/.test(c.overflowY) && a.scrollHeight > a.clientHeight) {
            const sr = a.getBoundingClientRect();
            if (!(r.left >= sr.left && r.right <= sr.right && r.top >= sr.top && r.bottom <= sr.bottom)) clipped = true;
          }
          // 横にはみ出す容器(表が画面より広いとき)の可視範囲の外にある要素は、横スクロールで見える位置へ
          // 来たときに検査する(下の scrollLeft = 最大 の 2 回目)。ここでは違反にしない。
          if (/(auto|scroll|hidden|clip)/.test(c.overflowX) && a.scrollWidth > a.clientWidth + 1) {
            const sr = a.getBoundingClientRect();
            if (r.right > sr.right + 0.5 || r.left < sr.left - 0.5) { clipped = true; hClipped = true; }
          }
        }
        if (hClipped) hNames.push(el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 24) || el.tagName);
        if (clipped) continue;
        const name = el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 24) || el.getAttribute('title') || el.tagName;
        const zone = el.closest('[data-ms-zone]')?.getAttribute('data-ms-zone') || '(区画外)';
        const info = { zone, name, tag: el.tagName, cls: String(el.className).slice(0, 40), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) };
        if (r.left < 0 || r.top < 0 || r.right > w || r.bottom > h) { out.push({ ...info, why: '矩形が viewport 外' }); continue; }
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!top || !(top === el || el.contains(top))) {
          const t = top ? (top.tagName + '.' + String(top.className).slice(0, 40)) : 'null';
          out.push({ ...info, why: '中心が別要素に覆われている: ' + t });
        }
      }
      return { out, hNames };
    }, { SEL, w, h });
      if (pass === '左端') for (const n of got.hNames) hSet.add(n);
      // 右端では「左端のとき横に隠れていた部品」だけを検査する(操作列など左端で見えていたものは対象外)
      for (const g of got.out) if ((pass === '左端' || hSet.has(g.name)) && !bad.some((b) => b.zone === g.zone && b.name === g.name && b.rect.join() === g.rect.join() && b.why === g.why)) bad.push({ ...g, pass });
    }
    const label = `${w}x${h} サイドバー${open ? '開' : '閉'}`;
    const counted = bad.filter((b) => !GATE || GATE.includes(b.zone));
    for (const b of bad) { perZone[b.zone] = (perZone[b.zone] || 0) + 1; }
    if (bad.length) {
      const zs = {};
      for (const b of bad) zs[b.zone] = (zs[b.zone] || 0) + 1;
      if (counted.length) fail++;
      console[counted.length ? 'error' : 'log']((counted.length ? 'NG ' : 'OK(対象外のみ) ') + label + ' ' + bad.length + ' 件 区画別 ' + JSON.stringify(zs));
      for (const b of bad) console[(!GATE || GATE.includes(b.zone)) ? 'error' : 'log']('   ', JSON.stringify(b));
    } else console.log('OK ' + label + (hSet.size ? ' (横に隠れていた ' + hSet.size + ' 件は右端で検査済み)' : ''));
  }
  await browser.close();
}
console.log('区画別の違反の延べ件数: ' + JSON.stringify(perZone));
process.exit(fail ? 1 : 0);
