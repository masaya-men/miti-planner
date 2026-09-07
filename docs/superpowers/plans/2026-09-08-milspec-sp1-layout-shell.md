# MIL-SPEC SP1 レイアウトシェル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `themeStyle === 'military'` かつ PC のとき、`/miti` をモックアップ完全再現の専用コンポーネントツリー `MilspecLayout` で描画し、既存ストア/イベントに配線して編集機能を全維持する。標準モードは `Layout` の分岐 1 か所のみで不変。

**Architecture:** `Layout.tsx` の全フックの後・標準 `return` の直前に早期 return を 1 か所追加し、軍事モード時だけ `<MilspecLayout>{children}</MilspecLayout>` を返す。実行時ホスト（自動保存・collab・データ復旧・マイグレーション・キーボードショートカット、約 400 行）は分岐より前なので両モード共通・無改造。`MilspecLayout` はモックの `.app` CSS グリッド（SP1 は 4 行）に 6 ゾーン部品（Header / Sidebar / Seam / Toolbar / Workspace / Footer）+ `MilspecChrome` を配置。ワークスペースには既存 `<Timeline>` をそのまま埋め込む（中身の作り直しは SP2）。各ゾーンは既存の再利用可能メニュー部品（`TutorialMenu` / `ImportMenu` / `HeaderToolsMenu` / `PartyVisibilityMenu` / `LanguageSwitcher` / `SegmentButton` / `SyncButton` / `MilspecStyleToggle`）と `window.dispatchEvent(new CustomEvent('timeline:*'))` と既存ストアアクションで配線する。

**Tech Stack:** React 18 + TypeScript（strict, `tsc -b`）/ Zustand（`persist`）/ Vite / Tailwind v4（`@theme` + 意味トークン）/ framer-motion / react-i18next / vitest + happy-dom + `@testing-library/react`（構造・配線テスト）/ Playwright（幾何・標準不変・コンソールエラーの headless 検証・`.cjs` スクリプト）。CSS は全て `src/styles/military.css` に集約・`.theme-military` 前置。

**Spec:** `docs/superpowers/specs/2026-09-08-milspec-structural-rebuild-sp1-shell-design.md`（commit で追跡。plan は spec から論じる — executor は両方読む）。正典デザイン = `c:/Users/masay/Desktop/FF14Sim/docs/.private/theme-refs/milspec-mockup.html`（2695 行・worktree に無いので絶対パスで渡す）。

## Global Constraints

spec §15 から逐語。全タスクの要件に暗黙で含まれる。

1. **標準モード（`themeStyle` 未設定 / `'standard'`）のレンダリング出力・挙動を分岐前の状態と完全一致させる。** 許容変更は (a) `Layout.tsx` の分岐 1 か所追加、(b) このプロジェクトが Phase 1/2 で標準コンポーネントに加えた軍事関連追加物（`data-milspec-*` 属性・ラッパー・`MilspecStyleToggle` 配線）の撤去=着手前状態への復元、のみ。それ以外は標準 return の JSX・標準コンポーネントの実装に手を入れない。
2. **既存の編集機能を壊さない。** 自動保存・collab・データ復旧・マイグレーション（`Layout` の実行時ホスト）は無改造。パーティ設定・取込・Undo/Redo・共有・リキャスト・PiP・集中モード・ヘッダー/サイドバー折りたたみが両モードで動く。
3. **みんなの軽減表シート本体**（`MitigationSheet.tsx` / `MitigationSheet.css`）は対象外・不変。
4. **正典はモックアップ。** デザインの疑問は `milspec-mockup.html` の CSS/DOM を引く。目視推定を繰り返さず元ファイルを見る。
5. すべての MIL-SPEC CSS ルールは `.theme-military` 前置（`military.css` の SP1 節に追記）。
6. `.claude/rules/css-rules.md` 遵守: `backdrop-filter: blur()` リテラル禁止 → `--tw-backdrop-blur` 変数パターン / `clip-path: path()` 禁止・`polygon()` は可 / 回転 `::before` は `%` でなく `200vmax`。
7. sizing はリポジトリ標準（`design-philosophy-sizing.md`）: 全 text px 固定（rem 不使用）・`clamp(MIN, N vw, BASE)` で max=base=1489・container max-width は `--container-max` を尊重・html font-size 16px。
8. i18n は最初から 5 言語（ja / en / zh / zh-Hant / ko）。機能ラベルの用語は変えない（「軽減表」「シナリオ」等を軍事語に置換しない）。軍事英字は装飾として重ねるだけ・翻訳対象外。
9. push は worktree から行わない（最終マージ時のみ）。push 前ゲート = `npm run build`（exit 0）+ 変更周辺 vitest。フルスイートは vmThreads ハング既知のため対象を絞る。
10. `src/components/MobileFab.tsx` は小文字 `ab` で参照（本番ビルド保護）。
11. RTK: コマンド先頭に `rtk`（`rtk git ...` / `rtk npm ...` / `rtk npx ...`）。
12. commit メッセージは日本語。末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。

## SP1 スコープ境界（spec §12）

- **やる**: グリッド + 6 ゾーン（Header / Sidebar / Seam / Toolbar / Workspace / Footer）+ MilspecChrome + PC グローバルオーバーレイ。ストア配線。折りたたみ/集中モードの機能維持。
- **やらない**: タイムライン表の中身（→ SP2）/ `MilspecControlBar`（モック `.subtoolbar` → SP2）/ スマホ軍事レイアウト（→ SP3・SP1 は 768px 未満で標準フォールバック）/ 編集モーダルの軍事化（→ SP4）/ 折りたたみ後の凝ったデザイン（SP1 後）/ 共有・FFLogs・スプシの軍事化（やらない・標準のまま）。

---

## File Structure

### 新規作成

| ファイル | 責務 |
|---|---|
| `src/components/military/MilspecLayout.tsx` | ルート。`.app` グリッド（4 行）+ 6 ゾーン配置 + `MilspecChrome` + PC グローバルオーバーレイ + `{children}` 埋め込み。軽い UI 状態のみ（フック=実行時ホストは持たない）。 |
| `src/components/military/MilspecHeader.tsx` | モック `.header`。ロゴプレート / 遭遇名プレート / 銘板・ハザード・タービン / 共有 / ツールボタン（Tutorial/Theme/Lang/Account/StyleToggle/Sync）+ ヘッダー折りたたみボタン。 |
| `src/components/military/MilspecSidebar.tsx` | モック `.sidebar`。折りたたみハンドル / SCENARIO パネル（プラン操作）/ 遭遇名 / フェーズパネル / BACKUP・RESTORE ドック / DEPLOYMENT 装飾。 |
| `src/components/military/MilspecToolbar.tsx` | モック `.toolbar`。CREW（パーティ編成/設定/ログ取込/その他）/ VIEW（みんなの軽減表/表示メンバー）/ SORT（ライト/ロール）。 |
| `src/components/military/MilspecWorkspace.tsx` | モック `.workspace`。装甲板の枠（ビス・スジ彫り・刻印）+ `.milspec-ws-screen`（沈んだスクリーン面）に `{children}` を埋め込むブリッジ。 |
| `src/components/military/MilspecSeam.tsx` | モック `.seam`。構造の溝 + 導管装飾。 |
| `src/components/military/MilspecFooter.tsx` | モック `.footer`。情報プレート（著作権・免責・法的リンク・Discord・X・PulseSettings）/ PCB ハーネス SVG / 計器（カーソル座標）。 |
| `src/components/military/svg/MilspecHarness.tsx` | フッターの PCB 配線 SVG（モック `.fp-harness` 2234-2274 のインライン SVG を React 化）。 |
| `src/components/military/__tests__/MilspecLayout.test.tsx` | Task 1 |
| `src/components/military/__tests__/MilspecHeader.test.tsx` | Task 4 |
| `src/components/military/__tests__/MilspecSidebar.test.tsx` | Task 5 |
| `src/components/military/__tests__/MilspecToolbar.test.tsx` | Task 6 |
| `src/components/military/__tests__/MilspecWorkspace.test.tsx` | Task 3 |
| `src/components/military/__tests__/MilspecFooter.test.tsx` | Task 7 |
| `.superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-standard-invariance.cjs` | Playwright: 標準 `/miti` の幾何が分岐前 baseline と一致（全タスクで再実行） |
| `.superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-military-render.cjs` | Playwright: 軍事 `/miti` が MilspecLayout + 埋め込み Timeline を描画・コンソールエラー 0・埋め込み Timeline がスクロール可 |

### 変更

