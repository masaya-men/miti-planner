// @ts-check
/**
 * 1 条件の撮影。新しい context で決定性の層を入れ、窓を開き、落ち着かせてから撮る。
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './determinism.mjs';
import { freeze } from './freeze.mjs';
import { serializeStorage } from '../fixtures/storage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(HERE, '..', 'fixtures');
const FONT_CACHE_DIR = path.join(HERE, '..', '.cache', 'fonts');

export const FIXED_NOW = '2026-10-01T12:00:00+09:00';
export const FIXED_SEED = 20261026;

/**
 * 画面条件(本人の画面幅 1489×679、多数派 1920×1080 / 2、スマホ 390×844 / 3)。
 * 1489 は本人の実倍率 2.58 ではなく 2 で撮る: 倍率はレイアウトに影響せず、半端な倍率は縁の丸めが揺れやすく画像も重い(2026-10-27 masaya 合意)
 */
const VIEWPORTS = {
  '1489': { viewport: { width: 1489, height: 679 }, deviceScaleFactor: 2 },
  '1920': { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 },
  '390': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

/** 落ち着き待ちの下限(ms)。Firestore を塞いだ /miti は行表示まで約 2.2 秒の実測 → 余裕を足す */
const SETTLE_FLOOR_MS = 2500;
/** open 前の ready 事前チェックの前に、描画が落ち着くのを待つ時間 */
const PRE_OPEN_WAIT_MS = 1200;
/** 窓を開いた後、framer-motion など JS 駆動の登場アニメが終わるのを待つ時間(WAAPI は freeze が終点へ送るが JS 駆動は送れない) */
const POST_OPEN_WAIT_MS = 250;
/** 絵が止まったか(画面が連続 3 回同じか)を 150ms 間隔で見る。上限を過ぎたら諦めて進む(止まらない JS ループは hide/mask 側で処理する) */
const STABLE_POLL_MS = 150;
const STABLE_MAX_MS = 4000;
/** ネットワーク要求ゼロが続くべき時間(ms) */
const QUIET_MS = 500;
/** 落ち着き待ちの上限(ms) */
const SETTLE_MAX_MS = 15000;

/**
 * @param {import('playwright').Browser} browser
 * @param {string} baseUrl
 * @param {{ key: string, entry: any, vp: string, theme: string, lang: string }} cond
 * @param {string} outFile
 * @param {{ injectCss?: string }} [opts] injectCss: 撮影直前に足す CSS(検出力の確認用)
 * @returns {Promise<{ ok: true, file: string, masks: { selector: string, reason: string }[] } | { ok: false, error: string, unmocked: string[] }>}
 */
export async function shootCondition(browser, baseUrl, cond, outFile, opts = {}) {
  const { entry, vp } = cond;
  const spec = VIEWPORTS[vp];
  if (!spec) return { ok: false, error: `未知の vp: ${vp}`, unmocked: [] };
  const context = await browser.newContext({ ...spec, reducedMotion: 'reduce', locale: cond.lang === 'en' ? 'en-US' : 'ja-JP', timezoneId: 'Asia/Tokyo' });
  /** @type {string[]} */
  let unmocked = [];
  /** 失敗で返す時は、撮りかけ・撮り終えた PNG を残さない(save-as では outFile が基準そのもの) */
  const fail = (/** @type {string} */ error) => {
    fs.rmSync(outFile, { force: true });
    return /** @type {const} */ ({ ok: false, error, unmocked });
  };
  try {
    const det = await installDeterminism(context, {
      appOrigin: new URL(baseUrl).origin,
      fixturesDir: FIXTURES_DIR,
      fontCacheDir: FONT_CACHE_DIR,
      now: FIXED_NOW,
      seed: FIXED_SEED,
    });
    unmocked = det.unmocked;

    // localStorage を、ページのスクリプトより先に書く
    const entries = serializeStorage(entry.storage(cond));
    await context.addInitScript((kv) => {
      try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch { /* 無視 */ }
    }, entries);

    const page = await context.newPage();
    // 要求の出入りを数える(落ち着き待ち用)
    let inflight = 0;
    let lastActivity = Date.now();
    page.on('request', () => { inflight++; lastActivity = Date.now(); });
    const done = () => { inflight = Math.max(0, inflight - 1); lastActivity = Date.now(); };
    page.on('requestfinished', done);
    page.on('requestfailed', done);

    const t0 = Date.now();
    await page.goto(new URL(entry.route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    if (entry.open) {
      // ready が開く前から満たされていたら、窓の目印になっていない(開かなくても撮れてしまう)ので失敗にする。
      // 描画が落ち着く前は 0 件になりがちなので、少し待ってから数える
      await page.waitForTimeout(PRE_OPEN_WAIT_MS);
      if ((await page.locator(entry.ready).filter({ visible: true }).count()) > 0) {
        return fail('ready が開く前から満たされている(窓の目印になっていない)');
      }
      await entry.open(page, cond);
    }
    await page.waitForSelector(entry.ready, { state: 'visible', timeout: 15000 });

    // 落ち着き待ち: 下限経過 + 500ms 要求ゼロ + 字体
    while (true) {
      const now = Date.now();
      if (now - t0 >= SETTLE_FLOOR_MS && inflight === 0 && now - lastActivity >= QUIET_MS) break;
      if (now - t0 > SETTLE_MAX_MS) return fail(`ネットワークが落ち着きませんでした(未完了 ${inflight} 件)`);
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => document.fonts.ready);
    if (entry.open) await page.waitForTimeout(POST_OPEN_WAIT_MS);
    {
      // JS 駆動のアニメ(framer-motion の登場・stagger)が終わるまで待つ: 連続 3 回同じ絵になったら止まったとみなす
      const tStable = Date.now();
      let prev = null;
      let same = 0;
      while (Date.now() - tStable < STABLE_MAX_MS && same < 2) {
        const buf = await page.screenshot({ animations: 'disabled', scale: 'css' });
        same = prev && buf.equals(prev) ? same + 1 : 0;
        prev = buf;
        if (same < 2) await page.waitForTimeout(STABLE_POLL_MS);
      }
    }

    await freeze(page, { hideSelectors: entry.hide ?? [] });

    // 検出力の確認用の CSS(head 側だけに足す)
    if (opts.injectCss) await page.addStyleTag({ content: opts.injectCss });

    // mask: 該当要素を不透明な単色で塗り、子は隠す(中身の揺れを比較から外す)。塗った分だけ記録する
    /** @type {{ selector: string, reason: string }[]} */
    const masks = [];
    for (const m of entry.mask ?? []) {
      const n = await page.evaluate(({ selector }) => {
        const els = document.querySelectorAll(selector);
        els.forEach((el) => {
          el.setAttribute('data-vr-mask', '1');
        });
        return els.length;
      }, m);
      if (n > 0) masks.push({ selector: m.selector, reason: m.reason });
      else console.warn(`警告: ${cond.key}: mask '${m.selector}' に一致する要素がありません`);
    }
    if (masks.length) {
      await page.addStyleTag({ content: '[data-vr-mask]{background:#ff00ff !important;border-color:#ff00ff !important;box-shadow:none !important;outline:none !important;background-image:none !important}[data-vr-mask] *{visibility:hidden !important}' });
    }

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    if (entry.clip === 'ready') {
      await page.locator(entry.ready).first().screenshot({ path: outFile, animations: 'disabled' });
    } else {
      await page.screenshot({ path: outFile, animations: 'disabled' });
    }

    if (unmocked.length) return fail(`見本の無い通信が ${unmocked.length} 件ありました`);
    return { ok: true, file: outFile, masks };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  } finally {
    await context.close();
  }
}
