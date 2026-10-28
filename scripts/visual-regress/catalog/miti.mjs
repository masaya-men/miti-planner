// @ts-check
// 軽減表(/miti)標準シェル・PC のページと、ログイン不要の窓のカタログ。
// MIL-SPEC 版(military-*)は miti-milspec.mjs、スマホは miti-mobile.mjs が受け持つ(ruling 16)。
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { baseStorage, mitiStorage } from '../fixtures/storage.mjs';

/** standard-dark / standard-light から明るさを取り出して見本の localStorage を作る */
export const mk = (/** @type {'lanes'|'sheet'} */ view, /** @type {Record<string, unknown>} */ over = {}, /** @type {Record<string, unknown>} */ extra = {}) =>
  (/** @type {{ theme: string, lang: string }} */ cond) => ({
    ...baseStorage(),
    ...mitiStorage({ view, party: 8, theme: { mode: cond.theme.endsWith('-light') ? 'light' : 'dark', style: cond.theme.startsWith('military') ? 'military' : 'standard' }, lang: cond.lang, over }),
    ...extra,
  });
const lanes = mk('lanes');

/** チュートリアルの CLICK ピル(framer-motion の repeat:Infinity。JS 駆動で止められず、撮る瞬間の位相で絵が揺れる)を隠す */
export const TUTORIAL_PILL = ['.fixed.pointer-events-none[class*="z-[10003]"]'];

/** 保存済みプランが 1 件ある状態(共有ボタン・共有窓はプラン必須) */
export const withPlan = (/** @type {{ theme: string, lang: string }} */ cond, /** @type {string | null} */ contentId = null, /** @type {Record<string, unknown>} */ planExtra = {}) => {
  const st = mk('lanes', { _loadedPlanId: 'rg-plan' })(cond);
  const d = /** @type {any} */ (st['mitigation-storage']).state;
  const data = {
    currentLevel: 100, timelineEvents: d.timelineEvents, timelineMitigations: d.timelineMitigations, phases: d.phases,
    partyMembers: d.partyMembers, aaSettings: d.aaSettings, schAetherflowPatterns: {}, hiddenPartyMemberIds: [], memos: d.memos,
  };
  return {
    ...st,
    'tutorial-storage': { state: { hasCompleted: true, hasVisitedShare: true, isActive: false, completed: { main: true, share: true } }, version: 0 },
    'plan-storage': {
      state: {
        plans: [{ id: 'rg-plan', ownerId: 'guest', ownerDisplayName: '', title: '見本プラン', contentId, ...planExtra, isPublic: false, copyCount: 0, useCount: 0, data, createdAt: 1, updatedAt: 1 }],
        currentPlanId: 'rg-plan', lastActivePlanId: 'rg-plan', _dirtyPlanIds: [], _deletedPlanIds: [],
      }, version: 2,
    },
  };
};

const THEMES = ['standard-dark', 'standard-light'];
const pageAx = { vp: ['1489', '1920'], theme: THEMES, lang: ['ja', 'en'] };
const POP = 'div.fixed.glass-tier3.rounded-lg';
const winAx = { vp: ['1489'], theme: THEMES, lang: ['ja'] };
// 時間削減(設計書 §10 の削り順 1)=窓の en 軸は外した(15 分に収まらなかったため)。戻すときは lang に 'en' を足す
const winAxEn = { vp: ['1489'], theme: THEMES, lang: ['ja'] };

