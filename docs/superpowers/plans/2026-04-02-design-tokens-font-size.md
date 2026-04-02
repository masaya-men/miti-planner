# デザイントークン — フォントサイズ一元管理 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全コンポーネントのハードコードフォントサイズをCSS変数ベースのデザイントークンに移行する。見た目は一切変わらない。

**Architecture:** `:root`にCSS変数を定義し、Tailwind v4の`@theme`ブロックで`--font-size-app-*`として登録。コンポーネント側は`text-[Xpx]`や`text-sm`等を`text-app-*`に置換。

**Tech Stack:** Tailwind CSS v4, CSS Custom Properties

**設計書:** `docs/superpowers/specs/2026-04-02-design-tokens-font-size.md`

---

## 置換ルール（全タスク共通参照）

### text-[Xpx] → text-app-*

| 現在 | 変換後 |
|---|---|
| `text-[6px]` | `text-app-3xs` |
| `text-[7px]` | `text-app-2xs` |
| `text-[8px]` | `text-app-xs` |
| `text-[9px]` | `text-app-sm` |
| `text-[9.5px]` | `text-app-sm` |
| `text-[10px]` | `text-app-base` |
| `text-[11px]` | `text-app-md` |
| `text-[12px]` | `text-app-lg` |
| `text-[13px]` | `text-app-xl` |
| `text-[14px]` | `text-app-2xl` |
| `text-[18px]` | `text-app-3xl` |
| `text-[20px]` | `text-app-4xl` |
| `text-[24px]` | `text-app-4xl-plus` |
| `text-[26px]` | `text-app-5xl` |

### Tailwind標準 → text-app-*

| 現在 | 変換後 |
|---|---|
| `text-xs` | `text-app-lg` |
| `text-sm` | `text-app-2xl` |
| `text-base` | `text-app-2xl-plus` |
| `text-lg` | `text-app-3xl` |
| `text-xl` | `text-app-4xl` |
| `text-2xl` | `text-app-4xl-plus` |
| `text-4xl` | `text-app-6xl` |

### 注意事項
- `text-app-text`（色クラス）と`text-app-base`（サイズクラス）は別物。色クラスは変更しない
- `text-[var(--color-*)]` のような色指定は変更しない
- `md:text-[Xpx]` → `md:text-app-*` のようにレスポンシブプレフィックスは保持する
- `hover:text-*` の色指定は変更しない（`hover:text-app-text` は色）

---

## Task 1: 基盤 — CSS変数とTailwindトークンの定義

**Files:**
- Modify: `src/index.css:4-43` (`@theme` ブロック)
- Modify: `src/index.css:75-209` (`:root` ブロック内)

- [ ] **Step 1: `:root`にフォントサイズCSS変数を追加**

`src/index.css` の `:root, .theme-dark {` ブロック内、`font-weight: 500;` の直後（line 79付近）に追加:

```css
    /* Font size tokens */
    --font-size-3xs: 6px;
    --font-size-2xs: 7px;
    --font-size-xs: 8px;
    --font-size-sm: 9px;
    --font-size-base: 10px;
    --font-size-md: 11px;
    --font-size-lg: 12px;
    --font-size-xl: 13px;
    --font-size-2xl: 14px;
    --font-size-2xl-plus: 16px;
    --font-size-3xl: 18px;
    --font-size-4xl: 20px;
    --font-size-4xl-plus: 24px;
    --font-size-5xl: 26px;
    --font-size-6xl: 36px;
```

`.theme-light` ブロックにも同じ変数を追加（値は同一。Phase 2でテーマ別に変える余地を残す）。

- [ ] **Step 2: `@theme`ブロックにTailwind v4フォントサイズトークンを追加**

`src/index.css` の `@theme { ... }` ブロック内、`--shadow-glass` の直後に追加:

