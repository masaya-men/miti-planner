// @ts-check
/**
 * no-video-in-standard.mjs — 背景動画のコスト対策を機械検証する(spec 2026-09-25 §5)。
 *  A. 標準モードの /miti で .mp4 / .webm / wall-poster へのリクエストが 0 件
 *  B. 軍事モードでは wall 動画がリクエストされる(配線されていることの確認)
 *  E. MIL-SPEC の書体(IBM Plex Sans JP)は軍事×PC のときだけ要求される
 *  C. --sw 指定時: dist/sw.js の precache に wall が含まれない(事前に npm run build)
 * 前提: dev サーバ http://localhost:5173(C は不要)。exit 0 = 全 OK。
 */
import { readFileSync } from 'node:fs';
import { launch, gotoMiti, applyFixture } from '../milspec-sp2/_fixture.mjs';

let fail = 0;
const isVideo = (u) => /\.(mp4|webm)(\?|$)/.test(u) || u.includes('wall-poster');

if (process.argv.includes('--sw')) {
  const sw = readFileSync('dist/sw.js', 'utf8');
  if (/wall/.test(sw)) { console.error('NG C: dist/sw.js の precache に wall が含まれている'); fail++; }
  else console.log('OK C: SW precache に動画/poster なし');
} else {
  for (const [military, phone] of [[false, false], [true, false], [false, true], [true, true]]) {
    const { browser, page } = await launch({ theme: 'dark', ...(phone ? { viewport: { width: 390, height: 844 } } : {}) });
    const hits = [];
    const fontHits = [];
    // dev の `?import` はモジュール(resourceType=script)で URL 文字列を返すだけ。実ダウンロードは media/image のみ数える。
    page.on('request', (r) => { if (['media', 'image'].includes(r.resourceType()) && isVideo(r.url())) hits.push(r.url()); });
    page.on('request', (r) => { const u = r.url(); if (u.includes('fonts.googleapis.com/css2') && u.includes('IBM+Plex+Sans+JP')) fontHits.push(u); });
    await gotoMiti(page);
    if (military) await applyFixture(page, { military: true });
    await page.waitForTimeout(2500);
    await browser.close();
    // E. MIL-SPEC の書体は軍事かつ PC のときだけ読む
    const wantFont = military && !phone;
    const labelE = (military ? '軍事' : '標準') + (phone ? 'スマホ' : 'PC');
    if (wantFont ? fontHits.length >= 1 : fontHits.length === 0) console.log('OK E: ' + labelE + ' 書体リクエスト ' + fontHits.length + ' 件');
    else { console.error('NG E: ' + labelE + ' 書体リクエスト ' + fontHits.length + ' 件'); fail++; }
    if (phone) {
      const mode = military ? '軍事' : '標準';
      if (hits.length) { console.error('NG D: スマホ幅(' + mode + ')で動画リクエスト', hits); fail++; }
      else console.log('OK D: スマホ幅 ' + mode + 'モード 動画リクエスト 0 件');
      continue;
    }
    if (!military && hits.length) { console.error('NG A: 標準モードで動画リクエスト', hits); fail++; }
    if (!military && !hits.length) console.log('OK A: 標準モード 動画リクエスト 0 件');
    if (military && !hits.some((u) => u.includes('wall'))) { console.error('NG B: 軍事モードで wall 動画が要求されない'); fail++; }
    if (military && hits.some((u) => u.includes('wall'))) console.log('OK B: 軍事モードで wall 動画を要求');
  }
}
process.exit(fail ? 1 : 0);
