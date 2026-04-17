# デザイントークン — フォントサイズ一元管理 設計書

## 概要

全コンポーネントに散在するハードコードのフォントサイズ値をCSS変数（デザイントークン）に集約し、Tailwindカスタムクラスとして利用できるようにする。

**Phase 1（本設計書）**: 既存の値をそのままCSS変数化。見た目は1pxも変わらない。
**Phase 2（別設計書）**: トークンの値を調整してタイポグラフィを刷新。

## 動機

- フォントサイズが85ファイル・約420箇所にハードコードされており、一括変更が困難
- 前回のタイポグラフィ刷新（647baf1）で全ファイルを直接変更し、リスクが大きくリバートした
- CSS変数に集約すれば、将来の調整は1箇所の値変更で全体に反映される

## 方針

### アプローチ: CSS変数 + Tailwind拡張

色トークン（`--color-app-bg` → `bg-app-bg`）と同じパターンを踏襲する。

```
index.css:  --font-size-xs: 9px;
tailwind.config.js:  fontSize: { 'app-xs': 'var(--font-size-xs)' }
コンポーネント:  text-[9px] → text-app-xs
```

### 除外しないもの

前回の設計書では一部要素を除外していたが、今回は**全要素をトークン管理下に置く**。値を変えるかどうかはPhase 2で判断する。

---

## トークン定義

### サイズスケール

現在コードベースで使用されている全フォントサイズ値をトークン化する。

| CSS変数 | 初期値 | Tailwindクラス | 現在の主な用途 |
|---|---|---|---|
| `--font-size-3xs` | 6px | `text-app-3xs` | CheatSheet最小テキスト |
| `--font-size-2xs` | 7px | `text-app-2xs` | CheatSheet・Sidebar・TimelineRow小文字 |
| `--font-size-xs` | 8px | `text-app-xs` | バージョン情報、PulseSettings、PartySettings小 |
| `--font-size-sm` | 9px | `text-app-sm` | タグ、ナビラベル、メタ情報（20ファイル） |
| `--font-size-base` | 10px | `text-app-base` | サイドバーラベル、Admin主流サイズ（31ファイル、最多） |
| `--font-size-md` | 11px | `text-app-md` | 説明文、ラベル、ツールチップ（20ファイル） |
| `--font-size-lg` | 12px | `text-app-lg` | ConfirmDialog、NewPlanModal、Toast |
| `--font-size-xl` | 13px | `text-app-xl` | ボタン、入力、リスト項目（12ファイル） |
| `--font-size-2xl` | 14px | `text-app-2xl` | MitigationSelector |
| `--font-size-3xl` | 18px | `text-app-3xl` | LoginModalタイトル |
| `--font-size-4xl` | 20px | `text-app-4xl` | ConsolidatedHeader（日本語タイトル） |
| `--font-size-5xl` | 26px | `text-app-5xl` | ConsolidatedHeader（英語タイトル） |

### Tailwind標準クラスの扱い

Tailwind標準クラス（`text-xs`=12px, `text-sm`=14px, `text-base`=16px, `text-lg`=18px, `text-xl`=20px, `text-2xl`=24px, `text-4xl`=36px）もトークンに移行する。

| 現在のクラス | 実サイズ | 移行先トークン | 備考 |
|---|---|---|---|
| `text-xs` (12px) | 12px | `text-app-lg` | 同じ12px |
| `text-sm` (14px) | 14px | `text-app-2xl` | 同じ14px |
| `text-base` (16px) | 16px | 新設 `--font-size-2xl-plus` / `text-app-2xl-plus` | |
| `text-lg` (18px) | 18px | `text-app-3xl` | 同じ18px |
| `text-xl` (20px) | 20px | `text-app-4xl` | 同じ20px |
| `text-2xl` (24px) | 24px | 新設 `--font-size-4xl-plus` / `text-app-4xl-plus` | |
| `text-4xl` (36px) | 36px | 新設 `--font-size-6xl` / `text-app-6xl` | Admin Wizard用 |

**→ 最終的なトークン数: 15個**

追加分:

