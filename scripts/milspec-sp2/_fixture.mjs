// @ts-check
/**
 * MIL-SPEC SP2 検証ハーネス 共有モジュール
 * ─────────────────────────────────────────────────────────────
 * standard-invariance.mjs / military-smoke.mjs / compare.mjs が共有する:
 *   - Playwright ブラウザ/コンテキスト起動 (viewport 1489x900 / DSR 1)
 *   - LoPo dev の初回オーバーレイ抑制 initScript
 *   - store 注入による決定的な fixture (プラン選択済 + 8 人 + 軽減 7 個)
 *   - console/pageerror 収集 + dev で無害なエラーの whitelist
 *
 * Task 1 時点: 製品コードは一切変更しない。scripts/milspec-sp2/ 配下のみ。
 */

import { chromium } from 'playwright';

export const BASE_URL = process.env.SP2_BASE_URL || 'http://localhost:5173';

/** 安定比較優先で deviceScaleFactor は 1 倍 (design-philosophy-sizing.md の「多数派再現」ではない)。 */
export const VIEWPORT = { width: 1489, height: 900 };

/** dev で無害な console/pageerror の部分一致 whitelist (小文字化して比較)。
 *  対象は「403 / App Check / permission-denied」の sanctioned set のみ。
 *  マスターデータ (jobs / mitigations) は別経路でロードされ 403 でも動作する。
 *  実バグ (他の error / pageerror) は絶対に握り潰さないよう、文言は具体形に限定する。 */
export const HARMLESS_CONSOLE = [
  'http 403',
  '403 (forbidden)',
  'status of 403',
  'status code 403',
  '(403)',
  'err_aborted 403',
  'app check',
  'appcheck',
  'app-check',
  'permission-denied',
  'permission_denied',
  'missing or insufficient permissions',
  'firebase installations',
  'installations/request-failed',
  'fetchingtoken', // App Check トークン取得の内部ノイズ
  'gtag/js', // analytics スクリプト URL (bare 'analytics'/'gtag' は使わない)
  'google-analytics',
  'googletagmanager',
];

/** 単独では無害と判定しない語。同一メッセージ内に文脈語が同居するときのみ無害扱い。
 *  (bare 'failed to load resource' は失敗したチャンク fetch 等の実回帰シグナルを隠すため、
 *   bare 'firebaseerror' は権限系以外の Firebase 例外を隠すため) */
export const HARMLESS_CONDITIONAL = [
  { needle: 'failed to load resource', context: ['403', 'appcheck', 'app-check', 'installations'] },
  { needle: 'firebaseerror', context: ['permission-denied', 'app-check', 'appcheck', 'installations'] },
];

/** メッセージが whitelist に載っているか (dev で無害) */
export function isHarmless(text) {
  const t = String(text || '').toLowerCase();
  if (HARMLESS_CONSOLE.some((s) => t.includes(s))) return true;
  for (const { needle, context } of HARMLESS_CONDITIONAL) {
    if (t.includes(needle) && context.some((c) => t.includes(c))) return true;
  }
  return false;
}

/**
 * console / pageerror を収集するレコーダを page に取り付ける。
 * @returns {{ fatal: string[], whitelisted: string[] }}
 */
export function attachConsoleRecorder(page) {
  const rec = { fatal: [], whitelisted: [] };
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    (isHarmless(text) ? rec.whitelisted : rec.fatal).push(`console.error: ${text}`);
  });
  page.on('pageerror', (err) => {
    const text = err && err.message ? err.message : String(err);
    (isHarmless(text) ? rec.whitelisted : rec.fatal).push(`pageerror: ${text}`);
  });
  return rec;
}

