// @ts-check
// 軽減表(/miti)MIL-SPEC シェル・PC のページと、MIL-SPEC シェルから開く窓・ポップのカタログ。
// 窓の中身は標準の見た目のまま(ruling 16)なので、窓は 1489 × military-dark × ja の 1 条件。
// MIL-SPEC には data-testid が無いため、aria-label と文言(ja)で特定する。
import fs from 'node:fs';
import { mk, withPlan, ROW, SHELL, PHOTO, textRe, click } from './miti.mjs';

const lanes = mk('lanes');
const sheet = mk('sheet');
const pageAx = { vp: ['1489', '1920'], theme: ['military-dark', 'military-light'], lang: ['ja', 'en'] };
const winAx = { vp: ['1489'], theme: ['military-dark'], lang: ['ja'] };

// 時刻表示(ドラム・DTG の文字)は撮るたびに変わるので隠す。ノイズ canvas・背景動画は固定乱数と一時停止で安定する前提
const HIDE = ['.milspec-drums', '.milspec-dtg-txt'];
/** ja の aria-label でボタンを押す */
const clickAria = (/** @type {string} */ label) => click(`button[aria-label="${label}"]`);
/** サイドバー・キーの文言(<b> の中)で押す */
const clickKey = (/** @type {string} */ text) => click(`button:has(b:text-is("${text}"))`);
const POPUP = 'body > div.fixed[class*="z-[99999]"]';

// 全ページの撮影に常に写る MIL-SPEC の常設部品(昼夜の切替後の状態は別テーマのページ撮影が受け持つ)
const PERSISTENT = ['MilspecRail', 'MilspecArmor', 'MilspecVent', 'MilspecFxLayer', 'MilspecRowPrinter', 'MilspecReticle', 'MilspecSwitches', 'MilspecPlanCore', 'HeaderLogo', 'Nameplate', 'ModeLever', 'ThemeRocker', 'MilspecStyleToggle'];