```css
  /* Font size tokens */
  --font-size-app-3xs: var(--font-size-3xs);
  --font-size-app-2xs: var(--font-size-2xs);
  --font-size-app-xs: var(--font-size-xs);
  --font-size-app-sm: var(--font-size-sm);
  --font-size-app-base: var(--font-size-base);
  --font-size-app-md: var(--font-size-md);
  --font-size-app-lg: var(--font-size-lg);
  --font-size-app-xl: var(--font-size-xl);
  --font-size-app-2xl: var(--font-size-2xl);
  --font-size-app-2xl-plus: var(--font-size-2xl-plus);
  --font-size-app-3xl: var(--font-size-3xl);
  --font-size-app-4xl: var(--font-size-4xl);
  --font-size-app-4xl-plus: var(--font-size-4xl-plus);
  --font-size-app-5xl: var(--font-size-5xl);
  --font-size-app-6xl: var(--font-size-6xl);
```

- [ ] **Step 3: bodyの@applyを更新**

`src/index.css` line 212:

```css
/* 変更前 */
@apply bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] min-h-screen text-[13px] overflow-hidden;

/* 変更後 */
@apply bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] min-h-screen text-app-xl overflow-hidden;
```

- [ ] **Step 4: font-size: 6px !importantを更新**

`src/index.css` line 226:

```css
/* 変更前 */
    font-size: 6px !important;

/* 変更後 */
    font-size: var(--font-size-3xs) !important;
```

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: エラーなし。`text-app-*` クラスがTailwindに認識されることを確認。

- [ ] **Step 6: コミット**

```bash
git add src/index.css
git commit -m "feat: フォントサイズデザイントークン基盤を追加"
```

---

## Task 2: コアUI — App, Header, Layout, Sidebar

**Files:**
- Modify: `App.tsx`
- Modify: `src/components/ConsolidatedHeader.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/ContentLanguageSwitcher.tsx`
- Modify: `src/components/ErrorBoundary.tsx`

**並列実行可能:** Task 1完了後、Task 2〜9は並列実行可能。

- [ ] **Step 1: App.tsx のインラインスタイルを移行**

```tsx
// 変更前
fontSize: '1.25rem'
// 変更後
fontSize: 'var(--font-size-4xl)'

// 変更前
fontSize: '1rem'
// 変更後
fontSize: 'var(--font-size-2xl-plus)'
```

- [ ] **Step 2: ConsolidatedHeader.tsx を移行**

置換ルール表に従い全`text-[Xpx]`と`text-sm`を置換。
`fontSize: '1.1em'` はそのまま維持（親要素依存の相対値）。

対象サイズ: `text-[26px]`→`text-app-5xl`, `text-[20px]`→`text-app-4xl`, `text-[13px]`→`text-app-xl`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-sm`→`text-app-2xl`

- [ ] **Step 3: Layout.tsx を移行**

対象: `text-[8px]`→`text-app-xs`, `text-2xl`→`text-app-4xl-plus`, `text-lg`→`text-app-3xl`, `text-sm`→`text-app-2xl`, `text-base`→`text-app-2xl-plus`

- [ ] **Step 4: Sidebar.tsx を移行**

対象: `text-[13px]`→`text-app-xl`, `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-[9.5px]`→`text-app-sm`, `text-[8px]`→`text-app-xs`, `text-[7px]`→`text-app-2xs`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 5: ContentLanguageSwitcher.tsx, ErrorBoundary.tsx を移行**

ContentLanguageSwitcher: `text-xs`→`text-app-lg`
ErrorBoundary: `text-xs`→`text-app-lg`

- [ ] **Step 6: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add App.tsx src/components/ConsolidatedHeader.tsx src/components/Layout.tsx src/components/Sidebar.tsx src/components/ContentLanguageSwitcher.tsx src/components/ErrorBoundary.tsx
git commit -m "refactor: コアUI(App/Header/Layout/Sidebar)のフォントサイズをトークン化"
```

---

## Task 3: タイムライン・表関連

**Files:**
- Modify: `src/components/Timeline.tsx`
- Modify: `src/components/TimelineRow.tsx`
- Modify: `src/components/CheatSheetView.tsx`
- Modify: `src/components/MitigationSelector.tsx`

