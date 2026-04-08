# スマホヘッダー/ボトムナビ Apple風透過リデザイン

## 目的

MobileHeaderを`position: fixed`化し、スクロール時にテーブルがヘッダーの裏を透けて見えるようにする。同時にヘッダー・ボトムナビの透過感をAppleネイティブアプリ風にアグレッシブに強化する。

## 現状の問題

1. MobileHeaderが`position: relative`のため、テーブルがヘッダーの裏に来ない。背景を半透明にしても透過効果が発揮されない
2. ヘッダー/ボトムナビの背景透過度が70%で控えめ。Apple風のすりガラス感が不足

## 変更内容

### 1. MobileHeader fixed化

**MobileHeader.tsx**:
- `relative` → `fixed top-0 left-0 right-0`
- z-indexは`z-40`のまま（他のモバイル要素より低い）

**Layout.tsx**:
- `motion.main`のモバイル時`paddingTop`を`0` → `72px`に変更（MOBILE_TOKENS.header.height）
- safe-area-inset-topも加算する

### 2. 透過感の強化（アグレッシブ）

**index.css CSS変数**:

| 変数 | テーマ | 現在値 | 変更後 |
|------|--------|--------|--------|
| `--color-nav-bg` | ダーク | `rgba(20,20,20,0.70)` | `rgba(20,20,20,0.45)` |
| `--color-nav-bg` | ライト | `rgba(249,249,249,0.70)` | `rgba(249,249,249,0.50)` |

**MobileHeader.tsx / MobileBottomNav.tsx**:
- `backdrop-blur-xl`(24px) → `backdrop-blur-lg`(16px) — ブラーを軽くして色が透けるように

### 3. Apple風の仕上げ

**MobileHeader.tsx**:
- 下端ボーダー: 現在の`border-b border-app-border` → `border-b-[0.5px]`の極細線
- ボーダー色: `border-app-border` → `border-[var(--color-nav-border)]`（nav専用の薄い色）

**MobileBottomNav.tsx**:
- 上端ボーダー: 既に`0.5px solid var(--color-nav-border)`で設定済み → 変更不要

## 影響ファイル

- `src/index.css` — `--color-nav-bg`値の変更
- `src/components/MobileHeader.tsx` — relative→fixed、blur変更、ボーダー調整
- `src/components/MobileBottomNav.tsx` — blur変更
- `src/components/Layout.tsx` — モバイル時paddingTop追加

## 注意事項

- PC表示（md:以上）には影響なし（MobileHeaderはmd:hidden）
- safe-area-inset-top/bottomは既に対応済み
- MobileBottomSheetのbottom位置はボトムナビ基準で計算済みのため変更不要