| ファイル | 変更 |
|---|---|
| `src/components/Layout.tsx` | 全 `useState`/`useEffect`/`useRef` の後、既存 `return (` の直前に `themeStyle` 購読 + `if (themeStyle === 'military' && !isMobile) return <MilspecLayout .../>` を追加。標準 return の JSX は未編集。 |
| `src/styles/military.css` | 末尾に「SP1 節」を追加（`/* ========== SP1: 構造リビルド — レイアウトシェル ========== */` マーカー）。各ゾーンの意匠を追記。Task 2 で Phase 2 節（行 939 `/* Phase 2.x` マーカー 〜 EOF）を削除。 |
| `src/components/ConsolidatedHeader.tsx` / `Sidebar.tsx` / `Timeline.tsx` / `TimelineRow.tsx` / `AppFooter.tsx` / `MobileHeader.tsx` / `SyncButton.tsx` / `ConfirmDialog.tsx` / `EventModal.tsx` / `FFLogsImportModal.tsx` / `JobPickerRow.tsx` / `LoginModal.tsx` / `SpreadsheetGridImportModal.tsx` | Task 2: `data-milspec-*` 属性と Phase 1/2 で足したラッパー・軍事専用 JSX ブロック（`data-milspec-chrome` の中の `<span className="milspec-*">` 群等）を撤去。着手前（`git log` で Phase 1 開始コミット `2ed6abcd` 直前）の状態へ。 |
| `src/locales/{ja,en,zh,zh-Hant,ko}.json` | Task 9: 新規 i18n キー（軍事英字の併記が必要な箇所・§Task 9 のキー一覧）。 |

### 触らない

`src/store/*.ts`（`useThemeStore` 含む — 2 軸化は実装済み・Task 1 は購読を足すだけ）/ `Timeline*.tsx` のロジック（Task 2 の `data-milspec-*` 撤去以外）/ `MitigationSheet.*` / `MobileFab.tsx` / `/admin` `/housing` `landing` 配下 / `index.html` / `src/App.tsx`。

---

## ベースライン取得（Task 1 の前に 1 回・実装者が行う）

- [ ] **B-1: 標準 `/miti` の幾何ベースラインを保存**

dev サーバを起動（別ターミナル）: `rtk npx vite --port 5173 --strictPort`

`.superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-standard-invariance.cjs` を作成:

```js
// 標準 /miti の幾何ベースライン取得 & 比較。
// 引数なし = ベースライン保存(baseline.json)。 引数 "check" = 保存済みと比較。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASELINE = path.join(__dirname, 'baseline.json');
const SELECTORS = [
  '[data-app-shell]', 'header, [class*="glass-tier3"]',
  'aside', 'main', '.timeline-scroll-container',
];
(async () => {
  const mode = process.argv[2];
  const browser = await chromium.launch();
  const out = {};
  for (const [label, theme] of [['dark', 'dark'], ['light', 'light']]) {
    const ctx = await browser.newContext({ viewport: { width: 1489, height: 840 } });
    const page = await ctx.newPage();
    await page.addInitScript((th) => {
      try { localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: th, themeStyle: 'standard' }, version: 2 })); } catch (e) {}
    }, theme);
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
    await page.goto('http://localhost:5173/miti', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const rects = await page.evaluate((sels) => {
      const r = {};
      for (const s of sels) {
        const el = document.querySelector(s);
        r[s] = el ? (() => { const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })() : null;
      }
      r.__html_skeleton = document.querySelector('[data-app-shell]')?.outerHTML.replace(/\s+/g, ' ').slice(0, 4000) ?? null;
      return r;
    }, SELECTORS);
    out[label] = { rects, errs };
    await ctx.close();
  }
  await browser.close();
  if (mode === 'check') {
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    let ok = true;
    for (const k of Object.keys(base)) {
      if (JSON.stringify(base[k].rects) !== JSON.stringify(out[k].rects)) { ok = false; console.log(`MISMATCH ${k}`); console.log(' base:', JSON.stringify(base[k].rects)); console.log(' now :', JSON.stringify(out[k].rects)); }
      if (out[k].errs.length) { ok = false; console.log(`ERRORS ${k}:`, out[k].errs); }
    }
    console.log(ok ? 'STANDARD INVARIANCE: PASS' : 'STANDARD INVARIANCE: FAIL');
    process.exit(ok ? 0 : 1);
  } else {
    fs.writeFileSync(BASELINE, JSON.stringify(out, null, 2));
    console.log('baseline saved:', BASELINE);
  }
})();
```

Run: `rtk node .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-standard-invariance.cjs`
Expected: `baseline saved` + `baseline.json` に dark/light の rect が入る。エラー配列が空であること（空でなければ既存の不具合なので調査）。

- [ ] **B-2: baseline.json をコミットしない**（`.superpowers/` は gitignore 済。確認のみ）

---

## Task 1: 分岐 + `MilspecLayout` 骨格 + PC オーバーレイ

**Files:**
- Create: `src/components/military/MilspecLayout.tsx`
- Create: `src/components/military/__tests__/MilspecLayout.test.tsx`
- Create: `.superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-military-render.cjs`
- Modify: `src/components/Layout.tsx`（全フック後・`return (` 直前に分岐 1 か所）
- Modify: `src/styles/military.css`（末尾に SP1 節マーカー + グリッド CSS）

**Interfaces:**
- Consumes: `useThemeStore(s => s.themeStyle)` / `Layout` のローカル state（`isSidebarOpen` / `handleToggleSidebar` / `isHeaderCollapsed` / `setIsHeaderCollapsed` / `isMobile` / `theme` / `runTransition` / `setTheme` / `timelineSortOrder` / `setTimelineSortOrder` / `mobileStatusOpen` / `setMobileStatusOpen` / `localImportOpen` / `localImportPlans` / `handleLocalImport` / `handleLocalImportClose`）。
- Produces:
  ```ts
  interface MilspecLayoutProps {
    children: React.ReactNode;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    onCloseSidebar: () => void;
    isHeaderCollapsed: boolean;
    setIsHeaderCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
    theme: 'dark' | 'light';
    onToggleTheme: () => void;
    partySortOrder: 'light_party' | 'role';
    setPartySortOrder: (o: 'light_party' | 'role') => void;
    onAutoPlan: () => void;
    onImportLogs: () => void;
    statusOpen: boolean;
    setStatusOpen: (open: boolean) => void;
    localImportProps: { isOpen: boolean; plans: unknown[]; onImport: unknown; onClose: () => void };
  }
  export const MilspecLayout: React.FC<MilspecLayoutProps>;
  ```
  Task 3–8 はこの props を各ゾーンへ配る。ゾーン部品は Task 3–8 で追加するまで**プレースホルダ `<div>`**（`grid-area` だけ持つ空要素 + データ属性 `data-ms-zone="header"` 等）。

- [ ] **Step 1: 失敗するテストを書く** — `MilspecLayout.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecLayout } from '../MilspecLayout';
import { useThemeStore } from '../../../store/useThemeStore';

const baseProps = {
  isSidebarOpen: true, onToggleSidebar: vi.fn(), onCloseSidebar: vi.fn(),
  isHeaderCollapsed: false, setIsHeaderCollapsed: vi.fn(),
  theme: 'dark' as const, onToggleTheme: vi.fn(),
  partySortOrder: 'light_party' as const, setPartySortOrder: vi.fn(),
  onAutoPlan: vi.fn(), onImportLogs: vi.fn(),
  statusOpen: false, setStatusOpen: vi.fn(),
  localImportProps: { isOpen: false, plans: [], onImport: vi.fn(), onClose: vi.fn() },
};

const renderIt = () => render(
  <MemoryRouter><MilspecLayout {...baseProps}><div data-testid="child">TIMELINE</div></MilspecLayout></MemoryRouter>
);

describe('MilspecLayout', () => {
  beforeEach(() => { useThemeStore.setState({ theme: 'dark', themeStyle: 'military' }); window.innerWidth = 1489; });

  it('data-app-shell ルートと 6 ゾーン + chrome を描画する', () => {
    const { container } = renderIt();
    expect(container.querySelector('[data-app-shell]')).not.toBeNull();
    for (const z of ['header', 'sidebar', 'seam', 'toolbar', 'workspace', 'footer']) {
      expect(container.querySelector(`[data-ms-zone="${z}"]`)).not.toBeNull();
    }
    expect(container.querySelector('.milspec-console-frame')).not.toBeNull(); // MilspecChrome
  });

  it('children をワークスペースゾーンの中に埋め込む', () => {
    const { container } = renderIt();
    const ws = container.querySelector('[data-ms-zone="workspace"]')!;
    expect(ws.querySelector('[data-testid="child"]')).not.toBeNull();
  });

  it('ルートに grid + container-max 尊重のスタイルフックが付く', () => {
    const { container } = renderIt();
    const root = container.querySelector('[data-app-shell]') as HTMLElement;
    expect(root.className).toMatch(/milspec-app/); // グリッドは .milspec-app クラス経由（military.css）
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

Run: `rtk npx vitest run src/components/military/__tests__/MilspecLayout.test.tsx`
Expected: FAIL（`MilspecLayout` が存在しない）

- [ ] **Step 3: `MilspecLayout.tsx` を実装**

```tsx
import React from 'react';
import { MilspecChrome } from './MilspecChrome';
import { MilspecTunePanel } from '../dev/MilspecTunePanel';
import { RenderPendingIndicator } from '../RenderPendingIndicator';
import { AetherflowChainPromptModal } from '../AetherflowChainPromptModal';
import { AstrologianDrawChainPromptModal } from '../AstrologianDrawChainPromptModal';
import { LocalImportDialog } from '../LocalImportDialog';
import { ShareImportSheet } from '../ShareImportSheet';
import { LocalDataSafetyAutoPrompt } from '../LocalDataSafetyAutoPrompt';
import { LimitResolutionSheet } from '../LimitResolutionSheet';

