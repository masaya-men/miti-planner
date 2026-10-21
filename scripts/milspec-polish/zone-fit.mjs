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
 * 前提: dev サーバ http://localhost:5173。
 */
import { launch, gotoMiti, applyFixture } from '../milspec-sp2/_fixture.mjs';

const WIDTHS = [[1280, 720], [1489, 679], [1920, 1080], [2560, 1440]];
const SEL = 'button, a[href], [role="button"], [role="tab"], input, select';
let fail = 0;

for (const [w, h] of WIDTHS) {
  const { browser, page } = await launch({ theme: 'dark', viewport: { width: w, height: h } });
  await gotoMiti(page);
  await applyFixture(page, { military: true });
  await page.waitForTimeout(1500);
  for (const open of [true, false]) {
    const handle = page.locator('.milspec-rail-handle');
    const cur = await handle.getAttribute('aria-expanded');
    if ((cur === 'true') !== open) { await handle.click(); await page.waitForTimeout(500); }
    const bad = await page.evaluate(({ SEL, w, h }) => {
      const app = document.querySelector('.milspec-app');
      if (!app) return [{ name: '(.milspec-app なし)', why: 'missing' }];
      const out = [];
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
        let clipped = false;
        for (let a = el.parentElement; a && a !== app; a = a.parentElement) {
          const c = getComputedStyle(a);
          if (/(auto|scroll)/.test(c.overflowY) && a.scrollHeight > a.clientHeight) {
            const sr = a.getBoundingClientRect();
            if (!(r.left >= sr.left && r.right <= sr.right && r.top >= sr.top && r.bottom <= sr.bottom)) clipped = true;
          }
        }
        if (clipped) continue;
        const name = el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 24) || el.getAttribute('title') || el.tagName;
        const info = { name, tag: el.tagName, cls: String(el.className).slice(0, 40), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) };
        if (r.left < 0 || r.top < 0 || r.right > w || r.bottom > h) { out.push({ ...info, why: '矩形が viewport 外' }); continue; }
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!top || !(top === el || el.contains(top))) {
          const t = top ? (top.tagName + '.' + String(top.className).slice(0, 40)) : 'null';
          out.push({ ...info, why: '中心が別要素に覆われている: ' + t });
        }
      }
      return out;
    }, { SEL, w, h });
    const label = `${w}x${h} サイドバー${open ? '開' : '閉'}`;
    if (bad.length) {
      fail++;
      console.error('NG ' + label + ' ' + bad.length + ' 件');
      for (const b of bad) console.error('   ', JSON.stringify(b));
    } else console.log('OK ' + label);
  }
  await browser.close();
}
process.exit(fail ? 1 : 0);