- [ ] **Step 1: Timeline.tsx を移行**

対象: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-[8px]`→`text-app-xs`, `text-xl`→`text-app-4xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 2: TimelineRow.tsx を移行**

対象: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-[7px]`→`text-app-2xs`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 3: CheatSheetView.tsx を移行**

対象: `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-[8px]`→`text-app-xs`, `text-[7px]`→`text-app-2xs`, `text-[6px]`→`text-app-3xs`, `text-sm`→`text-app-2xl`

- [ ] **Step 4: MitigationSelector.tsx を移行**

対象: `text-[14px]`→`text-app-2xl`, `text-[10px]`→`text-app-base`, `text-[8px]`→`text-app-xs`, `text-xs`→`text-app-lg`

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/components/Timeline.tsx src/components/TimelineRow.tsx src/components/CheatSheetView.tsx src/components/MitigationSelector.tsx
git commit -m "refactor: タイムライン・表関連のフォントサイズをトークン化"
```

---

## Task 4: モーダル・ダイアログ

**Files:**
- Modify: `src/components/ConfirmDialog.tsx`
- Modify: `src/components/EventModal.tsx`
- Modify: `src/components/FFLogsImportModal.tsx`
- Modify: `src/components/JobMigrationModal.tsx`
- Modify: `src/components/LoginModal.tsx`
- Modify: `src/components/NewPlanModal.tsx`
- Modify: `src/components/PartySettingsModal.tsx`
- Modify: `src/components/PhaseModal.tsx`
- Modify: `src/components/SaveDialog.tsx`
- Modify: `src/components/ShareModal.tsx`
- Modify: `src/components/CsvImportModal.tsx`

- [ ] **Step 1: ConfirmDialog.tsx を移行**

対象: `text-[12px]`→`text-app-lg`, `text-[11px]`→`text-app-md`, `text-sm`→`text-app-2xl`

- [ ] **Step 2: EventModal.tsx を移行**

対象: `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-xl`→`text-app-4xl`, `text-lg`→`text-app-3xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 3: FFLogsImportModal.tsx を移行**

対象: `text-base`→`text-app-2xl-plus`, `text-lg`→`text-app-3xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 4: JobMigrationModal.tsx を移行**

対象: `text-[10px]`→`text-app-base`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 5: LoginModal.tsx を移行**

対象: `text-[18px]`→`text-app-3xl`, `text-[13px]`→`text-app-xl`, `text-[12px]`→`text-app-lg`, `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-sm`→`text-app-2xl`

- [ ] **Step 6: NewPlanModal.tsx を移行**

対象: `text-[13px]`→`text-app-xl`, `text-[12px]`→`text-app-lg`, `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-sm`→`text-app-2xl`

- [ ] **Step 7: PartySettingsModal.tsx を移行**

対象: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-[8px]`→`text-app-xs`, `text-sm`→`text-app-2xl`

- [ ] **Step 8: PhaseModal.tsx を移行**

対象: `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 9: SaveDialog.tsx を移行**

対象: `text-[13px]`→`text-app-xl`, `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-sm`→`text-app-2xl`

- [ ] **Step 10: ShareModal.tsx を移行**

対象: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 11: CsvImportModal.tsx（src/components/）を移行**

対象: `text-lg`→`text-app-3xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 12: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 13: コミット**

```bash
git add src/components/ConfirmDialog.tsx src/components/EventModal.tsx src/components/FFLogsImportModal.tsx src/components/JobMigrationModal.tsx src/components/LoginModal.tsx src/components/NewPlanModal.tsx src/components/PartySettingsModal.tsx src/components/PhaseModal.tsx src/components/SaveDialog.tsx src/components/ShareModal.tsx src/components/CsvImportModal.tsx
git commit -m "refactor: モーダル・ダイアログのフォントサイズをトークン化"
```

---

## Task 5: ポップオーバー・ドロップダウン

**Files:**
- Modify: `src/components/AASettingsPopover.tsx`
- Modify: `src/components/ClearMitigationsPopover.tsx`
- Modify: `src/components/HeaderMechanicSearch.tsx`
- Modify: `src/components/HeaderPhaseDropdown.tsx`
- Modify: `src/components/HeaderTimeInput.tsx`
- Modify: `src/components/PartyStatusPopover.tsx`

- [ ] **Step 1: AASettingsPopover.tsx を移行**

対象: `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 2: ClearMitigationsPopover.tsx を移行**

