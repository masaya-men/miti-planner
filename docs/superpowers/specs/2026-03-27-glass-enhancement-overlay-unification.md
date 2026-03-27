# 人気ページ ガラス表現強化 + オーバーレイ統一 設計書

## 概要

2つの独立した改善を行う：
1. 人気ページのガラスエフェクトを `empty-liquid-glass` 品質に引き上げる
2. アプリ全体のモーダルオーバーレイの暗さ・ぼかしを統一する

---

## 1. 人気ページ ガラス表現強化

### 対象要素
- 共有カード（`.glass-popular-card`）
- スケルトンカード（ローディング中のプレースホルダー）
- ヘッダー下線部分

### 参考モデル
`src/index.css` の `.empty-liquid-glass` 系クラス。以下の要素を人気ページ向けに適用する：
- 四隅のコーナーハイライト（radial-gradient）
- 上辺シーンライン（光の反射線）
- 縁のグラデーションボーダー（::before / ::after の mask-composite テクニック）

### アニメーション仕様

**呼吸アニメーション（emptyBreathe）は使用しない。**

代わりに以下の2種類を組み合わせる：

#### A. ホバー / 表示時の光走り
- カードにホバーしたとき、または画面に表示されたとき（IntersectionObserver）に一瞬光が走る
- 光は縁に沿って片方向に流れ、すぐフェードアウト
- 1回きり（ループしない）。再ホバーで再発火

#### B. ページ全体の波ライティング
- ページ背景に、ゆるい光の波が左から右へ流れる
- 速度: 5〜8秒で画面を横断（ゆったり。見ていたら気づく程度）
- 波がカードに当たると、カードの縁が一瞬明るくなる
- CSS animation で実装。JavaScript 不要を目指す

### 光の色
- **ダークテーマ**: 白い光（rgba(255,255,255,...)）
- **ライトテーマ**: 黒い光（rgba(0,0,0,...)）
- アクセントカラー（`--app-accent-rgb`）は使用しない
- 既存の `empty-liquid-glass` と同じ方針

### 既存クラスとの関係
現在の `glass-popular-card` / `glass-popular-header` / `glass-popular-section` はアクセントカラーベース。これらを白/黒ベースのガラスに置き換える。

---

## 2. オーバーレイ統一

### 現状の問題
アプリ全体で11種類の異なるオーバーレイ透明度と3種類のぼかし値が混在しており、画面ごとに暗さが違う。

### 統一ルール

| プロパティ | 統一値 |
|-----------|--------|
| 背景の暗さ | `bg-black/50` |
| ぼかし | `backdrop-blur-[2px]` |

### 適用対象（全箇所）

チュートリアルオーバーレイも含め、以下をすべて統一する：

| ファイル | 現状 | 変更後 |
|---------|------|--------|
| JobPicker.tsx | bg-black/20 | bg-black/50 backdrop-blur-[2px] |
| Timeline.tsx (mobile) | bg-black/30 | bg-black/50 backdrop-blur-[2px] |
| CheatSheetView.tsx | bg-black/40 | bg-black/50 backdrop-blur-[2px] |
| NewPlanModal.tsx | bg-black/40 | bg-black/50 backdrop-blur-[2px] |
| SaveDialog.tsx | bg-black/40 | bg-black/50 backdrop-blur-[2px] |
| PartyStatusPopover.tsx | bg-black/40 backdrop-blur-[2px] | bg-black/50 backdrop-blur-[2px] |
| PartySettingsModal.tsx | bg-black/40 backdrop-blur-[2px] | bg-black/50 backdrop-blur-[2px] |
| MitigationSelector.tsx | bg-black/40 backdrop-blur-sm | bg-black/50 backdrop-blur-[2px] |
| ConfirmDialog.tsx | bg-black/50 backdrop-blur-[2px] | 変更なし（すでに統一値） |
| LoginModal.tsx | bg-black/50 backdrop-blur-[2px] | 変更なし |
| MobileBottomSheet.tsx | bg-black/50 | bg-black/50 backdrop-blur-[2px] |
| EventModal.tsx (mobile) | bg-black/60 backdrop-blur-sm | bg-black/50 backdrop-blur-[2px] |
| FFLogsImportModal.tsx | bg-black/60 backdrop-blur-sm | bg-black/50 backdrop-blur-[2px] |
| JobMigrationModal.tsx | bg-black/60 backdrop-blur-sm | bg-black/50 backdrop-blur-[2px] |
| PhaseModal.tsx (mobile) | bg-black/60 | bg-black/50 backdrop-blur-[2px] |
| ShareModal.tsx | bg-black/60 backdrop-blur-sm | bg-black/50 backdrop-blur-[2px] |
| Sidebar.tsx (modals) | bg-black/60 | bg-black/50 backdrop-blur-[2px] |
| TutorialOverlay.tsx | bg-black/60 | bg-black/50 backdrop-blur-[2px] |
| MobileGuide.tsx | bg-black/60 | bg-black/50 backdrop-blur-[2px] |
| Layout.tsx (loading) | bg-black/80 | bg-black/50 backdrop-blur-[2px] |
| AASettingsPopover.tsx | bg-black/90 | bg-black/50 backdrop-blur-[2px] |

### 例外
- `empty-liquid-glass` の `rgba(0,0,0,0.35)` はオーバーレイではなくガラスエフェクトの背景なので対象外
- ヘッダーやナビバーの `backdrop-blur-md` は常時表示のUI部品であり、モーダルオーバーレイではないため対象外

---

## 対象外（このスペックに含まないもの）
- z-index の統一（別タスク）
- ライトテーマでのオーバーレイ色（`bg-black/50` はライトテーマでも黒ベースのまま。これが標準的な挙動）