/**
 * 標準/軍事共通のブラウザ起動。theme = 'dark' | 'light'。
 * themeStyle は常に 'standard' で書き込む (= 未設定と描画上等価; 軍事は setThemeStyle で入る)。
 *
 * @param {{ theme?: 'dark'|'light', headed?: boolean, viewport?: { width: number, height?: number } }} [opts]
 *   viewport: 渡すと newContext の viewport に使う ({ width, height }・height 省略時 900)。
 *   未指定なら VIEWPORT (1489×900)。deviceScaleFactor は常に 1 固定 (比較安定優先・
 *   design-philosophy-sizing.md。多数派 DSR 再現ではない)。
 */
export async function launch({ theme = 'dark', headed = false, viewport } = {}) {
  // headed=true: 実 Chrome を GUI 起動する。::-webkit-scrollbar は headless では描画されない
  // (project_sf_military_theme 追記11) ため、compare.mjs の scrollbar ゾーンだけ true にする。
  const browser = headed
    ? await chromium.launch({ headless: false, channel: 'chrome' })
    : await chromium.launch();
  const vp = viewport
    ? { width: viewport.width, height: viewport.height ?? 900 }
    : VIEWPORT;
  const context = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: 1,
    colorScheme: theme === 'light' ? 'light' : 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.addInitScript(
    ({ theme }) => {
      try {
        // 初回チュートリアル / モバイルガイドのオーバーレイを抑制
        localStorage.setItem(
          'tutorial-storage',
          JSON.stringify({ state: { hasCompleted: true, hasVisitedShare: true, isActive: false }, version: 0 }),
        );
        localStorage.setItem('lopo_mobile_guide_completed', 'true');
        // テーマを決定的に固定 (themeStyle は standard = 描画上「未設定」と等価)
        localStorage.setItem(
          'theme-storage',
          JSON.stringify({
            state: { theme, themeStyle: 'standard', contentLanguage: 'ja', mobileEffectBarMode: 'icon' },
            version: 2,
          }),
        );
      } catch {
        /* private-mode 等 — 無視 */
      }
    },
    { theme },
  );
  return { browser, context, page };
}

/** /miti へ移動しマウントを待つ (networkidle は Firestore onSnapshot で発火しないため固定待ち)。 */
export async function gotoMiti(page) {
  await page.goto(`${BASE_URL}/miti`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3800);
}

// ─────────────────────────────────────────────────────────────
// fixture データ (決定的: Date.now / ランダム ID を一切使わない)
// ─────────────────────────────────────────────────────────────

/** タイムラインイベント 30 個 (15s 起点・18s 間隔 → 15..537s)。 */
export const EVENT_FIXTURE = Array.from({ length: 30 }, (_, i) => ({
  id: `sp2-ev${i}`,
  time: 15 + i * 18,
  name: { ja: `攻撃 ${i}`, en: `Attack ${i}`, zh: `攻击 ${i}`, ko: `공격 ${i}` },
  damageType: 'magical',
  damageAmount: 120000,
  target: 'AoE',
}));

export const PHASE_FIXTURE = [
  { id: 'sp2-ph1', name: { ja: 'フェーズ 1', en: 'Phase 1', zh: '阶段 1', ko: '페이즈 1' }, startTime: 0, endTime: 260 },
  { id: 'sp2-ph2', name: { ja: 'フェーズ 2', en: 'Phase 2', zh: '阶段 2', ko: '페이즈 2' }, startTime: 261, endTime: 560 },
];

/** メンバー → ジョブ (8 人フル。sch/ast は自動挿入が走るため意図的に外す)。 */
export const PARTY_FIXTURE = [
  ['MT', 'war'],
  ['ST', 'pld'],
  ['H1', 'sge'],
  ['H2', 'whm'],
  ['D1', 'mch'],
  ['D2', 'brd'],
  ['D3', 'sam'],
  ['D4', 'drg'],
];

