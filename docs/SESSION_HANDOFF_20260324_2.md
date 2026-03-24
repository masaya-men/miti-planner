# セッション引き継ぎ書（2026-03-24 第2セッション）

## 今回のセッションで完了したこと

### 名前入力フロー
- コンテンツクリック → 名前入力ダイアログ（createPortalでbody直下に配置、z-[100000]）
- デフォルト名は `shortName.en`（例: "M9S"）
- チュートリアル中はダイアログをスキップしてデフォルト名で自動作成

### 新規作成モーダル（NewPlanModal）
- テンプレート読み込み対応（サイドバーと同じ `getTemplate` + `loadSnapshot` 処理）
- コンテンツ未選択でも自由プラン作成可能（名前だけで作成）
- デフォルト名を英語略称に統一
- カテゴリ順: 零式→絶→ダンジョン→レイド→その他
- 作成後にサイドバーのレベルタブ・選択状態が自動連動
- 作成されたコンテンツまで自動スクロール（`data-content-id` 属性で要素を探す）
- REQUIREDバッジ → 「任意」（白黒ルール適用）
- 作成ボタンの accent 色 → 白黒反転に変更

### 削除UI
- 複数選択ボタンと削除ボタンを完全分離（`MultiSelectState` に `mode: 'share' | 'delete'` 追加）
- 下部アクションバー: 2段レイアウト（上段: 件数、下段: キャンセル+アクション）
- モードに応じて「まとめて共有」or「削除」ボタンを切り替え
- カスタム削除確認モーダル（NewPlanModalと同じ温度感、createPortalでbody配置）
- 削除モードは選択件数無制限（共有モードのみ10件制限）
- 選択不可コンテンツ（プラン0件）は `opacity-20 pointer-events-none` で明確にグレーアウト

### サイドバー改善
- プラン1件でもサブアイテム表示（`contentPlans.length >= 1`）
- サブアイテム末尾に「+ 追加」行（ホバーの+ボタンは廃止）
- ペンシル編集ボタン（プラン名の横、ツールチップ付き）
- アコーディオン初期展開: 零式（最新シリーズのみ）+ 絶 のみ展開、他は閉じる
- スクロールバー位置統一（最近のアクティビティとコンテンツリスト）
- コンテンツ未紐付きプラン → レベル別「カスタム」セクションに表示
- 保存インジケータ・削除ボタンの文字色を `text-app-text` に（白黒ルール）
- ボタン間隔を詰めて英語モードでも1行に収まるように

### ヘッダー改善
- プラン名ダブルクリックでインライン編集（`startHeaderEdit` / `finishHeaderEdit`）
- ダブルクリック編集のツールチップ追加（i18n: `app.double_click_rename`）
- 日本語フォント: `scaleX(0.85)` → `font-size: 20px + scaleY(1.18)` 方式に変更
  - **理由**: scaleXはレイアウト幅に影響しないためtruncateが早く発動していた
  - scaleYは描画のみなのでレイアウト幅はフォントサイズ通りに計算される
  - `overflow-x-hidden overflow-y-visible` で縦方向の切れを防止
- プラン名と保存インジケータを同じflex行に配置（プラン名だけがtruncate）

### 共有モーダル
- 画像 `onLoad` まで生成中スピナーを表示し続ける（`imageLoaded` state）
- X共有テキストのハードコード → `t('app.title')` 経由
- 全 `defaultValue` 除去、5つの欠けていたi18nキーを追加

### プラン0件オーバーレイ
- タグ型吹き出し（左に太いバー + 右だけ角丸）
- ふわふわ横揺れアニメーション（framer-motion）
- 表は見える状態、操作だけブロック（`pointer-events-auto`）
- `/dev/bubbles` にプレビューページ（12種類の吹き出し比較、BubblePreview.tsx）

### チュートリアル基盤改修
- **PortalPage**: 自動起動を削除（トップページではチュートリアルが出なくなった）
- **共有リンク訪問者**: `hasVisitedShare` フラグで自動起動を抑制（SharePage訪問時にセット）
- **Step構成変更**: 旧Step 1（new-planボタン）を削除 → Step 1が直接content-selectに
- **案内カードの位置**: ターゲット要素の右 or 左に自動配置（`calcTooltipPos`）
  - パーティ系ステップ: パーティモーダルの右側に固定（上下も動かない）
  - ステップ切替時にスプリングアニメーションでスムーズ移動
- **「次へ」ボタン**: 白黒反転 + `animate-pulse` で目立つ
- **専用データ**: `src/data/tutorialTemplate.ts` 作成済み（AoE + TB イベント）
- **イベント生成**: `party-settings:closed` 後に `TUTORIAL_EVENTS` を使用（動的HP計算から固定値に変更）