| CSS変数 | 初期値 | Tailwindクラス | 用途 |
|---|---|---|---|
| `--font-size-2xl-plus` | 16px | `text-app-2xl-plus` | 旧text-base |
| `--font-size-4xl-plus` | 24px | `text-app-4xl-plus` | 旧text-2xl |
| `--font-size-6xl` | 36px | `text-app-6xl` | Admin Wizard見出し |

### インラインスタイルの扱い

| ファイル | 現在の値 | 移行方法 |
|---|---|---|
| App.tsx | `fontSize: '1.25rem'` (20px) | `fontSize: 'var(--font-size-4xl)'` |
| App.tsx | `fontSize: '1rem'` (16px) | `fontSize: 'var(--font-size-2xl-plus)'` |
| ConsolidatedHeader.tsx | `fontSize: '1.1em'` (相対) | そのまま維持（親要素依存の相対値） |

### CSS直接指定の扱い

| ファイル | 現在の値 | 移行方法 |
|---|---|---|
| index.css | `font-size: 6px !important` | `font-size: var(--font-size-3xs) !important` |
| TransitionOverlay.tsx | `font-size: 11px` (.t-label) | `font-size: var(--font-size-md)` |

---

## 実装場所

### index.css

`:root` ブロックに15個のCSS変数を追加。既存の色変数の直後に配置。

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

### tailwind.config.js

`theme.extend.fontSize` に15個のマッピングを追加。

```js
fontSize: {
  'app-3xs': 'var(--font-size-3xs)',
  'app-2xs': 'var(--font-size-2xs)',
  'app-xs': 'var(--font-size-xs)',
  'app-sm': 'var(--font-size-sm)',
  'app-base': 'var(--font-size-base)',
  'app-md': 'var(--font-size-md)',
  'app-lg': 'var(--font-size-lg)',
  'app-xl': 'var(--font-size-xl)',
  'app-2xl': 'var(--font-size-2xl)',
  'app-2xl-plus': 'var(--font-size-2xl-plus)',
  'app-3xl': 'var(--font-size-3xl)',
  'app-4xl': 'var(--font-size-4xl)',
  'app-4xl-plus': 'var(--font-size-4xl-plus)',
  'app-5xl': 'var(--font-size-5xl)',
  'app-6xl': 'var(--font-size-6xl)',
}
```

---

## 移行対象ファイル一覧（全85ファイル）

### コアUI（19ファイル）
- App.tsx
- src/components/ConsolidatedHeader.tsx
- src/components/Layout.tsx
- src/components/Sidebar.tsx
- src/components/Timeline.tsx
- src/components/TimelineRow.tsx
- src/components/MobileHeader.tsx
- src/components/MobileBottomNav.tsx
- src/components/MobileBottomSheet.tsx
- src/components/MobileGuide.tsx
- src/components/MobilePartySettings.tsx
- src/components/ContentLanguageSwitcher.tsx
- src/components/ErrorBoundary.tsx
- src/components/JobPicker.tsx
- src/components/MitigationSelector.tsx
- src/components/PulseSettings.tsx
- src/components/CheatSheetView.tsx
- src/components/LoPoButton.tsx
- src/components/Toast.tsx

### モーダル・ダイアログ（10ファイル）
- src/components/ConfirmDialog.tsx
- src/components/EventModal.tsx
- src/components/FFLogsImportModal.tsx
- src/components/JobMigrationModal.tsx
- src/components/LoginModal.tsx
- src/components/NewPlanModal.tsx
- src/components/PartySettingsModal.tsx
- src/components/PhaseModal.tsx
- src/components/SaveDialog.tsx
- src/components/ShareModal.tsx

### ポップオーバー・ドロップダウン（6ファイル）
- src/components/AASettingsPopover.tsx
- src/components/ClearMitigationsPopover.tsx
- src/components/HeaderMechanicSearch.tsx
- src/components/HeaderPhaseDropdown.tsx
- src/components/HeaderTimeInput.tsx
- src/components/PartyStatusPopover.tsx

### 共有・法的・公開ページ（3ファイル）
- src/components/SharePage.tsx
- src/components/PopularPage.tsx
- src/components/LegalPage.tsx