対象: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-sm`→`text-app-2xl`

- [ ] **Step 3: HeaderMechanicSearch.tsx を移行**

対象: `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 4: HeaderPhaseDropdown.tsx を移行**

対象: `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 5: HeaderTimeInput.tsx を移行**

対象: `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 6: PartyStatusPopover.tsx を移行**

対象: `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-xs`→`text-app-lg`

- [ ] **Step 7: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 8: コミット**

```bash
git add src/components/AASettingsPopover.tsx src/components/ClearMitigationsPopover.tsx src/components/HeaderMechanicSearch.tsx src/components/HeaderPhaseDropdown.tsx src/components/HeaderTimeInput.tsx src/components/PartyStatusPopover.tsx
git commit -m "refactor: ポップオーバー・ドロップダウンのフォントサイズをトークン化"
```

---

## Task 6: モバイル・その他UI

**Files:**
- Modify: `src/components/MobileHeader.tsx`
- Modify: `src/components/MobileBottomNav.tsx`
- Modify: `src/components/MobileBottomSheet.tsx`
- Modify: `src/components/MobileGuide.tsx`
- Modify: `src/components/MobilePartySettings.tsx`
- Modify: `src/components/JobPicker.tsx`
- Modify: `src/components/PulseSettings.tsx`
- Modify: `src/components/LoPoButton.tsx`
- Modify: `src/components/Toast.tsx`
- Modify: `src/components/ui/Tooltip.tsx`
- Modify: `src/components/ui/TransitionOverlay.tsx`

- [ ] **Step 1: MobileHeader.tsx を移行**

対象: `text-[13px]`→`text-app-xl`, `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-sm`→`text-app-2xl`

- [ ] **Step 2: MobileBottomNav.tsx を移行**

対象: `text-[9px]`→`text-app-sm`

- [ ] **Step 3: MobileBottomSheet.tsx を移行**

対象: `text-sm`→`text-app-2xl`

- [ ] **Step 4: MobileGuide.tsx を移行**

対象: `text-[13px]`→`text-app-xl`, `text-[10px]`→`text-app-base`, `text-sm`→`text-app-2xl`, `text-base`→`text-app-2xl-plus`

- [ ] **Step 5: MobilePartySettings.tsx を移行**

対象: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 6: JobPicker.tsx を移行**

対象: `text-xs`→`text-app-lg`

- [ ] **Step 7: PulseSettings.tsx を移行**

対象: `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-[8px]`→`text-app-xs`

- [ ] **Step 8: LoPoButton.tsx を移行**

対象: `text-4xl`→`text-app-6xl`, `text-2xl`→`text-app-4xl-plus`

- [ ] **Step 9: Toast.tsx を移行**

対象: `text-[12px]`→`text-app-lg`

- [ ] **Step 10: Tooltip.tsx を移行**

対象: `text-[11px]`→`text-app-md`

- [ ] **Step 11: TransitionOverlay.tsx — CSS内のfont-sizeを移行**

```css
/* 変更前 */
font-size: 11px;

/* 変更後 */
font-size: var(--font-size-md);
```

- [ ] **Step 12: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 13: コミット**

```bash
git add src/components/MobileHeader.tsx src/components/MobileBottomNav.tsx src/components/MobileBottomSheet.tsx src/components/MobileGuide.tsx src/components/MobilePartySettings.tsx src/components/JobPicker.tsx src/components/PulseSettings.tsx src/components/LoPoButton.tsx src/components/Toast.tsx src/components/ui/Tooltip.tsx src/components/ui/TransitionOverlay.tsx
git commit -m "refactor: モバイル・UI部品のフォントサイズをトークン化"
```

