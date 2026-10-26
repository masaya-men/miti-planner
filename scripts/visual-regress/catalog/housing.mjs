// @ts-check
// ハウジング(/housing/*)のページと、ログイン不要の窓のカタログ。
// 注: 表示切替(一覧/地図/タグ/ハウジンガー)は sessionStorage 保存のため、open() でボタンを押して切り替える。
import { baseStorage, housingStorage } from '../fixtures/storage.mjs';

/** housing-dark / housing-light から明るさを取り出して見本の localStorage を作る */
const mkStorage = (/** @type {string[]} */ favorites = []) => (/** @type {{ theme: string, lang: string }} */ cond) => ({
  ...baseStorage(),
  ...housingStorage({ theme: { mode: cond.theme === 'housing-light' ? 'light' : 'dark', style: 'standard' }, favorites, lang: cond.lang }),
});
const storage = mkStorage();

const ax = (/** @type {string[]} */ vp = ['1489', '390']) => ({ vp, theme: ['housing-dark', 'housing-light'], lang: ['ja', 'en'] });

/** 探す画面の表示切替ボタンを押す(PC のみ) */
const switchView = (/** @type {string} */ view) => async (/** @type {import('playwright').Page} */ page) => {
  await page.waitForSelector(`[role="tab"][data-view="${view}"]`, { state: 'visible', timeout: 15000 });
  await page.click(`[role="tab"][data-view="${view}"]`);
};

/** スマホ下ナビの n 番目(1 始まり)を押す: 1=探す 2=お気に入り 3=ツアー 4=設定 5=ログイン */
const tapBottomNav = (/** @type {number} */ n) => async (/** @type {import('playwright').Page} */ page) => {
  const sel = `.housing-bottomnav > button:nth-child(${n})`;
  await page.waitForSelector(sel, { state: 'visible', timeout: 15000 });
  await page.click(sel);
};

/** 探す画面からトレイに家を積み、クライアント遷移でツアー画面を開く(トレイはメモリだけなので store を直接叩く) */
const openTourWithTray = async (/** @type {import('playwright').Page} */ page) => {
  await page.waitForSelector('[data-testid="housing-listing-card"]', { state: 'visible', timeout: 15000 });
  await page.evaluate(async () => {
    const m = await import('/src/store/useTourTrayStore.ts');
    m.useTourTrayStore.getState().setTrayIds(['vr-l01', 'vr-l02', 'vr-l03']);
    history.pushState({}, '', '/housing/tour');
    dispatchEvent(new PopStateEvent('popstate'));
  });
};

const CARD = '[data-testid="housing-listing-card"]';

export default [
  // ───────── ページ ─────────
  { id: 'housing/browse-list', route: '/housing', storage, ready: CARD, axes: ax(), covers: ['BrowsePage', 'ListingGrid', 'ListingCard'] },
  { id: 'housing/browse-housinger', route: '/housing', storage, ready: '[data-testid="housing-browse-housinger-view"]', axes: ax(['1489']),
    open: switchView('housinger'), covers: ['BrowseHousingerView'] },
  { id: 'housing/browse-map', route: '/housing', storage, ready: '[data-testid="housing-browse-map-view"]', axes: ax(['1489']),
    open: switchView('map'), covers: ['BrowseMapView', 'MapDcMenu'] },
  // DC を選んだあとの地図(MapDcMenu を閉じ、ワールドの地図を出す)
  { id: 'housing/browse-map-dc', route: '/housing', storage, ready: '[data-testid="bmap-stage"]', axes: ax(['1489']),
    open: async (page) => { await switchView('map')(page); await page.click('[data-testid="housing-dcmenu-Elemental"]'); }, covers: ['BrowseWardMap', 'MapRail', 'MapSpotCard'] },
  { id: 'housing/favorites-empty', route: '/housing/favorites', storage, ready: '[data-testid="housing-favorites-empty"]', axes: ax(), covers: ['FavoritesPage'] },
  { id: 'housing/favorites-filled', route: '/housing/favorites', storage: mkStorage(['vr-l01', 'vr-l02', 'vr-l03', 'vr-l04']),
    ready: '[data-testid="housing-favorites-grid"]', axes: ax(), covers: ['FavoritesPage'] },
  { id: 'housing/tour-empty', route: '/housing/tour', storage, ready: 'main.housing-workspace', axes: ax(), covers: ['TourNavPage'] },
  { id: 'housing/detail', route: '/housing/listing/vr-l01', storage, ready: '.housing-detail-fullpage-main .housing-share', axes: ax(), covers: ['HousingDetailPage'] },
  { id: 'housing/tour-tray', route: '/housing', storage, ready: '.housing-tour-tray-start', axes: ax(), open: openTourWithTray, covers: ['TourNavPage', 'TourTrayList', 'TourTrayBoard'] },

  // ───────── 窓(ログイン不要) ─────────
  // clip:'ready' = 窓の枠だけを撮る(要素矩形の撮影)
  { id: 'housing/win-login-pc', route: '/housing', storage, ready: '.housing-panel-modal-shell', clip: 'ready', axes: ax(['1489']),
    open: async (page) => { await page.click('.housing-top-login-btn'); }, covers: ['HousingLoginModal'] },
  { id: 'housing/win-login-mobile', route: '/housing', storage, ready: '.housing-panel-modal-shell', clip: 'ready', axes: ax(['390']),
    open: tapBottomNav(5), covers: ['HousingLoginModal'] },
  { id: 'housing/win-filter-sheet', route: '/housing', storage, ready: '.housing-mobile-sheet', axes: ax(['390']),
    open: async (page) => { await page.click('.housing-app-header-filterbtn'); }, covers: ['HousingFilterSheet'] },
  { id: 'housing/win-settings-sheet', route: '/housing', storage, ready: '.housing-mobile-sheet', axes: ax(['390']),
    open: tapBottomNav(4), covers: ['HousingSettingsSheet'] },
  { id: 'housing/win-manner', route: '/housing', storage, ready: '.housing-manner-card', clip: 'ready', axes: ax(),
    open: async (page) => { await openTourWithTray(page); await page.click('.housing-tour-tray-start'); }, covers: ['MannerNoticeDialog'] },
  { id: 'housing/win-share-menu', route: '/housing/listing/vr-l01', storage, ready: '.housing-share-menu', axes: ax(['1489']),
    open: async (page) => { await page.click('.housing-share > button[aria-haspopup="menu"]'); }, covers: ['HousingShareButton'] },
  { id: 'housing/win-ephemeral-add', route: '/housing/tour', storage, ready: '.housing-ephemeral-panel', axes: ax(),
    open: async (page) => { await page.click('.housing-ephemeral-toggle'); }, covers: ['EphemeralAddPanel'] },
];