/** 配置済み軽減 7 個 (self/party scope のみ・カスケードやプロンプトを誘発しない)。 */
export const MITIGATION_FIXTURE = [
  { id: 'sp2-m1', mitigationId: 'vengeance', ownerId: 'MT', time: 51, duration: 15 },
  { id: 'sp2-m2', mitigationId: 'thrill_of_battle', ownerId: 'MT', time: 195, duration: 10 },
  { id: 'sp2-m3', mitigationId: 'sentinel', ownerId: 'ST', time: 87, duration: 15 },
  { id: 'sp2-m4', mitigationId: 'holos', ownerId: 'H1', time: 123, duration: 20 },
  { id: 'sp2-m5', mitigationId: 'kerachole', ownerId: 'H1', time: 267, duration: 15 },
  { id: 'sp2-m6', mitigationId: 'tactician', ownerId: 'D1', time: 159, duration: 15 },
  { id: 'sp2-m7', mitigationId: 'troubadour', ownerId: 'D2', time: 339, duration: 15 },
];

/**
 * store 注入で fixture を組む。UI クリックより遥かに安定 (dev は /src/*.ts を素の絶対パスで配信)。
 * dynamic import が失敗したら例外を投げる (フォールバックしない = 壊れたら BLOCKED 報告)。
 *
 * @param {import('playwright').Page} page
 * @param {{ military?: boolean }} [opts]
 */
export async function applyFixture(page, { military = false } = {}) {
  const result = await page.evaluate(
    async ({ events, phases, party, mits, military }) => {
      const out = { steps: [] };
      const usePlanStore = (await import('/src/store/usePlanStore.ts')).usePlanStore;
      out.steps.push('import usePlanStore');
      const useMitigationStore = (await import('/src/store/useMitigationStore.ts')).useMitigationStore;
      out.steps.push('import useMitigationStore');
      const useThemeStore = (await import('/src/store/useThemeStore.ts')).useThemeStore;
      out.steps.push('import useThemeStore');

      useMitigationStore.setState({
        timelineEvents: events,
        phases,
        labels: [],
        currentLevel: 100,
        timelineMitigations: [],
        _history: [],
        _future: [],
      });
      for (const [memberId, jobId] of party) {
        useMitigationStore.getState().setMemberJob(memberId, jobId);
      }
      out.steps.push('party jobs set');

      // プランを選択済みに (Timeline の no-plan オーバーレイ = pointer-events:auto を外す)
      usePlanStore.setState({ currentPlanId: 'sp2-debug-plan' });
      out.steps.push('currentPlanId set');

      for (const m of mits) useMitigationStore.getState().addMitigation(m);
      out.steps.push(`mitigations added: ${useMitigationStore.getState().timelineMitigations.length}`);

      if (military) {
        useThemeStore.getState().setThemeStyle('military');
        out.steps.push('themeStyle=military');
      }

      out.events = useMitigationStore.getState().timelineEvents.length;
      out.mits = useMitigationStore.getState().timelineMitigations.length;
      out.themeStyle = useThemeStore.getState().themeStyle;
      out.htmlClass = document.documentElement.className;
      return out;
    },
    { events: EVENT_FIXTURE, phases: PHASE_FIXTURE, party: PARTY_FIXTURE, mits: MITIGATION_FIXTURE, military },
  );

  // 再レンダー + レイアウト沈静化
  await page.waitForTimeout(military ? 2200 : 1600);

  // 健全性チェック: 表が実際に描画されたか
  const dom = await page.evaluate(() => ({
    root: !!document.querySelector('[data-timeline-root]'),
    rows: document.querySelectorAll('[data-time-row]').length,
    grab: document.querySelectorAll('.timeline-scroll-container .cursor-grab').length,
    scroll: !!document.querySelector('.timeline-scroll-container'),
    noPlan: !!document.querySelector('.no-plan'),
  }));
  if (!dom.root || !dom.scroll || dom.rows < 5) {
    throw new Error(`fixture failed to render timeline: ${JSON.stringify({ ...result, dom })}`);
  }
  return { ...result, dom };
}
