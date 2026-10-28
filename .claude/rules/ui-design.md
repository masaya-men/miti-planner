---
paths:
  - "src/components/**"
  - "src/index.css"
exclude:
  - "src/components/housing/**"
  - "src/styles/housing.css"
  - "src/styles/housing/**"
  - "src/pages/housing/**"
---

# UIデザインルール

> ## ⚠ スコープ免除: ハウジング画面 (`/housing` 配下すべて)
>
> 以下のすべてのルールは **LoPo 既存 UI 向け** であって、 ハウジング画面 (`src/components/housing/**` と `src/styles/housing.css` と `src/pages/housing/**`) には **適用されない**。 ハウジング配下なら workspace / register / モーダル / ダイアログ等、 **全コンポーネント**が対象外。
> ハウジングは独立世界観 (動画背景 + ガラス + ハニーゴールド) として設計されており、 モックアップ (`docs/.private/housing-tour-mockup/index.html`) が正典。
> 詳細は memory `feedback_housing_design_independent.md` を参照。
>
> **判定**: 編集対象ファイルが上記パス配下なら本ルールは無視、 モックアップ準拠 + housing.css の token (`--housing-*`) 経由で進める。

---

## 色のルール
全UI要素に白と黒のみ使用。既存テーマ変数（app-text, app-bg等）の白黒はOK。
例外: 警告系→黄色、削除・危険系→赤、OK・先に進む系→青（第42セッション確定）

## AIっぽいデザイン禁止
- AIグラデーション禁止（青→紫）
- Interフォント禁止
- Lucideアイコンのみの使用禁止（他も検討）
- shadcnデフォルトそのまま禁止（カスタマイズして使う）

## マウス追従UI禁止
onMouseMoveの高頻度イベント + state更新のパフォーマンスコストが大きい。固定位置UIで代替する。

## デザイン変更の承認フロー
UIの見た目に影響する変更は、勝手に適用せず必ずユーザーに確認してから。
(1) 現状確認 → (2) 変更案のプレビュー/説明 → (3) ユーザー承認 → (4) 実装

## 共通の部品を使う
- 新しい UI を書く前に、共通の部品(ui/ModalParts・MobileBottomSheet・float-surface・useIsMobile など)を探す。似た物を書き足さない。
- `src/architecture/__tests__/shared-look.json` で凍らせた書き方はまねしない(既存の手書きは寄せる途中)。
- 外側を押した時の動き(閉じる等)は `useDismissOnOutside` を使う。document への手書きは禁止。
