// @ts-check
// 軽減表(/miti)スマホ(390 幅)のページと、シート・ポップのカタログ。
// MIL-SPEC にはスマホ用の配置が無いので standard-dark/light のみ(ruling 16)。
// MobileBottomSheet には role が無いので、シートの外枠(z-[301])+ シート固有の文言を ready にする。
import fs from 'node:fs';
import { mk, withPlan, ROW, PHOTO, textRe, click } from './miti.mjs';

const lanes = mk('lanes');
const THEMES = ['standard-dark', 'standard-light'];
const pageAx = { vp: ['390'], theme: THEMES, lang: ['ja', 'en'] };
const popAx = { vp: ['390'], theme: THEMES, lang: ['ja'] };
const sheetAxEn = { vp: ['390'], theme: THEMES, lang: ['ja'] };

/** 開いたシートの外枠(MobileBottomSheet の本体)を、文言つきで指す */
const sheet = (/** @type {string} */ ja, /** @type {string} */ en) => `div.fixed[class*="z-[301]"]:has-text("${ja}"), div.fixed[class*="z-[301]"]:has-text("${en}")`;
/** 下ナビのボタン(文言は日英どちらか) */
const nav = (/** @type {string} */ ja, /** @type {string} */ en) => click(`nav button:has-text("${ja}"), nav button:has-text("${en}")`);
/** 右下 FAB を開いてからメニュー項目(アイコン)を押す */
const FAB = 'div.fixed[class*="right-4"]';
const openFab = async (/** @type {import('playwright').Page} */ page) => { await page.waitForSelector(ROW); await page.click(`${FAB} > button:last-child`); };
const fabItem = (/** @type {string} */ icon) => async (/** @type {import('playwright').Page} */ page) => {
  await openFab(page);
  await page.click(`${FAB} button:has(svg.lucide-${icon})`);
};

const POP = 'div.fixed.float-surface[class*="rounded-[10px]"]';
const fireEvent = (/** @type {string} */ name) => async (/** @type {import('playwright').Page} */ page) => {
  await page.waitForSelector(ROW);
  await page.evaluate((n) => window.dispatchEvent(new Event(n)), name);
};