### i18n・英語修正
- "Share Together" → "Share Selected"
- "MULTI-SELECT" → "Select"（英語モードでの幅問題解消）
- 全 `defaultValue` フォールバックを除去
- 新規追加キー: `sidebar.select_delete`, `sidebar.name_dialog_title/desc`, `sidebar.create_plan_button`, `sidebar.add_plan`, `sidebar.custom_plans`, `sidebar.selected_count_simple`, `sidebar.delete_confirm_title`, `sidebar.delete_warning`, `app.double_click_rename`, `app.rename`, `fflogs.tooltip_generate`, `new_plan.no_matches`, `new_plan.optional`, `app.share_modal_title/bundle_title/on_x/copy_share_url/generating_preview`

---

## 次回セッションでやるべきこと（優先順）

### 1. チュートリアル全面改修（最重要・続き）

**現状の問題:**
- チュートリアル専用プランの自動作成がまだ実装されていない（`tutorialTemplate.ts` のデータは作成済み）
- Step 1（コンテンツ選択）で既存テンプレートに依存している → 専用プランで独立させるべき
- Step 16以降（パーティ設定後のタイムライン操作）が動作確認できていない
- 一部ステップで案内カードの位置が最適でない

**あるべき姿:**
- チュートリアル開始時に `contentId: null` の専用プランを自動作成
  - プラン名: 日本語「チュートリアル」/ 英語 "Tutorial"（`TUTORIAL_PLAN_TITLE` に定義済み）
  - タイムラインに `TUTORIAL_EVENTS`（AoE at 4s, TB at 10s）を最初から入れる
  - コンテンツ選択ステップ自体をスキップ
- パーティ設定後のイベント生成は不要（最初から入っているため）
- 全ステップの通し動作確認
- 追加ステップ: オートプラン・プラン名編集・共有・新規作成紹介

**案内カードの設計方針（確定）:**
- ターゲット要素の右 or 左に配置（上下には置かない）
- パーティ系ステップはパーティモーダルの右側に固定
- ステップ切替時にスプリングアニメーションで移動（視線誘導）
- 「次へ」ボタンは `animate-pulse` で目立たせる

### 2. その他の残タスク（TODO.md参照）
- バグ修正（FFLogs系・オートプラン）
- Firebase連携（クラウド保存）
- トップページ改修

---

## 重要な技術的判断

1. **日本語フォントの横潰し**: `scaleX` はレイアウトに影響しない → `fontSize小 + scaleY` で解決
2. **名前入力ダイアログ**: `motion.aside` 内の `transform` で `fixed` が効かない → `createPortal` で body 配置
3. **チュートリアルのTooltip位置**: 画面中央固定 → `targetRects` ベースで右/左に自動配置
4. **削除モードの選択制限**: 共有=10件制限、削除=無制限（`MultiSelectState.mode` で分岐）
5. **NewPlanModal の `onClose` 拡張**: 作成結果（contentId + level）をサイドバーに返してレベルタブ・選択状態を連動

---

## ファイル変更一覧（主要）

| ファイル | 変更内容 |
|---------|---------|
| `src/components/Sidebar.tsx` | 名前入力ダイアログ、削除UI、サブアイテム表示、+追加行、ペンシルボタン、カスタムプランセクション |
| `src/components/ConsolidatedHeader.tsx` | プラン名ダブルクリック編集、日本語フォントscaleY方式、truncate修正 |
| `src/components/NewPlanModal.tsx` | テンプレート読み込み、自由プラン対応、カテゴリ順修正、onClose拡張 |
| `src/components/ShareModal.tsx` | 画像onLoad、i18nハードコード除去 |
| `src/components/Layout.tsx` | タグ型吹き出しオーバーレイ |
| `src/components/TutorialOverlay.tsx` | Tooltip位置計算、パーティ系固定位置、スプリングアニメーション |
| `src/components/MitiPlannerPage.tsx` | hasVisitedShare条件追加 |
| `src/components/PortalPage.tsx` | チュートリアル自動起動削除 |
| `src/components/SharePage.tsx` | hasVisitedShareフラグセット |
| `src/components/BubblePreview.tsx` | 吹き出しプレビューページ（開発用） |
| `src/store/useTutorialStore.ts` | hasVisitedShare追加、startTutorialOnMiti追加、専用プラン自動作成、confirmRestartにも対応、Step構成変更、TUTORIAL_EVENTS使用 |
| `src/components/MitiPlannerPage.tsx` | startTutorialOnMitiを呼ぶように変更 |
| `src/store/useMitigationStore.ts` | loadSnapshotでtimeline:events-loaded発火 |
| `src/data/tutorialTemplate.ts` | チュートリアル専用イベントデータ |
| `src/types/sidebarTypes.ts` | MultiSelectState.mode追加 |
| `src/locales/ja.json` / `en.json` | 大量のi18nキー追加 |