---

## Task 7: 公開ページ

**Files:**
- Modify: `src/components/SharePage.tsx`
- Modify: `src/components/PopularPage.tsx`
- Modify: `src/components/LegalPage.tsx`

- [ ] **Step 1: SharePage.tsx を移行**

対象: `text-lg`→`text-app-3xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 2: PopularPage.tsx を移行**

対象: `text-[8px]`→`text-app-xs`, `text-lg`→`text-app-3xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 3: LegalPage.tsx を移行**

対象: `text-[8px]`→`text-app-xs`, `text-xl`→`text-app-4xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`, `text-base`→`text-app-2xl-plus`

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/SharePage.tsx src/components/PopularPage.tsx src/components/LegalPage.tsx
git commit -m "refactor: 公開ページのフォントサイズをトークン化"
```

---

## Task 8: 管理画面

**Files:**
- Modify: `src/components/admin/AdminBackups.tsx`
- Modify: `src/components/admin/AdminConfig.tsx`
- Modify: `src/components/admin/AdminContentForm.tsx`
- Modify: `src/components/admin/AdminContents.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx`
- Modify: `src/components/admin/AdminGuard.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/components/admin/AdminLogs.tsx`
- Modify: `src/components/admin/AdminServers.tsx`
- Modify: `src/components/admin/AdminSkills.tsx`
- Modify: `src/components/admin/AdminStats.tsx`
- Modify: `src/components/admin/AdminTemplates.tsx`
- Modify: `src/components/admin/CsvImportModal.tsx`
- Modify: `src/components/admin/FflogsTranslationModal.tsx`
- Modify: `src/components/admin/PlanToTemplateModal.tsx`
- Modify: `src/components/admin/TemplateEditor.tsx`
- Modify: `src/components/admin/TemplateEditorToolbar.tsx`
- Modify: `src/components/admin/wizard/AdminWizard.tsx`
- Modify: `src/components/admin/wizard/ContentWizard.tsx`
- Modify: `src/components/admin/wizard/JobWizard.tsx`
- Modify: `src/components/admin/wizard/SkillEditWizard.tsx`
- Modify: `src/components/admin/wizard/SkillWizard.tsx`
- Modify: `src/components/admin/wizard/StatsWizard.tsx`
- Modify: `src/components/admin/wizard/TemplateWizard.tsx`

- [ ] **Step 1: Admin主要ページを移行（AdminBackups〜AdminTemplates, AdminGuard, AdminLayout）**

共通パターン: `text-[10px]`→`text-app-base`, `text-lg`→`text-app-3xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

全12ファイルに適用。

- [ ] **Step 2: Adminモーダルを移行（CsvImportModal, FflogsTranslationModal, PlanToTemplateModal）**

共通パターン: `text-[10px]`→`text-app-base`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

- [ ] **Step 3: TemplateEditor.tsx, TemplateEditorToolbar.tsx を移行**

TemplateEditor: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`
TemplateEditorToolbar: `text-xs`→`text-app-lg`

- [ ] **Step 4: Wizardを移行（6ファイル）**

共通パターン: `text-4xl`→`text-app-6xl`, `text-xl`→`text-app-4xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`

全7ファイルに適用。

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/components/admin/
git commit -m "refactor: 管理画面のフォントサイズをトークン化"
```

---

## Task 9: ランディングページ・チュートリアル

