// @ts-check
/**
 * 動きを止める(sticky-scroll/shots.mjs から移した共通部品)。
 * 有限のアニメは終点へ・無限のものは 0 で停止・transition 無効・video は 0 秒で停止。
 * @param {import('playwright').Page} page
 * @param {{ injectCss?: string, hideSelectors?: string[] }} [opts]
 */
export async function freeze(page, { injectCss, hideSelectors = [] } = {}) {
  if (injectCss) await page.addStyleTag({ content: injectCss });
  const hide = hideSelectors.length ? `${hideSelectors.join(',')}{visibility:hidden!important}` : '';
  await page.addStyleTag({ content: `*,*::before,*::after{transition:none!important;caret-color:transparent!important}${hide}` });
  await page.evaluate(async () => {
    for (const a of document.getAnimations()) {
      try {
        const it = a.effect?.getComputedTiming().iterations;
        if (it === Infinity) { a.pause(); a.currentTime = 0; } else a.finish();
      } catch { try { a.pause(); } catch { /* 無視 */ } }
    }
    // SVG の SMIL アニメ(<animate>/<animateMotion>)は getAnimations() に出ないので、全 svg を 0 秒で止める
    for (const svg of document.querySelectorAll('svg')) {
      try { svg.pauseAnimations(); svg.setCurrentTime(0); } catch { /* 無視 */ }
    }
    for (const v of document.querySelectorAll('video')) {
      v.pause();
      try { v.currentTime = 0; await new Promise((r) => { const t = setTimeout(r, 1500); v.addEventListener('seeked', () => { clearTimeout(t); r(undefined); }, { once: true }); }); } catch { /* 無視 */ }
    }
  });
  await page.evaluate(() => document.fonts.ready); // 字体の読み込み待ち(写真ごとの字形ずれを防ぐ)
  await page.waitForTimeout(250);
}