export default [
  // ───────── ページ ─────────
  { id: 'mobile/page-lanes', route: '/miti', storage: lanes, ready: ROW, axes: pageAx,
    covers: ['MitiPlannerPage', 'Layout', 'Timeline', 'MobileTimelineRow', 'MobileHeader', 'MobileBottomNav', 'MobileFAB', 'MobileEffectBarLayer'] },
  { id: 'mobile/page-sheet', route: '/miti', storage: mk('sheet'), ready: ROW, axes: pageAx,
    covers: ['MitiPlannerPage', 'Layout', 'Timeline', 'MobileBottomNav', 'MobileFAB'] },

  // ───────── 下ナビから開くシート ─────────
  { id: 'mobile/sheet-menu', route: '/miti', storage: lanes, ready: sheet('メニュー', 'Menu'), axes: sheetAxEn,
    open: nav('メニュー', 'Menu'), covers: ['MobileBottomSheet', 'Sidebar', 'MobileTopSheets'] },
  { id: 'mobile/sheet-party', route: '/miti', storage: lanes, ready: sheet('パーティ', 'Party'), axes: sheetAxEn,
    open: async (page) => { await page.waitForSelector(ROW); await page.evaluate(() => window.dispatchEvent(new CustomEvent('timeline:party-settings', { detail: { open: true } }))); },
    covers: ['MobileBottomSheet', 'MobilePartyWithTabs', 'MobileTopSheets'] },
  { id: 'mobile/sheet-import', route: '/miti', storage: lanes, ready: sheet('インポート', 'Import'), axes: sheetAxEn,
    open: nav('インポート', 'Import'), covers: ['MobileBottomSheet'] },
  { id: 'mobile/cue-fullscreen', route: '/miti', storage: lanes, ready: 'div.fixed.inset-0[class*="z-[9999]"]', axes: popAx,
    open: nav('カンペ', 'Cue'), covers: ['PipView', 'LayoutOverlays'] },
  { id: 'mobile/share', route: '/miti', storage: withPlan, ready: 'div[role="dialog"], [data-modal-shell]', axes: popAx,
    open: async (page) => {
      // 共有窓の OG 画像(/api/og)は見本の画像で返す(PC の miti/win-share と同じ)
      await page.route(/\/api\/og\?/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(PHOTO) }));
      await nav('共有', 'Share')(page);
    }, covers: ['MobileShareController'] },

  // ───────── タイムラインの行から開くシート・メニュー ─────────
  { id: 'mobile/sheet-mitigation-flow', route: '/miti', storage: lanes, ready: sheet('軽減を追加', 'Add Mitigation'), axes: popAx,
    open: async (page) => { await page.locator(ROW).first().click(); }, covers: ['MobileBottomSheet', 'TimelineMobileSheets', 'TimelineMobileTools'] },
  { id: 'mobile/ctx-long-press', route: '/miti', storage: lanes, ready: 'text=/イベントを編集|Edit Event/', axes: popAx,
    open: async (page) => {
      // 行を 300ms 以上押し続ける(touchstart のまま待つ)
      await page.locator(ROW).first().evaluate((el) => {
        const r = el.getBoundingClientRect();
        const t = new Touch({ identifier: 1, target: el, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 });
        el.dispatchEvent(new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(500);
    }, covers: ['MobileContextMenu'] },

  // ───────── 右下 FAB ─────────
  { id: 'mobile/fab-menu', route: '/miti', storage: lanes, ready: `${FAB} button:has(svg.lucide-globe)`, axes: popAx,
    open: openFab, covers: ['MobileFAB'] },
  { id: 'mobile/fab-language', route: '/miti', storage: lanes, ready: 'body > button.fixed:has-text("EN")', axes: popAx,
    open: fabItem('globe'), covers: ['MobileFAB'] },
  { id: 'mobile/fab-effect-mode', route: '/miti', storage: lanes, ready: 'body > button.fixed:has-text("静止")', axes: popAx,
    open: fabItem('sparkles'), covers: ['MobileFAB'] },
  { id: 'mobile/fab-party-visibility', route: '/miti', storage: lanes, ready: 'body > button.fixed[type="button"]', axes: popAx,
    open: fabItem('users'), covers: ['MobileFAB'] },

  // ───────── FAB から開くジャンプ・検索(CustomEvent。Layout の FAB が送るのと同じイベント) ─────────
  { id: 'mobile/popover-phase', route: '/miti', storage: lanes, ready: POP, axes: popAx,
    open: fireEvent('mobile:phase-jump'), covers: ['HeaderPhaseDropdown'] },
  { id: 'mobile/popover-gimmick', route: '/miti', storage: lanes, ready: POP, axes: popAx,
    open: fireEvent('mobile:label-jump'), covers: ['HeaderGimmickDropdown'] },
  { id: 'mobile/popover-search', route: '/miti', storage: lanes, ready: POP, axes: popAx,
    open: fireEvent('mobile:mechanic-search'), covers: ['HeaderMechanicSearch'] },

  // ───────── 初回ガイド(抑止キーを外して撮る。1 ステップ目だけ) ─────────
  // 初回ガイドは「空のタイムライン・プラン無し・共有チュートリアル未訪問・抑止キー無し」の時だけ 600ms 後に出る
  { id: 'mobile/guide', route: '/miti', ready: textRe('はじめかた', 'Getting Started'), axes: sheetAxEn, covers: ['MobileGuide'],
    storage: (cond) => {
      const s = /** @type {any} */ (lanes(cond));
      delete s['lopo_mobile_guide_completed'];
      s['tutorial-storage'] = { state: { hasCompleted: false, hasVisitedShare: false, isActive: false }, version: 0 };
      s['mitigation-storage'].state.timelineEvents = [];
      s['mitigation-storage'].state.timelineMitigations = [];
      return s;
    } },
];