**Files:**
- Modify: `src/components/landing/CTASection.tsx`
- Modify: `src/components/landing/FeaturesSection.tsx`
- Modify: `src/components/landing/HeroSection.tsx`
- Modify: `src/components/landing/HousingSection.tsx`
- Modify: `src/components/landing/LandingFooter.tsx`
- Modify: `src/components/landing/LangToggle.tsx`
- Modify: `src/components/landing/MitiSection.tsx`
- Modify: `src/components/landing/ScrollProgress.tsx`
- Modify: `src/components/tutorial/TutorialCard.tsx`
- Modify: `src/components/tutorial/TutorialMenu.tsx`
- Modify: `src/components/tutorial/TutorialOverlay.tsx`
- Modify: `src/components/tutorial/TutorialPill.tsx`
- Modify: `src/components/tutorial/animations/CompletionCard.tsx`
- Modify: `src/components/tutorial/animations/FakeCompletionCard.tsx`
- Modify: `src/components/tutorial/animations/PartyAutoFill.tsx`
- Modify: `src/components/tutorial/animations/PillFly.tsx`

- [ ] **Step 1: ランディングページを移行（8ファイル）**

各ファイルの対象:
- CTASection: `text-base`→`text-app-2xl-plus`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`
- FeaturesSection: `text-base`→`text-app-2xl-plus`, `text-sm`→`text-app-2xl`
- HeroSection: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-lg`→`text-app-3xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`
- HousingSection: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-base`→`text-app-2xl-plus`, `text-sm`→`text-app-2xl`
- LandingFooter: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`
- LangToggle: `text-base`→`text-app-2xl-plus`
- MitiSection: `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`
- ScrollProgress: `text-[11px]`→`text-app-md`

- [ ] **Step 2: チュートリアルを移行（8ファイル）**

各ファイルの対象:
- TutorialCard: `text-[13px]`→`text-app-xl`, `text-[11px]`→`text-app-md`, `text-[10px]`→`text-app-base`, `text-[9px]`→`text-app-sm`, `text-sm`→`text-app-2xl`
- TutorialMenu: `text-[10px]`→`text-app-base`, `text-xs`→`text-app-lg`
- TutorialOverlay: `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`
- TutorialPill: `text-[10px]`→`text-app-base`
- CompletionCard: `text-lg`→`text-app-3xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`
- FakeCompletionCard: `text-[13px]`→`text-app-xl`, `text-[11px]`→`text-app-md`, `text-base`→`text-app-2xl-plus`, `text-lg`→`text-app-3xl`, `text-sm`→`text-app-2xl`, `text-xs`→`text-app-lg`
- PartyAutoFill: `text-[13px]`→`text-app-xl`
- PillFly: `text-[10px]`→`text-app-base`

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/landing/ src/components/tutorial/
git commit -m "refactor: ランディング・チュートリアルのフォントサイズをトークン化"
```

---

## Task 10: 最終検証

- [ ] **Step 1: 残存ハードコード値のチェック**

以下のパターンがsrc/配下に残っていないことを確認（`index.css`のdata-font-scaleセレクタ内は除外）:

```bash
# text-[Xpx] パターン（色指定は除外）
grep -rn 'text-\[[0-9]' src/components/ --include="*.tsx"

# Tailwind標準フォントサイズクラス
grep -rn 'text-xs\b\|text-sm\b\|text-base\b\|text-lg\b\|text-xl\b\|text-2xl\b\|text-4xl\b' src/components/ --include="*.tsx"
```

Expected: フォントサイズ関連のヒットがゼロ（色指定の`text-app-text`等は無関係）

- [ ] **Step 2: フルビルド**

Run: `npm run build`
Expected: エラーなし、警告なし

- [ ] **Step 3: 目視確認項目**

ブラウザで以下を確認（見た目が変わっていないこと）:
- メイン画面（タイムライン表示）
- サイドバー（プラン一覧）
- モーダル（イベント編集、フェーズ編集、パーティ設定）
- ポップオーバー（フェーズドロップダウン、時間入力、攻撃検索）
- モバイル表示
- ランディングページ
- 管理画面（/admin）

- [ ] **Step 4: TODO.md更新・コミット**

`docs/TODO.md` のタイポグラフィ項目を更新（Phase 1完了、Phase 2へ）。

```bash
git add docs/TODO.md
git commit -m "docs: デザイントークンPhase1完了をTODO.mdに反映"
```