### UI部品（2ファイル）
- src/components/ui/Tooltip.tsx
- src/components/ui/TransitionOverlay.tsx

### 管理画面（17ファイル）
- src/components/admin/AdminBackups.tsx
- src/components/admin/AdminConfig.tsx
- src/components/admin/AdminContentForm.tsx
- src/components/admin/AdminContents.tsx
- src/components/admin/AdminDashboard.tsx
- src/components/admin/AdminGuard.tsx
- src/components/admin/AdminLayout.tsx
- src/components/admin/AdminLogs.tsx
- src/components/admin/AdminServers.tsx
- src/components/admin/AdminSkills.tsx
- src/components/admin/AdminStats.tsx
- src/components/admin/AdminTemplates.tsx
- src/components/admin/CsvImportModal.tsx
- src/components/admin/FflogsTranslationModal.tsx
- src/components/admin/PlanToTemplateModal.tsx
- src/components/admin/TemplateEditor.tsx
- src/components/admin/TemplateEditorToolbar.tsx

### 管理ウィザード（7ファイル）
- src/components/admin/wizard/AdminWizard.tsx
- src/components/admin/wizard/ContentWizard.tsx
- src/components/admin/wizard/JobWizard.tsx
- src/components/admin/wizard/SkillEditWizard.tsx
- src/components/admin/wizard/SkillWizard.tsx
- src/components/admin/wizard/StatsWizard.tsx
- src/components/admin/wizard/TemplateWizard.tsx

### ランディングページ（8ファイル）
- src/components/landing/CTASection.tsx
- src/components/landing/FeaturesSection.tsx
- src/components/landing/HeroSection.tsx
- src/components/landing/HousingSection.tsx
- src/components/landing/LandingFooter.tsx
- src/components/landing/LangToggle.tsx
- src/components/landing/MitiSection.tsx
- src/components/landing/ScrollProgress.tsx

### チュートリアル（8ファイル）
- src/components/tutorial/TutorialCard.tsx
- src/components/tutorial/TutorialMenu.tsx
- src/components/tutorial/TutorialOverlay.tsx
- src/components/tutorial/TutorialPill.tsx
- src/components/tutorial/animations/CompletionCard.tsx
- src/components/tutorial/animations/FakeCompletionCard.tsx
- src/components/tutorial/animations/PartyAutoFill.tsx
- src/components/tutorial/animations/PillFly.tsx

### CSS（2ファイル）
- src/index.css（body @apply + font-size !important）
- index.html（もしフォントサイズ指定があれば）

---

## 置換ルール

### text-[Xpx] → text-app-*

| 現在 | 変換後 |
|---|---|
| `text-[6px]` | `text-app-3xs` |
| `text-[7px]` | `text-app-2xs` |
| `text-[8px]` | `text-app-xs` |
| `text-[9px]` | `text-app-sm` |
| `text-[9.5px]` | `text-app-sm`（9pxに丸め） |
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

---

## data-font-scale との関係

既存の `data-font-scale` 機能（index.css line 223付近）はそのまま維持する。この機能はCSSセレクタでfont-sizeを上書きする仕組みなので、CSS変数化しても競合しない。Phase 2でトークンの値を調整する際に、data-font-scaleとの整合性を確認する。

---

## 安全策

1. **見た目ゼロ変更の保証**: 各トークンの初期値は現在のハードコード値と完全一致
2. **段階的移行**: コンポーネントグループ単位で移行し、グループごとにビルド確認
3. **9.5px の丸め**: Sidebar.tsxに1箇所だけ `text-[9.5px]` がある。9pxに丸めるが、0.5pxの差は視認不可能
4. **1.1em の維持**: ConsolidatedHeader.tsxの相対値は親要素依存のため変数化しない
5. **ビルド確認**: 各グループ移行後に `npm run build` でエラーがないことを確認

---

## Phase 2 への引き継ぎ

Phase 1完了後、以下をPhase 2で実施する（別設計書）:

1. セマンティックトークンの検討（`--font-heading`, `--font-label` 等）
2. 6段階スケールへの値調整
3. font-weightの統一
4. data-font-scaleとの整合性確認
