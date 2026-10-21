// @ts-check
/**
 * no-video-in-standard.mjs — 背景動画のコスト対策を機械検証する(spec 2026-09-25 §5)。
 *  A. 標準モードの /miti で .mp4 / .webm / wall-poster へのリクエストが 0 件
 *  B. 軍事モードでは wall 動画がリクエストされる(配線されていることの確認)
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
  for (const military of [false, true]) {
    const { browser, page } = await launch({ theme: 'dark' });
    const hits = [];
    // dev の `?import` はモジュール(resourceType=script)で URL 文字列を返すだけ。実ダウンロードは media/image のみ数える。
    page.on('request', (r) => { if (['media', 'image'].includes(r.resourceType()) && isVideo(r.url())) hits.push(r.url()); });
    await gotoMiti(page);
    if (military) await applyFixture(page, { military: true });
    await page.waitForTimeout(2500);
    await browser.close();
    if (!military && hits.length) { console.error('NG A: 標準モードで動画リクエスト', hits); fail++; }
    if (!military && !hits.length) console.log('OK A: 標準モード 動画リクエスト 0 件');
    if (military && !hits.some((u) => u.includes('wall'))) { console.error('NG B: 軍事モードで wall 動画が要求されない'); fail++; }
    if (military && hits.some((u) => u.includes('wall'))) console.log('OK B: 軍事モードで wall 動画を要求');
  }
}
process.exit(fail ? 1 : 0);