export const PHOTO = fileURLToPath(new URL('../fixtures/images/photo-01.png', import.meta.url));
export const ROW = '[data-time-row]';
export const SHELL = '[data-modal-shell] [role="dialog"]';
/** 日英どちらかの文言に当たる text セレクタ(正規表現。日英の語句を | でつなぐ) */
export const textRe = (/** @type {string} */ ja, /** @type {string} */ en) => `text=/${ja}|${en}/`;
/** 行が出るまで待つだけ(自動で開く窓の撮影用) */
export const waitRows = async (/** @type {import('playwright').Page} */ page) => { await page.waitForSelector(ROW); };
/** dev の動的 import で store を取り、fn(モジュール) を実行する */
export const storeCall = (/** @type {string} */ name, /** @type {(m: any) => any} */ fn) => async (/** @type {import('playwright').Page} */ page) => {
  await page.waitForSelector(ROW);
  await page.evaluate(async ([n, src]) => {
    const m = await import(/* @vite-ignore */ `/src/store/${n}.ts`);
     
    await (0, eval)(`(${src})`)(m);
  }, [name, fn.toString()]);
};
export const click = (/** @type {string} */ sel) => async (/** @type {import('playwright').Page} */ page) => { await page.click(sel); };
/** aria-label が日英どちらかのボタンを押す */
export const clickLabel = (/** @type {string} */ ja, /** @type {string} */ en) => async (/** @type {import('playwright').Page} */ page) => {
  await page.click(`button[aria-label="${ja}"], button[aria-label="${en}"]`);
};