export interface MilspecLayoutProps { /* ← Interfaces ブロックの通り */ }

/** themeStyle==='military' && PC のときだけ Layout が返す専用シェル。
 *  実行時ホスト(自動保存/collab/データ復旧)は Layout が分岐前に持つ。ここは見た目 + 配線のみ。 */
export const MilspecLayout: React.FC<MilspecLayoutProps> = (props) => {
  const { children, localImportProps } = props;
  return (
    <div data-app-shell className="milspec-app" data-theme-military>
      <MilspecChrome />
      {/* ゾーン: Task 3–8 で中身を実装。今はプレースホルダ。 */}
      <div data-ms-zone="header" className="milspec-zone-header" />
      <div data-ms-zone="sidebar" className="milspec-zone-sidebar" data-open={props.isSidebarOpen ? '' : undefined} />
      <div data-ms-zone="seam" className="milspec-zone-seam" />
      <div data-ms-zone="toolbar" className="milspec-zone-toolbar" />
      <div data-ms-zone="workspace" className="milspec-zone-workspace">{children}</div>
      <div data-ms-zone="footer" className="milspec-zone-footer" />

      {/* PC グローバルオーバーレイ(自己ゲート型・非アクティブ時 null)。標準 JSX からは移動しない。 */}
      <RenderPendingIndicator />
      <AetherflowChainPromptModal />
      <AstrologianDrawChainPromptModal />
      <LocalImportDialog isOpen={localImportProps.isOpen} plans={localImportProps.plans as never} onImport={localImportProps.onImport as never} onClose={localImportProps.onClose} />
      <ShareImportSheet />
      <LocalDataSafetyAutoPrompt />
      <LimitResolutionSheet />
      <MilspecTunePanel />
    </div>
  );
};
```

`military.css` 末尾に追記（グリッドは spec §4.1–4.2。SP1 は 4 行）:

```css
/* ============================================================
 * SP1: 構造リビルド — レイアウトシェル (2026-09-08)
 * 正典 = docs/.private/theme-refs/milspec-mockup.html
 * すべて .theme-military 前置 or .milspec-* クラス経由。
 * ============================================================ */