export default [
  // ───────── ページ ─────────
  { id: 'milspec/page-lanes', route: '/miti', storage: lanes, ready: ROW, hide: HIDE, axes: pageAx,
    covers: [...PERSISTENT, 'MilspecLayout', 'MilspecHeaderV11', 'MilspecSidebar', 'MilspecWorkspace', 'MilspecFooter', 'MilspecContentTree', 'MilspecBackdropVideo', 'MilspecDecor', 'PartyOps', 'AuxPanel', 'MilspecCrt', 'MilspecControlDeck', 'MilspecJackBoard', 'MilspecJackRow', 'MeterPanel'] },
  { id: 'milspec/page-sheet', route: '/miti', storage: sheet, ready: ROW, hide: HIDE, axes: pageAx,
    covers: [...PERSISTENT, 'MilspecLayout', 'MilspecWorkspace', 'MilspecControlDeck', 'PartyOps'] },

  // ───────── ヘッダー(PartyOps / AuxPanel)から開く窓・ポップ ─────────
  { id: 'milspec/win-party-settings', route: '/miti', storage: lanes, ready: 'body > div.fixed.pointer-events-auto[class*="z-[10000]"]', hide: HIDE, axes: winAx,
    open: click('[data-tutorial="party-comp"]'), covers: ['PartyOps', 'PartySettingsModal'] },
  { id: 'milspec/win-party-status', route: '/miti', storage: lanes, ready: 'body > div.fixed.pointer-events-auto[class*="z-[9999]"]', hide: HIDE, axes: winAx,
    open: clickAria('ステータス設定'), covers: ['PartyOps', 'PartyStatusPopover'] },
  { id: 'milspec/menu-import', route: '/miti', storage: lanes, ready: textRe('スプレッドシートから取り込み', 'Import from spreadsheet'), hide: HIDE, axes: winAx,
    open: clickAria('取り込み'), covers: ['PartyOps', 'ImportMenu'] },
  { id: 'milspec/menu-tools', route: '/miti', storage: lanes, ready: POPUP, hide: HIDE, axes: winAx,
    open: clickAria('その他'), covers: ['PartyOps', 'HeaderToolsMenu'] },
  { id: 'milspec/menu-tutorial', route: '/miti', storage: lanes, ready: POPUP, hide: HIDE, axes: winAx,
    open: click('button:has-text("チュートリアルを見る")'), covers: ['AuxPanel', 'TutorialMenu'] },
  { id: 'milspec/menu-language', route: '/miti', storage: lanes, ready: 'body > div[class*="min-w-[130px]"]', hide: HIDE, axes: winAx,
    open: click('button:has(.milspec-sr:text-is("言語切替"))'), covers: ['AuxPanel', 'LanguageSwitcher'] },
  { id: 'milspec/win-login', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', hide: HIDE, axes: winAx,
    open: clickAria('ログイン'), covers: ['AuxPanel', 'LoginModal'] },
  { id: 'milspec/win-share', route: '/miti', storage: withPlan, ready: SHELL, clip: 'ready', hide: HIDE, axes: winAx,
    open: async (page) => {
      // 共有窓の OG 画像(/api/og)は見本の画像で返す(miti.mjs の win-share と同じ)
      await page.route(/\/api\/og\?/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(PHOTO) }));
      await page.click('[data-tutorial="share-copy-btn"]');
    }, covers: ['AuxPanel', 'ShareModal'] },

  // ───────── サイドバー(MilspecSidebar)から開く窓 ─────────
  { id: 'milspec/win-new-plan', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', hide: HIDE, axes: winAx,
    open: clickKey('新規作成'), covers: ['MilspecSidebar', 'MilspecContentTree', 'NewPlanModal'] },
  { id: 'milspec/win-local-import', route: '/miti', storage: withPlan, ready: SHELL, clip: 'ready', hide: HIDE, axes: winAx,
    open: clickKey('インポート'), covers: ['MilspecSidebar', 'LocalImportDialog'] },
  { id: 'milspec/win-backup-export', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', hide: HIDE, axes: winAx,
    open: clickKey('バックアップ'), covers: ['MilspecSidebar', 'BackupExportModal'] },
  { id: 'milspec/win-backup-restore', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', hide: HIDE, axes: winAx,
    open: clickKey('復元'), covers: ['MilspecSidebar', 'BackupRestoreModal'] },
  // まとめて共有モード: 押すと上端に選択の帯が出る(MIL-SPEC 専用)
  { id: 'milspec/sidebar-multi-share', route: '/miti', storage: withPlan, ready: '.milspec-sb-selbar', hide: HIDE, axes: winAx,
    open: clickKey('まとめて共有'), covers: ['MilspecSidebar', 'MilspecContentTree'] },
  { id: 'milspec/sidebar-multi-delete', route: '/miti', storage: withPlan, ready: '.milspec-sb-selbar[data-mode="delete"]', hide: HIDE, axes: winAx,
    open: clickKey('選択削除'), covers: ['MilspecSidebar', 'MilspecContentTree'] },
  { id: 'milspec/win-bundle-share', route: '/miti', storage: withPlan, ready: SHELL, clip: 'ready', hide: HIDE, axes: winAx,
    open: async (page) => {
      await page.route(/\/api\/og\?/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(PHOTO) }));
      // 契約の無いプランは「その他」タブに入る
      await clickKey('その他')(page);
      await clickKey('まとめて共有')(page);
      await page.click('.milspec-sb-treebody [role="checkbox"]');
      await page.click('.milspec-sb-selbar button:not([disabled]):has(b:text-is("まとめて共有"))');
    }, covers: ['MilspecSidebar', 'ShareModal'] },

  // ───────── 運営通知・フッター・ツールチップ・記録パネル ─────────
  { id: 'milspec/win-notification', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', hide: HIDE, axes: winAx,
    open: clickAria('運営からの通知'), covers: ['MilspecNotifBeacon', 'SystemNotificationModal'] },
  { id: 'milspec/footer-legal', route: '/miti', storage: lanes, ready: '.milspec-legal-pop', hide: HIDE, axes: winAx,
    open: click('.milspec-ftr button[aria-expanded]'), covers: ['MilspecFooter'] },
  { id: 'milspec/tooltip-title', route: '/miti', storage: withPlan, ready: '[data-ms-title-tip]', hide: HIDE, axes: winAx,
    open: async (page) => { await page.waitForSelector(ROW); await page.hover('[data-tutorial="share-copy-btn"]'); }, covers: ['MilspecTitleTooltip', 'AuxPanel'] },
  { id: 'milspec/panel-progress', route: '/miti', storage: withPlan, ready: 'button[aria-label="記録の詳細"]', hide: HIDE, axes: winAx,
    open: click('[data-progress-hud-band]'), covers: ['MilspecCrt', 'ProgressRecordPanel'] },
];