export default [
  // ───────── ページ ─────────
  { id: 'miti/page-lanes', route: '/miti', storage: lanes, ready: ROW, axes: pageAx,
    covers: ['MitiPlannerPage', 'Layout', 'Timeline', 'TimelineRow', 'ConsolidatedHeader', 'Sidebar'] },
  { id: 'miti/page-sheet', route: '/miti', storage: mk('sheet'), ready: ROW, axes: pageAx,
    covers: ['MitiPlannerPage', 'Layout', 'Timeline', 'ConsolidatedHeader', 'Sidebar'] },

  // ───────── 窓・ポップ(ログイン不要。clip:'ready' = 窓の枠だけ。ポップは全画面) ─────────
  { id: 'miti/win-login', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', axes: winAx,
    open: click('button:has(svg.lucide-log-in)'), covers: ['LoginModal', 'ModalShell'] },
  { id: 'miti/win-party-settings', route: '/miti', storage: lanes, ready: 'body > div.fixed.pointer-events-auto[class*="z-[10000]"]', axes: winAxEn,
    open: click('[data-tutorial="party-comp"]'), covers: ['PartySettingsModal'] },
  { id: 'miti/win-party-status', route: '/miti', storage: lanes, ready: 'body > div.fixed.pointer-events-auto[class*="z-[9999]"]', axes: winAx,
    open: click('button:has-text("ステータス設定"), button:has-text("Stat Config")'), covers: ['PartyStatusPopover'] },
  { id: 'miti/menu-import', route: '/miti', storage: lanes, ready: textRe('スプレッドシートから取り込み', 'Import from spreadsheet'), axes: winAx,
    open: clickLabel('取り込み', 'Import'), covers: ['ImportMenu'] },
  { id: 'miti/win-fflogs-import', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', axes: winAxEn,
    open: async (page) => { await clickLabel('取り込み', 'Import')(page); await page.click(textRe('FF Logs から取り込み', 'Import from FF Logs')); }, covers: ['ImportMenu'] },
  { id: 'miti/win-grid-import', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', axes: winAxEn,
    open: async (page) => { await clickLabel('取り込み', 'Import')(page); await page.click(textRe('スプレッドシートから取り込み', 'Import from spreadsheet')); }, covers: ['SpreadsheetGridImportModal'] },
  { id: 'miti/menu-tools', route: '/miti', storage: lanes, ready: 'body > div.fixed[class*="z-[99999]"]', axes: winAx,
    open: clickLabel('その他', 'More'), covers: ['HeaderToolsMenu'] },
  { id: 'miti/menu-tutorial', route: '/miti', storage: lanes, ready: 'body > div.fixed[class*="z-[99999]"]', axes: winAx,
    open: click('button:has-text("チュートリアルを見る"), button:has-text("View Tutorial")'), covers: ['TutorialMenu'] },
  { id: 'miti/menu-language', route: '/miti', storage: lanes, ready: 'body > div[class*="min-w-[130px]"]', axes: winAx,
    open: click('div[data-tutorial-always] button'), covers: ['LanguageSwitcher'] },
  { id: 'miti/win-new-plan', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', hide: TUTORIAL_PILL, axes: winAxEn,
    open: click('[data-tutorial="new-plan-btn"]'), covers: ['NewPlanModal'] },
  { id: 'miti/win-backup-export', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', axes: winAxEn,
    open: click('button:has(svg.lucide-hard-drive)'), covers: ['BackupExportModal'] },
  { id: 'miti/win-backup-restore', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', axes: winAxEn,
    open: click('.flex.gap-1 > button:has(svg.lucide-download)'), covers: ['BackupRestoreModal'] },
  { id: 'miti/win-share', route: '/miti', storage: withPlan, ready: SHELL, clip: 'ready', axes: winAx,
    open: async (page) => {
      // 共有窓の OG 画像(/api/og)は見本の画像で返す(POST /api/share は fixtures/api/share.json)
      await page.route(/\/api\/og\?/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(PHOTO) }));
      await page.click('[data-tutorial="share-copy-btn"]');
    }, covers: ['ShareModal', 'ShareButtons'] },
  { id: 'miti/win-notification', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', axes: winAx,
    open: clickLabel('運営からの通知', 'Notifications from team'), covers: ['SystemNotificationModal', 'SystemNotificationBar'] },
  { id: 'miti/win-event-add', route: '/miti', storage: lanes, ready: '[data-tutorial-modal]:not([data-tutorial])', clip: 'ready', axes: winAxEn,
    open: async (page) => {
      const row = page.locator(ROW).first();
      await row.hover();
      await row.locator('[aria-label="この時間にイベントを追加"], [aria-label="Add Event Here"]').first().dispatchEvent('click');
    }, covers: ['EventModal', 'TimelineRow', 'TimelineDialogs'] },
  { id: 'miti/popover-aa', route: '/miti', storage: lanes, ready: textRe('オートアタック設定', 'Auto-Attack Settings'), axes: winAx,
    open: click('button:has-text("AA追加"), button:has-text("Add AA")'), covers: ['AASettingsPopover'] },
  { id: 'miti/popover-clear', route: '/miti', storage: lanes, ready: textRe('全ての軽減を削除', 'Clear all mitigations'), axes: winAx,
    open: click('button:has(svg.lucide-trash-2):has(svg.lucide-chevron-down)'), covers: ['ClearMitigationsPopover'] },
  { id: 'miti/win-confirm', route: '/miti', storage: lanes, ready: textRe('メモを全削除しますか', 'Delete all notes?|Clear all notes'), axes: winAx,
    open: async (page) => { await page.click('button:has(svg.lucide-trash-2):has(svg.lucide-chevron-down)'); await page.click(textRe('メモを全削除', 'Delete all notes')); }, covers: ['ConfirmDialog', 'ClearMitigationsPopover'] },
  // ───────── 追加の窓・ポップ ─────────
  { id: 'miti/popover-phase', route: '/miti', storage: lanes, ready: POP, axes: winAx,
    open: async (page) => { await page.waitForSelector(ROW); await page.keyboard.press('p'); }, covers: ['HeaderPhaseDropdown'] },
  { id: 'miti/popover-gimmick', route: '/miti', storage: lanes, ready: POP, axes: winAx,
    open: async (page) => { await page.waitForSelector(ROW); await page.keyboard.press('l'); }, covers: ['HeaderGimmickDropdown'] },
  { id: 'miti/popover-time', route: '/miti', storage: lanes, ready: POP, axes: winAx,
    open: async (page) => { await page.waitForSelector(ROW); await page.keyboard.press('t'); }, covers: ['HeaderTimeInput'] },
  { id: 'miti/popover-search', route: '/miti', storage: lanes, ready: POP, axes: winAx,
    open: async (page) => { await page.waitForSelector(ROW); await page.keyboard.press('a'); }, covers: ['HeaderMechanicSearch'] },
  { id: 'miti/win-boundary-edit', route: '/miti', storage: lanes, ready: 'input[placeholder="M:SS"]', axes: winAxEn,
    open: async (page) => {
      // フェーズ列クリック → メニュー「フェーズを編集」 → BoundaryEditModal
      await page.locator('[data-phase-col]').first().click();
      await page.click('text=/^(フェーズを編集|Edit Phase)$/');
    }, covers: ['BoundaryEditModal'] },
  { id: 'miti/win-mitigation-selector', route: '/miti', storage: lanes, ready: '[data-tutorial-modal]:not([data-tutorial])', clip: 'ready', axes: winAx,
    open: async (page) => { await page.locator(`${ROW} [class*="group/cell"]`).nth(10).click(); }, covers: ['MitigationSelector'] },
  { id: 'miti/win-job-picker', route: '/miti', storage: lanes, ready: 'div.glass-tier3.rounded-xl', clip: 'ready', axes: winAx,
    open: click('[data-testid="job-picker-trigger"] >> nth=0'), covers: ['JobPicker', 'JobPickerRow'] },
  { id: 'miti/ctx-plan-row', route: '/miti', storage: (cond) => withPlan(cond, 'm9s'), ready: 'text=名前変更', axes: winAx,
    open: async (page) => { await page.locator('text=見本プラン').first().click({ button: 'right' }); }, covers: ['ContextMenu', 'Sidebar'] },
  { id: 'miti/toast', route: '/miti', storage: lanes, ready: 'div.fixed.bottom-24', axes: winAx,
    open: async (page) => {
      await page.waitForSelector(ROW);
      await page.evaluate(async () => { const m = await import('/src/components/toastBus.ts'); m.showToast('見本のトースト', 'success'); });
    }, covers: ['Toast'] },
  { id: 'miti/footer-legal', route: '/miti', storage: lanes, ready: 'footer a[href="/privacy"]', axes: winAx,
    open: click('footer button.underline'), covers: ['AppFooter'] },
  { id: 'miti/popover-pulse', route: '/miti', storage: lanes, ready: 'div.glass-tier3[class*="w-[240px]"]', axes: winAx,
    open: click('footer button:has-text("パルス設定"), footer button:has-text("Pulse")'), covers: ['PulseSettings', 'AppFooter'] },
  { id: 'miti/win-local-data-safety', route: '/miti', storage: withPlan, ready: SHELL, clip: 'ready', axes: winAx,
    open: async (page) => { await page.click('text=この軽減表は今この端末'); }, covers: ['LocalDataSafetyModal', 'LocalDataSafetyBar'] },

  // ───────── ストア経由・条件作りが要る窓(dev の動的 import で store を直接叩く) ─────────
  { id: 'miti/win-archive-prompt', route: '/miti', storage: (cond) => withPlan(cond, null, { category: 'savage', level: 90 }),
    ready: `${SHELL}:has-text("過去拡張の軽減表をアーカイブしました")`, clip: 'ready', axes: winAx, covers: ['ArchivePromptModal'] },
  { id: 'miti/win-local-import', route: '/miti', storage: withPlan, ready: SHELL, clip: 'ready', axes: winAx,
    open: storeCall('useLocalImportDialog', (m) => m.useLocalImportDialog.getState().open()), covers: ['LocalImportDialog'] },
  { id: 'miti/sheet-share-import', route: '/miti', storage: lanes, ready: '[data-testid="share-import-sheet"]', axes: winAx,
    open: async (page) => { await storeCall('useShareImportFlow', (m) => m.useShareImportFlow.getState().start('vrshare01'))(page); await page.waitForSelector('[data-testid="share-import-sheet"] button', { timeout: 15000 }); }, covers: ['ShareImportSheet'] },
  { id: 'miti/sheet-limit-resolution', route: '/miti', storage: withPlan, ready: '[data-testid="limit-resolution-sheet"]', axes: winAx,
    open: async (page) => {
      await storeCall('useShareImportFlow', (m) => {
        m.useShareImportFlow.setState({ status: 'limit_hit', shareId: 'vrshare01' });
        m.useShareImportFlow.getState().setLimitContext({ reason: 'max_total', contentId: null, neededCount: 1, planId: null, resolve: () => {} });
      })(page);
    }, covers: ['LimitResolutionSheet'] },
  { id: 'miti/overlay-import-progress', route: '/miti', storage: lanes, ready: '[data-testid="import-progress-overlay"]', axes: winAx,
    open: async (page) => {
      await storeCall('useShareImportFlow', (m) => m.useShareImportFlow.getState().start('vrshare01'))(page);
      await storeCall('useShareImportFlow', (m) => {
        const it = m.useShareImportFlow.getState().importItems[0];
        const planId = it.sourcePlanId ?? it.sourceShareId;
        m.useShareImportFlow.setState({ status: 'importing', progressMap: new Map([[planId, { planId, stage: 'local', status: 'in_progress' }]]) });
      })(page);
    }, covers: ['ImportProgressOverlay'] },
  { id: 'miti/win-aetherflow-chain', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', axes: winAx,
    open: storeCall('useMitigationStore', (m) => m.useMitigationStore.setState({ aetherflowChainPrompt: { memberId: 'H2', startTime: 30 } })), covers: ['AetherflowChainPromptModal'] },
  { id: 'miti/win-astrologian-chain', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', axes: winAx,
    open: storeCall('useMitigationStore', (m) => m.useMitigationStore.setState({ astrologianDrawChainPrompt: { memberId: 'H2', startTime: 30, startKind: 'astral_draw' } })), covers: ['AstrologianDrawChainPromptModal'] },
  { id: 'miti/overlay-tutorial', route: '/miti', storage: lanes, ready: 'text=/STEP 1 \/ /', hide: TUTORIAL_PILL, axes: winAx,
    open: storeCall('useTutorialStore', (m) => m.useTutorialStore.getState().startTutorial('main')), covers: ['TutorialOverlay'] },
  { id: 'miti/panel-progress', route: '/miti', storage: withPlan, ready: 'button[aria-label="記録の詳細"]', axes: winAx,
    open: async (page) => { await page.click('text=クリックして攻略の軌跡を記録'); }, covers: ['ProgressRecordPanel', 'ProgressTrackingHUD'] },
  // スプシ表示: 対象選択(味方 1 人を選ぶ)が要る列のマスを探して押すと小窓が出る
  { id: 'miti/popover-sheet-target', route: '/miti', storage: mk('sheet'), ready: '[data-sheet-popover]', axes: winAx,
    open: async (page) => {
      await page.waitForSelector(ROW);
      const cells = page.locator(`${ROW} >> nth=14 >> [data-sheet-cols]`);
      const n = await cells.count();
      for (let i = 0; i < n; i++) {
        const box = await cells.nth(i).boundingBox();
        const cols = Number(await cells.nth(i).getAttribute('data-sheet-cols')) || 1;
        if (!box) continue;
        for (let c = 0; c < cols; c++) {
          await page.mouse.click(box.x + (box.width / cols) * (c + 0.5), box.y + box.height / 2);
          if (await page.locator('[data-sheet-popover]').count()) return;
        }
      }
    }, covers: ['SheetTargetPopover'] },
  // パーティ設定で MT のジョブを変え(軽減ありの枠)、閉じると移行確認が出る
  { id: 'miti/win-job-migration', route: '/miti', storage: lanes, ready: SHELL, clip: 'ready', axes: winAx,
    open: async (page) => {
      await page.click('[data-tutorial="party-comp"]');
      await page.click('#party-slot-0');
      await page.click('[data-job-id="drk"]');
      await page.click('[data-tutorial="party-settings-close-btn"] button');
    }, covers: ['JobMigrationModal'] },
];