.theme-military .milspec-app {
  position: relative;
  display: grid;
  width: 100%;
  max-width: var(--container-max, 1489px);
  margin: 0 auto;
  height: 100dvh;
  overflow: hidden;
  /* mockup .app: columns 285 / 22 / 1fr。SP1 は subtoolbar 行を持たない 4 行構成。 */
  grid-template-columns:
    clamp(232px, 19.1vw, 285px)
    clamp(16px, 1.5vw, 22px)
    1fr;
  grid-template-rows:
    clamp(76px, 6vw, 90px)   /* header */
    clamp(60px, 4.8vw, 72px) /* toolbar */
    1fr                       /* workspace */
    clamp(64px, 5.5vw, 82px); /* footer */
  grid-template-areas:
    "header  header header"
    "sidebar seam   toolbar"
    "sidebar seam   workspace"
    "sidebar seam   footer";
  background: var(--ms-bg, #141b23);
  color: var(--ms-text);
  font-family: var(--ms-font-ui, system-ui, sans-serif);
}
.theme-military .milspec-zone-header    { grid-area: header;    position: relative; }
.theme-military .milspec-zone-sidebar   { grid-area: sidebar;   position: relative; overflow: hidden; }
.theme-military .milspec-zone-seam      { grid-area: seam;      position: relative; }
.theme-military .milspec-zone-toolbar   { grid-area: toolbar;   position: relative; }
.theme-military .milspec-zone-workspace { grid-area: workspace; position: relative; display: flex; flex-direction: column; min-height: 0; }
.theme-military .milspec-zone-footer    { grid-area: footer;    position: relative; }

/* サイドバー畳み: 列幅 0 へ。列は .milspec-app 側で制御(:has で). */
.theme-military .milspec-app:has(.milspec-zone-sidebar:not([data-open])) {
  grid-template-columns: 0 clamp(16px, 1.5vw, 22px) 1fr;
}
```

`Layout.tsx` の変更（全フック後・`return (` の直前）:

```tsx
// ↓ 既存の全 useState/useEffect/useRef の後、`return (` の直前に追加
const themeStyle = useThemeStore(s => s.themeStyle);

if (themeStyle === 'military' && !isMobile) {
  return (
    <MilspecLayout
      isSidebarOpen={isSidebarOpen}
      onToggleSidebar={handleToggleSidebar}
      onCloseSidebar={() => { setIsSidebarOpen(false); localStorage.setItem('lopo_sidebar_open', 'false'); }}
      isHeaderCollapsed={isHeaderCollapsed}
      setIsHeaderCollapsed={setIsHeaderCollapsed}
      theme={theme}
      onToggleTheme={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
      partySortOrder={timelineSortOrder}
      setPartySortOrder={setTimelineSortOrder}
      onAutoPlan={() => window.dispatchEvent(new CustomEvent('timeline:autoplan'))}
      onImportLogs={() => window.dispatchEvent(new CustomEvent('timeline:import'))}
      statusOpen={mobileStatusOpen}
      setStatusOpen={setMobileStatusOpen}
      localImportProps={{ isOpen: localImportOpen, plans: localImportPlans, onImport: handleLocalImport, onClose: handleLocalImportClose }}
    >
      {children}
    </MilspecLayout>
  );
}
```

`import { MilspecLayout } from './military/MilspecLayout';` を Layout.tsx の import に追加。`useThemeStore` は既に import 済（`const { theme, setTheme } = useThemeStore();` がある — セレクタ版 `themeStyle` を別行で足す）。

- [ ] **Step 4: テスト実行 → 成功を確認**

Run: `rtk npx vitest run src/components/military/__tests__/MilspecLayout.test.tsx`
Expected: PASS（3 テスト）

- [ ] **Step 5: 標準不変を再確認**

Run: `rtk node .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-standard-invariance.cjs check`（dev サーバ起動要）
Expected: `STANDARD INVARIANCE: PASS`

- [ ] **Step 6: 軍事レンダー検証スクリプトを作成 & 実行** — `pw-military-render.cjs`

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1489, height: 840 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: 'dark', themeStyle: 'military' }, version: 2 }));
      localStorage.setItem('milspec-preview', '1');
    } catch (e) {}
  });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await page.goto('http://localhost:5173/miti', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const d = await page.evaluate(() => {
    const app = document.querySelector('.milspec-app');
    const ws = document.querySelector('[data-ms-zone="workspace"]');
    const scroll = document.querySelector('.timeline-scroll-container');
    const rect = el => el ? (b => [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)])(el.getBoundingClientRect()) : null;
    return {
      appDisplay: app ? getComputedStyle(app).display : 'ABSENT',
      zones: ['header','sidebar','seam','toolbar','workspace','footer'].map(z => [z, rect(document.querySelector(`[data-ms-zone="${z}"]`))]),
      timelineInWorkspace: !!(ws && scroll && ws.contains(scroll)),
      canScroll: scroll ? scroll.scrollHeight > scroll.clientHeight : null,
    };
  });
  console.log(JSON.stringify(d, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(errs.length === 0 && d.appDisplay === 'grid' && d.timelineInWorkspace ? 0 : 1);
})();
```

Run: `rtk node .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-military-render.cjs`
Expected: exit 0 — `appDisplay: "grid"`、6 ゾーンが非 null の rect、`timelineInWorkspace: true`、`ERRORS: none`。

- [ ] **Step 7: build**

Run: `rtk npm run build`
Expected: exit 0（`tsc -b` + vite build）。

- [ ] **Step 8: commit**

```bash
rtk git add src/components/military/MilspecLayout.tsx src/components/military/__tests__/MilspecLayout.test.tsx src/components/Layout.tsx src/styles/military.css .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-military-render.cjs
rtk git commit -m "feat(milspec): SP1 Task 1 — Layout 分岐 + MilspecLayout 骨格

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

（`.superpowers/` は gitignore なので `pw-*.cjs` は add できない — スキップされる。エラーにならない。）

---

## Task 2: Phase 2 スキン撤去

**Files:**
- Modify: `src/styles/military.css`（行 `/* Phase 2.x` マーカー〜「SP1 節」マーカーの直前まで削除。SP1 節は残す）
- Modify: `src/components/ConsolidatedHeader.tsx` / `Sidebar.tsx` / `Timeline.tsx` / `TimelineRow.tsx` / `AppFooter.tsx` / `MobileHeader.tsx` / `SyncButton.tsx` / `ConfirmDialog.tsx` / `EventModal.tsx` / `FFLogsImportModal.tsx` / `JobPickerRow.tsx` / `LoginModal.tsx` / `SpreadsheetGridImportModal.tsx`

**Interfaces:**
- Consumes: なし
- Produces: なし（撤去タスク）。撤去後、`grep -rn "data-milspec-" src --include=*.tsx` = 0 hit。

- [ ] **Step 1: 撤去対象を列挙**

Run: `rtk git log --oneline --all | grep -iE "phase 1|phase 2|0\.R" | head -20` で Phase 1 開始コミットを確認（`2ed6abcd` = Task 1.1）。
Run: `rtk git show 2ed6abcd~1:src/components/ConsolidatedHeader.tsx > /tmp/ch-before.tsx`（着手前の姿を参照用に）— 各対象ファイルで同様。

各ファイルの `data-milspec-*` 属性、および Phase 1/2 で挿入された軍事専用 JSX（例: `ConsolidatedHeader.tsx` の `<div data-milspec-chrome aria-hidden="true"> ... </div>` ブロック全体、`<div data-milspec-wordmark> ... </div>`、`className="... milspec-seg"` の `milspec-seg` トークン、`Sidebar.tsx` の `data-milspec-deployment` ブロック）を、着手前コミットとの差分で特定する。

- [ ] **Step 2: 失敗する検証を書く（grep ベース）**

`.superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/check-no-phase2.sh`:

```sh
#!/bin/sh
set -e
HITS=$(grep -rn "data-milspec-" src --include='*.tsx' | wc -l)
# Phase 2 節の見出しマーカー (" * Phase 2.N — ") が残っていないか。Phase 1 コメント内の
# 「Phase 2 でゾーン別リスキン」等の言及にはマッチさせない。
CSS=$(grep -cE "^ \* Phase 2\.[0-9]" src/styles/military.css || true)
echo "data-milspec- in tsx: $HITS (expect 0)"
echo "Phase 2.N section headers in military.css: $CSS (expect 0)"
test "$HITS" -eq 0 && test "$CSS" -eq 0 && echo "PASS" || { echo "FAIL"; exit 1; }
```

> 撤去後、Phase 1.2 のコメント（`/* ガラス旧: bg-* は土台据置 (Phase 2 でゾーン別リスキン)... */` 行 314 付近）に「Phase 2」の語が残るが、これは Phase 1 の節内のコメントなので**残してよい**（上の grep は節見出し `^ \* Phase 2.N` のみを見る）。実装者は文言を `(SP1/SP2 でゾーン別に作り直し)` へ更新してもよい（任意）。

Run: `rtk sh .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/check-no-phase2.sh`
Expected: FAIL（まだ撤去前）

- [ ] **Step 3: 撤去を実施**

1. `military.css`: 行 939（`/* Phase 2.x: ゾーン別リスキン — ここに追記 */` の直前のマーカーコメント）から「SP1 節」マーカーの直前までを削除。SP1 節（Task 1 で追加）は保持。Phase 1.1〜1.4 の節（`--ms-*` パレット / 意味トークンリマップ / `.milspec-*` プリミティブ / グレイン・走査線・フォント）は保持。
2. 各 tsx: `data-milspec-*` 属性を削除。属性を持つためだけに追加されたラッパー要素（子を持たない `<span data-milspec-chrome>...</span>` の装飾ブロック等）ごと削除。着手前コミットと `git diff` して、Phase 1/2 由来の差分だけを戻す（他の変更を巻き戻さない）。
3. `ConsolidatedHeader.tsx` の `MilspecStyleToggle` の import と配線を削除（Task 4 で `MilspecHeader` に移す）。
4. `SegmentButton` の `className="milspec-seg"` → `className` prop 自体を削除（Phase 2 で足したもの。標準 SegmentButton はデフォルトスタイル）。

- [ ] **Step 4: 検証 → 成功**

Run: `rtk sh .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/check-no-phase2.sh`
Expected: `PASS`

- [ ] **Step 5: 標準不変 — 今度は「Phase 2 撤去で標準が着手前に戻った」ことを確認**

Phase 2 は standard で `display:none` だったので幾何は変わらないはず。だが `milspec-seg` 除去や wrapper 除去で DOM 骨格は変わる（標準が着手前に戻る方向）。

Run: `rtk node .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-standard-invariance.cjs check`
Expected: `STANDARD INVARIANCE: PASS`（rect 一致。`__html_skeleton` は変わり得る — rect が一致していれば可）。

万一 rect が変わったら: `data-milspec-*` を持っていた要素が標準レイアウトに寄与していた（= Phase 2 が標準を汚していた回帰）。その要素の**着手前の姿**に正確に戻す（削除しすぎない）。

- [ ] **Step 6: 既存テスト（テーマ系・ヘッダー系）**

Run: `rtk npx vitest run src/store/__tests__/useThemeStore.test.ts src/components/military/__tests__/ src/components/__tests__/ConsolidatedHeader*.test.tsx`
Expected: 全 PASS（ハングしたら 60s で kill し、対象を `useThemeStore` + `military/` だけに絞って再実行）。

- [ ] **Step 7: build**

Run: `rtk npm run build`
Expected: exit 0（未使用 import が残ると `tsc -b` が落ちる — `MilspecStyleToggle` 等の削除漏れに注意）。

- [ ] **Step 8: commit**

```bash
rtk git add -A -- src/styles/military.css 'src/components/*.tsx'
rtk git commit -m "refactor(milspec): SP1 Task 2 — Phase 2 スキン撤去 (標準を着手前状態へ復元)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `MilspecWorkspace` — 装甲板 + Timeline 埋め込みブリッジ

**Files:**
- Create: `src/components/military/MilspecWorkspace.tsx`
- Create: `src/components/military/__tests__/MilspecWorkspace.test.tsx`
- Modify: `src/components/military/MilspecLayout.tsx`（`data-ms-zone="workspace"` のプレースホルダを `<MilspecWorkspace>{children}</MilspecWorkspace>` に）
- Modify: `src/styles/military.css`（SP1 節に `.milspec-ws-*`）

**正典:** `milspec-mockup.html` — CSS `.workspace` 行 1048-1057 / `.ws-screen`（`grep -n "ws-screen" milspec-mockup.html` で CSS 位置特定）/ DOM 2123-2213。使うプリミティブ: `.milspec-bolt`（ビス）/ `.milspec-pl`（スジ彫り）/ `.milspec-chan`（外周チャンネル）/ `.milspec-sc`（極小ステンシル）/ `.milspec-screen`（沈んだスクリーン）— すべて Phase 1.3 で `military.css` に定義済み（`grep -n "milspec-bolt\|milspec-screen\|milspec-chan" src/styles/military.css`）。

**Interfaces:**
- Consumes: なし（`children` のみ）
- Produces: `export const MilspecWorkspace: React.FC<{ children: React.ReactNode }>`。内部に `<div className="milspec-ws-screen">{children}</div>` を持つ。

- [ ] **Step 1: 失敗するテスト** — `MilspecWorkspace.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecWorkspace } from '../MilspecWorkspace';

describe('MilspecWorkspace', () => {
  it('装甲板の枠 + .milspec-ws-screen に children を入れる', () => {
    const { container } = render(<MilspecWorkspace><div data-testid="tl">TL</div></MilspecWorkspace>);
    const screen = container.querySelector('.milspec-ws-screen');
    expect(screen).not.toBeNull();
    expect(screen!.querySelector('[data-testid="tl"]')).not.toBeNull();
  });
  it('四隅ビス + 刻印を持つ', () => {
    const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
    expect(container.querySelectorAll('.milspec-bolt').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector('.milspec-sc')).not.toBeNull();
  });
});
```

- [ ] **Step 2: 実行 → FAIL** — Run: `rtk npx vitest run src/components/military/__tests__/MilspecWorkspace.test.tsx`

- [ ] **Step 3: 実装**

```tsx
import React from 'react';

/** モック .workspace = 浮いた raised 大装甲板。中の .milspec-ws-screen に既存 Timeline(SP1) を埋め込む。
 *  SP2 でこの中身を MilspecTable に差し替える。 */
export const MilspecWorkspace: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="milspec-ws milspec-chan">
    <span className="milspec-bolt milspec-bolt-tl" /><span className="milspec-bolt milspec-bolt-tr" />
    <span className="milspec-bolt milspec-bolt-bl" /><span className="milspec-bolt milspec-bolt-br" />
    <span className="milspec-sc milspec-ws-code-l">WKS-07</span>
    <span className="milspec-sc milspec-ws-code-r">RAID OPERATIONS PLOT · MITIGATION ARRAY</span>
    <div className="milspec-ws-screen">{children}</div>
  </div>
);
```

`military.css` SP1 節に、モックの `.workspace` / `.ws-screen` を移植（`.theme-military .milspec-ws { ... }` 等）。**`.milspec-ws-screen` は必ず `display:flex; flex-direction:column; min-height:0; flex:1; overflow:hidden;`** — `children`（`<div className="flex flex-col h-full">...<div className="flex-1 overflow-auto ...">`）の `h-full` / `flex-1` が解決するように。padding は装甲板の枠として `.milspec-ws` に、`.milspec-ws-screen` は枠の内側に沈める。ビス・刻印の位置はモックの `left/right/top` 値をそのまま（`clamp` 不要・小要素）。

`MilspecLayout.tsx`: `import { MilspecWorkspace }` して `<div data-ms-zone="workspace" className="milspec-zone-workspace"><MilspecWorkspace>{children}</MilspecWorkspace></div>`。

- [ ] **Step 4: 実行 → PASS** — Run: `rtk npx vitest run src/components/military/__tests__/MilspecWorkspace.test.tsx`

- [ ] **Step 5: 埋め込み Timeline が実ブラウザで機能するか**

Run: `rtk node .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-military-render.cjs`
Expected: exit 0 — `canScroll` が `true`（プランをロードしていない場合は空表なので false もあり得る。その場合スクリプトに「サイドバー最初の項目をクリックしてプランをロード」を足してから再確認）。`ERRORS: none`。ワークスペースゾーンの rect が装甲板ぶん内側にパディングされていること。

- [ ] **Step 6: 標準不変** — Run: `rtk node .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-standard-invariance.cjs check` → `PASS`

- [ ] **Step 7: build** — Run: `rtk npm run build` → exit 0

- [ ] **Step 8: commit** — `feat(milspec): SP1 Task 3 — MilspecWorkspace 装甲板 + Timeline 埋め込み`

- [ ] **Step 9: masaya 実機ゲート** — dev で `themeStyle='military'` にして `/miti` を開き、装甲板の枠・ビス・刻印・スクリーン面と、その中で従来通り動く表を確認してもらう（[[feedback_no_screenshots_local_verify]]・[[reference_dev_editor_hmr_hardreload]]）。承認まで次タスクに進むが、指摘は punch-list へ。

---

## Task 4: `MilspecHeader`

**Files:**
- Create: `src/components/military/MilspecHeader.tsx`
- Create: `src/components/military/__tests__/MilspecHeader.test.tsx`
- Modify: `src/components/military/MilspecLayout.tsx` / `src/styles/military.css`（SP1 節）

**正典:** `milspec-mockup.html` DOM 1920-1979（`<header class="header chan">`）/ CSS `.header` 771- ・`.hp-logo` `.seam-diag` `.hp-title` `.hp-fill` `.hp-share` `.hp-tools` `.hud-btn`（`grep -n` で各 CSS 位置）。使うプリミティブ: `.milspec-hp` / `.milspec-nameplate` / `.milspec-hazard` / `.milspec-decal` / `.milspec-bolt` / `.milspec-pl` / `.milspec-lamp`（Phase 1.3 定義済）。

**Interfaces:**
- Consumes: `MilspecLayoutProps` から `{ theme, onToggleTheme, isHeaderCollapsed, setIsHeaderCollapsed }`。
- Produces: `export const MilspecHeader: React.FC<MilspecHeaderProps>` where `MilspecHeaderProps = Pick<MilspecLayoutProps, 'theme'|'onToggleTheme'|'isHeaderCollapsed'|'setIsHeaderCollapsed'>`。

**配線表**（各コントロール → 実装。標準の `ConsolidatedHeader.tsx` の対応行を確認して同じ機構を呼ぶ）:

| モックのパーツ | 実装 | 標準の出典 |
|---|---|---|
| `.hp-logo` "LoPo" | `<LoPoButton size="sm" onClick={() => navigate('/')} />`（`useNavigate`）。周囲に Orbitron ロゴプレート + meta 3 行（`Combat Analysis System` / `Loop Optimizer · Fire-Plan Unit` / `MDL. LP-2 / STD ISSUE`）= 装飾・固定英字 | `ConsolidatedHeader.tsx:196-200` |
| `.hp-title` 遭遇名 | `usePlanStore` の現在プラン（`plans.find(p => p.id === currentPlanId)`）の遭遇名 jp / en を**表示のみ**。インライン改名は SP1 スコープ外 | 現在プラン参照 |
| `.hp-fill` 銘板・ハザード | `.milspec-nameplate` / `.milspec-hazard` プリミティブ・装飾・固定英字（`DEFENSIVE COOLDOWN PLANNING TERMINAL` 等） | 装飾 |
| `.hp-fill` `.tb-cluster2` タービン + `#tb-switch-header` | ローカル `React.useState(false)` で回転 ON/OFF。データ非依存。CSS の `animation` を `[data-spin]` で切替。`@media (prefers-reduced-motion: reduce)` で常に停止 | 遊び |
| `.hp-share` "共有" | 既存の共有起動を呼ぶ。`ConsolidatedHeader` の `ShareButtons` / `ShareControls` コンポーネントを確認（`grep -n "Share" src/components/ConsolidatedHeader.tsx`）。**その共有起動ハンドラ or コンポーネントを再利用**。SP1 では標準テーマのモーダルが開く（Q5） | `ConsolidatedHeader` の Share クラスタ |
| `.hud-btn` Tutorial | `<TutorialMenu btnClassName={<milspec hud-btn クラス>} />` を再利用 | `ConsolidatedHeader.tsx:318` |
| `.hud-btn` Theme | `onClick={props.onToggleTheme}` | `ConsolidatedHeader.tsx:327` |
| `.hud-btn` Lang | `<LanguageSwitcher />` を再利用（`btnClassName` prop を持つか確認。無ければ既存のまま配置し CSS で寄せる） | `ConsolidatedHeader.tsx:343` |
| `.hud-btn` Account | `useAuthStore(s => s.user)` を見て、未ログイン → `React.useState` で `<LoginModal isOpen onClose>` を開く / ログイン済 → アカウントメニュー（`ConsolidatedHeader` のアバターボタンの挙動を確認して踏襲） | `ConsolidatedHeader.tsx:348, 551` |
| （追加）Style toggle | `<MilspecStyleToggle />` を配置。表示ゲートは `MilspecStyleToggle` 内部で処理済（触らない） | Task 2 で `ConsolidatedHeader` から外した分 |
| （追加）Sync | `<SyncButton />` を再利用 | `Layout.tsx:751` の使用例 |
| （追加）折りたたみ | `onClick={() => props.setIsHeaderCollapsed(v => !v)}` | `ConsolidatedHeader.tsx:499` |

- [ ] **Step 1: 失敗するテスト** — `MilspecHeader.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecHeader } from '../MilspecHeader';
import { useThemeStore } from '../../../store/useThemeStore';

beforeEach(() => { useThemeStore.setState({ theme: 'dark', themeStyle: 'military' }); localStorage.setItem('milspec-preview', '1'); });
const props = { theme: 'dark' as const, onToggleTheme: vi.fn(), isHeaderCollapsed: false, setIsHeaderCollapsed: vi.fn() };
const r = () => render(<MemoryRouter><MilspecHeader {...props} /></MemoryRouter>);

describe('MilspecHeader', () => {
  it('ロゴプレート・遭遇名域・ツールバーを描画', () => {
    const { container } = r();
    expect(container.querySelector('.milspec-hp')).not.toBeNull();
    expect(container.textContent).toMatch(/Combat Analysis System/);
  });
  it('Theme ボタンで onToggleTheme が呼ばれる', () => {
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: /theme|テーマ/i }));
    expect(props.onToggleTheme).toHaveBeenCalled();
  });
  it('折りたたみボタンで setIsHeaderCollapsed が呼ばれる', () => {
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: /collapse|折りたた/i }));
    expect(props.setIsHeaderCollapsed).toHaveBeenCalled();
  });
  it('preview ゲート ON で StyleToggle が出る', () => {
    const { container } = r();
    expect(container.querySelector('[data-milspec-style-toggle], button[aria-label*="MIL-SPEC"], button[aria-label*="標準"]')).not.toBeNull();
  });
  it('タービンスイッチはローカル state（ストアを触らない）', () => {
    const spy = vi.spyOn(useThemeStore.getState(), 'setThemeStyle');
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: /タービン|turbine|TRB/i }));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 実行 → FAIL**

- [ ] **Step 3: 実装** — モック 1920-1979 の構造を `.milspec-hp` プレートの組み合わせで再現。配線表の通り。`military.css` SP1 節に `.milspec-hdr` 以下のゾーン CSS（モック `.header` 系を移植・全 `.theme-military` 前置）。`isHeaderCollapsed === true` のとき: ルートに `data-collapsed` を付け、CSS で高さを細い帯へ（凝ったデザインは不要 — SP1）。

- [ ] **Step 4: 実行 → PASS**

- [ ] **Step 5: 配線を実ブラウザで確認** — `pw-military-render.cjs` を拡張し、ヘッダーの各ボタンを click → 期待挙動（テーマ class 切替 / モーダル出現 / イベント dispatch）を assert。または手動 headless スニペットで。Expected: 全配線動作・`ERRORS: none`。

- [ ] **Step 6: 標準不変** — `pw-standard-invariance.cjs check` → `PASS`

- [ ] **Step 7: build** → exit 0

- [ ] **Step 8: commit** — `feat(milspec): SP1 Task 4 — MilspecHeader`

- [ ] **Step 9: masaya 実機ゲート** — ヘッダーのモック再現度 + 全ボタン動作。指摘は punch-list。

---

## Task 5: `MilspecSidebar`

**Files:**
- Create: `src/components/military/MilspecSidebar.tsx`
- Create: `src/components/military/__tests__/MilspecSidebar.test.tsx`
- Modify: `MilspecLayout.tsx` / `military.css`（SP1 節）

**正典:** `milspec-mockup.html` DOM 1982-2060（`<aside class="sidebar chan">`）/ CSS `.sidebar` 1305- ・`.hp.scenario` `.s-hd` `.s-btns` `.enc-name` `.hp.phases` `.phase` `.phase-h` `.phase-tag` `.pi` `.hp.dock` `.hp.deployment`。

**標準の出典（配線を読む）:** `src/components/Sidebar.tsx`。プラン選択 = `store.setCurrentPlanId(plan.id)`（Sidebar.tsx:379,718）/ 複製 = `usePlanStore.getState().duplicatePlan(plan.id)`（:426,625）/ 削除 = `ps.deletePlan(plan.id)` + ログイン時 `ps.deleteFromFirestore(...)`（:453-455,751）/ バックアップ = `setBackupExportOpen(true)` → `<BackupExportModal>`（:810,1580）/ 復元 = `setBackupRestoreOpen(true)` → `<BackupRestoreModal>`（:811）/ 改名 = `window.dispatchEvent(new CustomEvent('sidebar:start-rename'))`（:1926）。プラン一覧・フェーズ一覧のデータ = `usePlanStore(s => ({ plans, currentPlanId }))` / `useMitigationStore` の `phases` / `timelineEvents`。

**Interfaces:**
- Consumes: `MilspecLayoutProps` から `{ isSidebarOpen, onToggleSidebar, onCloseSidebar }`。
- Produces: `export const MilspecSidebar: React.FC<Pick<MilspecLayoutProps,'isSidebarOpen'|'onToggleSidebar'|'onCloseSidebar'>>`。

**SP1 スコープ**: モックのパネル構造（SCENARIO / 遭遇名 / PHASES / DOCK / DEPLOYMENT）を再現。SCENARIO の 4 ボタン（NEW/IMPORT/TEMPLATE/DELETE）、プラン一覧（選択・複製・削除）、フェーズ/ラベル一覧の**表示 + 選択 + 追加**、BACKUP/RESTORE を配線。プラン行の右クリックコンテキストメニュー・ドラッグ並び替え・改名 UI の完全パリティは **punch-list（Task 9 後 or SP1.1）**。`.hp.deployment` は完全装飾。

- [ ] **Step 1: 失敗するテスト** — `MilspecSidebar.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MilspecSidebar } from '../MilspecSidebar';
import { usePlanStore } from '../../../store/usePlanStore';
import { useThemeStore } from '../../../store/useThemeStore';

beforeEach(() => {
  useThemeStore.setState({ themeStyle: 'military' });
  usePlanStore.setState({ plans: [
    { id: 'p1', title: 'A', contentId: null, data: {}, ownerId: 'local' },
    { id: 'p2', title: 'B', contentId: null, data: {}, ownerId: 'local' },
  ] as never, currentPlanId: 'p1' });
});
const props = { isSidebarOpen: true, onToggleSidebar: vi.fn(), onCloseSidebar: vi.fn() };

describe('MilspecSidebar', () => {
  it('SCENARIO / PHASES / DOCK / DEPLOYMENT パネルを描画', () => {
    const { container } = render(<MilspecSidebar {...props} />);
    expect(container.textContent).toMatch(/シナリオ|Scenario/);
    expect(container.textContent).toMatch(/バックアップ|Backup/);
  });
  it('プラン行クリックで setCurrentPlanId', () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'setCurrentPlanId');
    const { getByText } = render(<MilspecSidebar {...props} />);
    fireEvent.click(getByText('B'));
    expect(spy).toHaveBeenCalledWith('p2');
  });
  it('折りたたみハンドルで onToggleSidebar', () => {
    const { getByRole } = render(<MilspecSidebar {...props} />);
    fireEvent.click(getByRole('button', { name: /collapse|折りたた|‹/i }));
    expect(props.onToggleSidebar).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 実行 → FAIL**
- [ ] **Step 3: 実装** — モック 1982-2060 を `.milspec-hp.recess` パネルで再現。配線は「標準の出典」の関数をそのまま呼ぶ。`military.css` SP1 節に `.milspec-sb` 系（モック `.sidebar` を移植）。プラン一覧は `usePlanStore` から map。フェーズ一覧は `useMitigationStore` の `phases`。
- [ ] **Step 4: 実行 → PASS**
- [ ] **Step 5: 実ブラウザ配線** — headless: プラン選択・作成・複製・削除・バックアップモーダル起動・フェーズ選択が動く。`ERRORS: none`。
- [ ] **Step 6: 標準不変** → `PASS`
- [ ] **Step 7: build** → exit 0
- [ ] **Step 8: commit** — `feat(milspec): SP1 Task 5 — MilspecSidebar`
- [ ] **Step 9: masaya 実機ゲート** — サイドバーのモック再現度 + プラン/フェーズ/バックアップ操作。context-menu パリティの要否を確認 → punch-list へ。

---

## Task 6: `MilspecToolbar`（モック `.toolbar`）

**Files:**
- Create: `src/components/military/MilspecToolbar.tsx`
- Create: `src/components/military/__tests__/MilspecToolbar.test.tsx`
- Modify: `MilspecLayout.tsx` / `military.css`（SP1 節）

**正典:** `milspec-mockup.html` DOM 2063-2086（`<div class="toolbar">`）/ CSS `.toolbar` 891- ・`.tb-cluster` `.tool-btn` `.tool-spacer` `.tool-seg`。

**配線表**（標準の出典 = `ConsolidatedHeader.tsx` Layer B 365-469）:

| モック | 実装 | 出典 |
|---|---|---|
| CREW: パーティ編成 | `window.dispatchEvent(new CustomEvent('timeline:party-settings', { detail: { open: true } }))` + `useTutorialStore.getState().completeEvent('party:opened')` | `ConsolidatedHeader.tsx:373-376` |
| CREW: 設定（Config） | `props.setStatusOpen(!props.statusOpen)`（active 表示は `props.statusOpen`） | `:388-392` |
| CREW: ログ取込（Import） | `<ImportMenu onImportLogs={props.onImportLogs} readOnly={false} btnClassName={<milspec tool-btn>} />` を再利用 | `:400-411` |
| CREW: その他（More） | `<HeaderToolsMenu onAutoPlan={props.onAutoPlan} readOnly={false} btnClassName={<milspec tool-btn>} />` を再利用 | `:414-418` |
| `.tool-spacer` | 装飾テキスト 2 行（固定英字） | 装飾 |
| VIEW: みんなの軽減表（Popular） | `ConsolidatedHeader` の `isMitiSheetOpen` パターン: `React.useState` + `<MitigationSheet isOpen onClose currentContentId={currentContentId} />` を再利用（`currentContentId` の取得元を `ConsolidatedHeader` で確認） | `:435, 553-558` |
| VIEW: 表示メンバー（View） | `<PartyVisibilityMenu sortOrder={props.partySortOrder} readOnly={false} btnClassName={...} btnActiveClassName={...} />` を再利用 | `:452-457` |
| SORT: ライト / ロール | `<SegmentButton options={[{value:'light_party',label:t('ui.sort_light_party')},{value:'role',label:t('ui.sort_role')}]} value={props.partySortOrder} onChange={props.setPartySortOrder} />`（`milspec-seg` は付けない — Task 2 で除去済。SP1 の CSS は `.milspec-tb .segment-button` 等で寄せる） | `:462-469` |

**Interfaces:**
- Consumes: `Pick<MilspecLayoutProps, 'partySortOrder'|'setPartySortOrder'|'onAutoPlan'|'onImportLogs'|'statusOpen'|'setStatusOpen'>`
- Produces: `export const MilspecToolbar: React.FC<...>`

- [ ] **Step 1: 失敗するテスト** — `MilspecToolbar.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MilspecToolbar } from '../MilspecToolbar';

const props = {
  partySortOrder: 'light_party' as const, setPartySortOrder: vi.fn(),
  onAutoPlan: vi.fn(), onImportLogs: vi.fn(), statusOpen: false, setStatusOpen: vi.fn(),
};
beforeEach(() => vi.clearAllMocks());

describe('MilspecToolbar', () => {
  it('パーティ編成ボタンで timeline:party-settings を dispatch', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    const { getByRole } = render(<MilspecToolbar {...props} />);
    fireEvent.click(getByRole('button', { name: /パーティ編成|party/i }));
    expect(spy.mock.calls.some(c => (c[0] as CustomEvent).type === 'timeline:party-settings')).toBe(true);
  });
  it('設定ボタンで setStatusOpen(true)', () => {
    const { getByRole } = render(<MilspecToolbar {...props} />);
    fireEvent.click(getByRole('button', { name: /設定|config/i }));
    expect(props.setStatusOpen).toHaveBeenCalledWith(true);
  });
  it('SORT セグメントで setPartySortOrder', () => {
    const { getByText } = render(<MilspecToolbar {...props} />);
    fireEvent.click(getByText(/ロール/));
    expect(props.setPartySortOrder).toHaveBeenCalledWith('role');
  });
});
```

- [ ] **Step 2: 実行 → FAIL**
- [ ] **Step 3: 実装** — モック 2063-2086 を再現。再利用コンポーネントは `btnClassName` prop で milspec `.tool-btn` の見た目を渡す（各コンポーネントの prop 名を確認）。`military.css` SP1 節に `.milspec-tb` 系。
- [ ] **Step 4: 実行 → PASS**
- [ ] **Step 5: 実ブラウザ配線** — headless で各ボタン → 期待挙動。
- [ ] **Step 6: 標準不変** → `PASS`
- [ ] **Step 7: build** → exit 0
- [ ] **Step 8: commit** — `feat(milspec): SP1 Task 6 — MilspecToolbar`
- [ ] **Step 9: masaya 実機ゲート**

---

## Task 7: `MilspecFooter`

**Files:**
- Create: `src/components/military/MilspecFooter.tsx` / `src/components/military/svg/MilspecHarness.tsx`
- Create: `src/components/military/__tests__/MilspecFooter.test.tsx`
- Modify: `MilspecLayout.tsx` / `military.css`（SP1 節）

**正典:** `milspec-mockup.html` DOM 2216-2284+（`<footer class="footer chan">`・`.fp-info` / `.fp-harness` SVG 2234-2274 / `.fp-inst`）/ CSS `.footer` 1417-。

**標準の出典:** `src/components/AppFooter.tsx`（49 行・全体）。i18n キー = `footer.copyright` / `footer.disclaimer` / `footer.legal` / `footer.privacy_policy` / `footer.terms` / `footer.commercial` / `footer.discord` / `footer.x_official`。リンク: `/privacy` `/terms` `/commercial` / `https://discord.gg/z7uypbJSnN` / `https://x.com/lopoly_app`。`<PulseSettings />` を末尾に。法的ドロップダウンは `React.useState` + `bg-app-surface border-app-border rounded-lg` のパネル。

**Interfaces:**
- Consumes: なし
- Produces: `export const MilspecFooter: React.FC` / `export const MilspecHarness: React.FC`

**カーソル座標計器（`.fp-inst`）:** `pointermove` を `window` に登録し、`requestAnimationFrame` スロットル + 前回値と同じなら skip。`useRef` に座標を溜めて `rAF` 内で 1 回だけ `setState`。静止中は完全に更新なし。マウス追従 UI 禁止ルール（`.claude/rules/ui-design.md`）への対応 = 「高頻度 state 更新をしない」実装で満たす。`@media (prefers-reduced-motion)` 不問（アニメではない）。

- [ ] **Step 1: 失敗するテスト** — `MilspecFooter.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MilspecFooter } from '../MilspecFooter';
import { useThemeStore } from '../../../store/useThemeStore';

beforeEach(() => useThemeStore.setState({ themeStyle: 'military' }));

describe('MilspecFooter', () => {
  it('著作権・免責・法的リンク・Discord・X・PulseSettings を描画', () => {
    const { container } = render(<MilspecFooter />);
    expect(container.querySelector('a[href="/privacy"]')).toBeNull(); // ドロップダウン閉時は非表示
    expect(container.textContent).toMatch(/SQUARE ENIX/);
    expect(container.querySelector('a[href="https://x.com/lopoly_app"]')).not.toBeNull();
  });
  it('法的ボタンでドロップダウンが開く', () => {
    const { getByRole, container } = render(<MilspecFooter />);
    fireEvent.click(getByRole('button', { name: /legal|法的|規約/i }));
    expect(container.querySelector('a[href="/terms"]')).not.toBeNull();
  });
  it('PCB ハーネス SVG を描画', () => {
    const { container } = render(<MilspecFooter />);
    expect(container.querySelector('svg.milspec-harness, .milspec-fp-harness svg')).not.toBeNull();
  });
});
```

- [ ] **Step 2: 実行 → FAIL**
- [ ] **Step 3: 実装** — `AppFooter.tsx` の i18n キー・リンク・法的ドロップダウン・`PulseSettings` をそのまま使い、モック 2216-2284 の `.fp-info` / `.fp-harness` / `.fp-inst` 意匠で組む。`MilspecHarness.tsx` はモックのインライン SVG（2234-2274）を JSX 化（`stroke`/`fill` の色は `--ms-*` トークン or `currentColor` に置換可）。`military.css` SP1 節に `.milspec-fp` 系。
- [ ] **Step 4: 実行 → PASS**
- [ ] **Step 5: 実ブラウザ** — フッターが footer グリッド行に収まる・リンク動作・カーソル座標が「マウス移動時のみ」更新（headless: `mouse.move` 2 回 → 座標変化、静止 500ms → 変化なし）。
- [ ] **Step 6: 標準不変** → `PASS`
- [ ] **Step 7: build** → exit 0
- [ ] **Step 8: commit** — `feat(milspec): SP1 Task 7 — MilspecFooter + PCB ハーネス`
- [ ] **Step 9: masaya 実機ゲート**

---

## Task 8: `MilspecSeam` + `MilspecChrome` 統合 + 折りたたみ挙動

**Files:**
- Create: `src/components/military/MilspecSeam.tsx`
- Modify: `MilspecLayout.tsx`（seam ゾーンに `<MilspecSeam />`・chrome は Task 1 で配置済 — 位置確認）
- Modify: `military.css`（SP1 節: `.milspec-seam` + 折りたたみ状態の CSS）
- Modify: `src/components/military/__tests__/MilspecLayout.test.tsx`（折りたたみのテストを追加）

**正典:** `milspec-mockup.html` CSS `.seam` 254-263 / 導管（`grep -n "conduit\|\.cd-" milspec-mockup.html`）。`MilspecChrome`（既存）= 外枠コンソール。

**Interfaces:**
- Consumes: なし（`MilspecSeam` は装飾）
- Produces: `export const MilspecSeam: React.FC`

- [ ] **Step 1: 失敗するテスト** — `MilspecLayout.test.tsx` に追記

```tsx
it('サイドバー畳み時: sidebar ゾーンから data-open が外れる', () => {
  const { container, rerender } = render(
    <MemoryRouter><MilspecLayout {...baseProps} isSidebarOpen={false}><div/></MilspecLayout></MemoryRouter>
  );
  const sb = container.querySelector('[data-ms-zone="sidebar"]')!;
  expect(sb.hasAttribute('data-open')).toBe(false);
});
it('ヘッダー畳み時: header ゾーンに data-collapsed が付く', () => {
  const { container } = render(
    <MemoryRouter><MilspecLayout {...baseProps} isHeaderCollapsed><div/></MilspecLayout></MemoryRouter>
  );
  expect(container.querySelector('[data-ms-zone="header"][data-collapsed]')).not.toBeNull();
});
it('seam ゾーンに MilspecSeam が入る', () => {
  const { container } = render(<MemoryRouter><MilspecLayout {...baseProps}><div/></MilspecLayout></MemoryRouter>);
  expect(container.querySelector('[data-ms-zone="seam"] .milspec-seam')).not.toBeNull();
});
```

- [ ] **Step 2: 実行 → FAIL**
- [ ] **Step 3: 実装**
  - `MilspecSeam.tsx`: 溝 + 導管の装飾（`<div className="milspec-seam"><span className="milspec-seam-conduit" /></div>`）。
  - `MilspecLayout.tsx`: seam ゾーンに `<MilspecSeam />`。header ゾーンに `data-collapsed={isHeaderCollapsed ? '' : undefined}` を渡す（or `MilspecHeader` が受け取る — Task 4 の実装に合わせる）。
  - `military.css` SP1 節: `.milspec-app:has([data-ms-zone="header"][data-collapsed])` で header 行高を `clamp(20px, 2vw, 26px)` に。`.milspec-seam` はモック `.seam` を移植。
  - キーボードショートカット（F/S/H）は `Layout` の実行時ホスト（分岐前）で動くので**確認のみ・改造不要**。
- [ ] **Step 4: 実行 → PASS**
- [ ] **Step 5: 実ブラウザ — 折りたたみ + 集中モード**

headless: `themeStyle='military'` で `/miti` を開き、`window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))` → サイドバー列幅 0 / `key: 'h'` → ヘッダー細帯 / `key: 'f'` → 両方。戻す。Expected: 各操作で幾何が期待通り変化・戻る・`ERRORS: none`。

- [ ] **Step 6: 標準不変** → `PASS`
- [ ] **Step 7: build** → exit 0
- [ ] **Step 8: commit** — `feat(milspec): SP1 Task 8 — MilspecSeam + 折りたたみ挙動`
- [ ] **Step 9: masaya 実機ゲート** — 溝/外枠の再現度 + S/H/F の動作（畳んだ見た目の作り込みは SP1 後で可）。

---

## Task 9: サイズ詰め + i18n 5 言語 + push 前ゲート + whole-branch レビュー準備

**Files:**
- Modify: `src/styles/military.css`（SP1 節の `clamp` 係数）
- Modify: `src/locales/{ja,en,zh,zh-Hant,ko}.json`
- Create: `.superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-3viewport.cjs`

- [ ] **Step 1: 3 ビューポート検証スクリプト** — `pw-3viewport.cjs`

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  let allOk = true;
  for (const [w, h] of [[1489, 840], [1920, 1080], [2560, 1440]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      try {
        localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: 'dark', themeStyle: 'military' }, version: 2 }));
        localStorage.setItem('milspec-preview', '1');
      } catch (e) {}
    });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    await page.goto('http://localhost:5173/miti', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const d = await page.evaluate(() => ({
      bodyScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      appW: Math.round(document.querySelector('.milspec-app')?.getBoundingClientRect().width || 0),
      overlaps: (() => {
        const zs = ['header','sidebar','toolbar','workspace','footer'].map(z => document.querySelector(`[data-ms-zone="${z}"]`)?.getBoundingClientRect()).filter(Boolean);
        for (let i = 0; i < zs.length; i++) for (let j = i + 1; j < zs.length; j++) {
          const a = zs[i], b = zs[j];
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) return true;
        }
        return false;
      })(),
    }));
    const ok = !d.bodyScrollX && !d.overlaps && errs.length === 0;
    console.log(`${w}x${h}: appW=${d.appW} bodyScrollX=${d.bodyScrollX} overlaps=${d.overlaps} errs=${errs.length} => ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) { allOk = false; if (errs.length) console.log('  ', errs); }
    await ctx.close();
  }
  await browser.close();
  process.exit(allOk ? 0 : 1);
})();
```

Run: `rtk node .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-3viewport.cjs`
Expected: 3 行すべて `OK`。FAIL なら `military.css` SP1 節の `clamp` の min / vw 係数を調整（`grid-template-columns` / `grid-template-rows` / コンテナ幅）。1489 でモック比率、1920/2560 で頭打ち・中央寄せ・横スクロールなし。

- [ ] **Step 2: i18n キー追加**

`src/locales/*.json` に、SP1 で新規に必要になった i18n キー（Task 4–8 の実装で `t('milspec.xxx')` を使った箇所）を 5 言語すべてに追加。機能ラベルは既存キーを流用（`party.comp_short` / `settings.config_short` / `ui.sort` / `footer.*` 等）。**新規キーは軍事英字の併記ラベルなど装飾寄りのものだけ**のはず。各実装タスクで `grep -rn "t('milspec\." src/components/military/` して洗い出し、5 ファイルに反映。`.claude/rules/i18n.md`: ハードコーディング禁止・英語モードで崩れないこと。

Run: `node -e "['ja','en','zh','zh-Hant','ko'].forEach(l=>{const j=require('./src/locales/'+l+'.json');/* milspec キーの存在チェック */})"`（実装した具体キーで）
Expected: 全キーが 5 言語に存在。

- [ ] **Step 3: 標準不変 最終** — Run: `rtk node .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-standard-invariance.cjs check` → `STANDARD INVARIANCE: PASS`

- [ ] **Step 4: 軍事レンダー 最終** — Run: `rtk node .superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/pw-military-render.cjs` → exit 0

- [ ] **Step 5: push 前ゲート**

Run: `rtk npm run build`
Expected: exit 0（precache 表示・i18next 動的 import 警告は pre-existing・無視）

Run: `rtk npx vitest run src/components/military/ src/store/__tests__/useThemeStore.test.ts`
Expected: 全 PASS。加えて collab / bootstrap の回帰: `rtk npx vitest run src/lib/collab/__tests__/collabLifecycle.test.ts src/lib/__tests__/bootstrapMitigation.test.ts`（存在すれば）→ PASS。ハングは 90s で kill し、ハングしたファイルを記録（vmThreads 既知）。

- [ ] **Step 6: i18n / locale コミット + 仕上げコミット**

```bash
rtk git add src/styles/military.css src/locales/
rtk git commit -m "feat(milspec): SP1 Task 9 — サイズ詰め + i18n 5 言語 + push 前ゲート

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: whole-branch レビューの準備**

SP1 の全コミット範囲（Task 1 の BASE 〜 HEAD）を `git diff` で確認。punch-list（各タスクの masaya 指摘・context-menu パリティ・畳んだ見た目・タービン細部）を `.superpowers/sdd/2026-09-08-milspec-sp1-layout-shell/punch-list.md` に集約。subagent-driven-development の最終 whole-branch レビューへ。

- [ ] **Step 8: masaya 最終実機確認** — 1489 / 1920（可能なら）で `/miti` 軍事モードを開き、モック再現度・全編集機能・標準モードとの切替を確認。SP1 完了判定は masaya。

---

## Self-Review

**1. Spec coverage:**

| spec セクション | 対応タスク |
|---|---|
| §3.2 分岐方式 | Task 1 |
| §3.3 MilspecLayout 責務 | Task 1 |
| §4 グリッド（4 行・SP1） | Task 1（骨格）+ Task 9（係数詰め） |
| §5.1 MilspecHeader | Task 4 |
| §5.2 MilspecSidebar | Task 5 |
| §5.3 MilspecSeam | Task 8 |
| §5.4 MilspecToolbar | Task 6 |
| §5.5 MilspecControlBar | **SP2**（本プラン対象外・spec §5.5 で明記） |
| §5.6 MilspecWorkspace + 埋め込みブリッジ | Task 3 |
| §5.7 MilspecFooter | Task 7 |
| §5.8 MilspecChrome 統合 | Task 1（マウント）+ Task 8（seam との分担） |
| §6 折りたたみ・集中モード | Task 8 |
| §7 サイズ・レスポンシブ | Task 1 + Task 9 |
| §8 モックに無いポップアップ（標準テーマ） | Task 1（PC オーバーレイ自前マウント）。共有/FFLogs/スプシは既存トリガをそのまま（Task 4/6） |
| §9 Phase 2 スキン撤去 | Task 2 |
| §10 標準不変の検証 | 全タスクの Step 5–6（`pw-standard-invariance.cjs`）+ Task 9 Step 5 |
| §11 ファイル構成 | File Structure セクション |
| §15 Global Constraints | Global Constraints セクション（逐語） |

ギャップなし。`MilspecControlBar` は spec 側で SP2 へ移動済み。

**2. Placeholder scan:** CSS の詳細値は「モックの行 X-Y を移植」= 正典参照（プレースホルダではない・Global Constraint 4）。テストコードは全て具体。再利用コンポーネントの `btnClassName` prop 名は「実装時に確認」= 既存コードの grep で確定できる既知の不確実性。「TBD / 後で」は無し。

**3. Type consistency:** `MilspecLayoutProps` を Task 1 で定義 → Task 3–8 は `Pick<MilspecLayoutProps, ...>` で参照。`data-ms-zone` の値（`header`/`sidebar`/`seam`/`toolbar`/`workspace`/`footer`）は Task 1・3・8 で一致。`.milspec-app` / `.milspec-zone-*` / `.milspec-ws-screen` のクラス名は Task 1・3 で一致。カスタムイベント名（`timeline:party-settings` / `timeline:autoplan` / `timeline:import`）は実コード（`Timeline.tsx` の `addEventListener`）と一致確認済み。ストアメソッド（`setCurrentPlanId` / `duplicatePlan` / `deletePlan` / `setHideEmptyRows` / `undo` / `redo` / `clearAllMitigations`）は `usePlanStore` / `useMitigationStore` で確認済み。
