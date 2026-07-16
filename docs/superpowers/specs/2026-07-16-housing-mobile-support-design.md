# ハウジング スマホ対応 設計書 (2026-07-16)

## 目的
ハウジング (`/housing`) の全機能をスマホで問題なく使えるようにする。基準は**スマホ縦持ち**、ツアーのみ**横持ち**。
「**簡単・短時間で動く**」を最優先。ピクセルパーフェクトは狙わない。公開でスマホから来るユーザー
(共有リンク流入が本命) の体験を成立させることがゴール。

## 非目標 (今回スコープ外)
- タブレット最適化
- スマホでの「マップで探す」(`BrowseMapView`) — 一覧で代替
- 中韓翻訳 (別タスク・[[project_housing_gameterms_admin_glossary]])
- ピクセル単位の作り込み

## 前提・現状 (実物確認済み)
- シェル `HousingShell`: 背景動画 + `AppHeader` + `<Outlet/>`(各ページ) + `StatusBar`(フッター)。
  body は `overflow:hidden` の固定ビューポート ([[reference_mobile_fullscreen_page_in_app_shell]])。
- `AppHeader`: ブランド + (探すページのみ検索 input) + `TabBar`(探す/お気に入り/ツアー等タブ)
  + 右クラスタ (通知ベル / テーマトグル / アバター or ログイン)。
- `StatusBar` (フッター): 著作権・免責・プライバシー・規約・Ko-fi + テーマ表示 + **言語スイッチャー(ja/en/ko/zh)**。
- ツアー `TourNavPage`: 3パネル (左=ショーケース / 中=地図+招待 / 右=進捗+行き方+操作[前へ/見学/次へ/完了])
  + 完了オーバーレイ。操作系(前へ/見学/次へ/完了)と行き方テキストは**右パネル**、家の写真は**左パネル**にある。
- 詳細 `HousingDetailPage`: 既にモバイル縦積み対応済み (`@media (min-width:769px)` で md+ を3カラム化する
  mobile-first 構造)。
- 軽減表側に `src/components/MobileBottomNav.tsx` / `src/components/MobileFAB.tsx` あり = **構造の流用元**
  (ただしハウジングは独立トンマナ [[feedback_housing_design_independent]] なので見た目は `--housing-*`
  トークンで作り直す。構造・挙動を流用)。

## ブレイクポイント方針
- 境界 = **769px** (詳細ページの既存境界に統一)。**スマホ = 768px 以下**。
- 既存のデスクトップ構築済み画面 (探す/お気に入り/登録/編集/PF/ツアー) は `@media (max-width: 768px)` の
  上書きブロックで縦積み/全画面化する。mobile-first への全面リファクタは時間対効果が悪いので避ける。
- 新規のモバイル専用クロム (ボトムナビ/FAB/シート) は JS の `useIsMobile` (matchMedia 768px) で
  条件レンダリング (デスクトップでは DOM に出さない)。既存 miti 側の判定を流用、無ければ共有フックを新設。
- CSS は必ず `--housing-*` トークン経由 (housing-design ルール・ハードコード禁止)。新規トークンは
  `src/styles/housing.css` の `.housing-workspace` ブロックに集約。

## 共通クロム (新規)

### 1. ボトムナビ `HousingBottomNav`
- スマホのみ。画面下固定。`env(safe-area-inset-bottom)` 対応。
- 5項目 (左→右): **フィルター / お気に入り / ツアー / 設定 / ログイン**。
  - フィルター → フィルターシートを開く
  - お気に入り → `/housing/favorites`
  - ツアー → `/housing/tour` (`TourNavPage`)
  - 設定 → 設定シートを開く
  - ログイン → 未ログイン: ログインモーダル / ログイン済: アカウントシート。**未読通知ありでバッジ**
- アクティブ表示 = 現在ルートに対応する項目をハニーでハイライト。
- 探す (`/housing`) はベース画面。ナビ項目にしない。ホーム復帰は左上ブランドタップ (既存の `/housing` 遷移)。
- **ツアー中/共有参加中は非表示** (没入)。

### 2. 登録FAB `HousingRegisterFab`
- スマホのみ。右下固定 (ボトムナビの上・safe-area 対応)。＋アイコン。
- タップ → 登録 (`/housing/register`) を全画面で開く。
- **未ログイン → ログインモーダルを先に出す**。
- ツアー中/共有参加中は非表示。

### 3. フィルターシート `HousingFilterSheet`
- ボトムシート。中身 = 現行の検索 input (AppHeader の探す検索) + `FilterPanel` の全絞り込み。
- 適用でシートを閉じ、探すの2列グリッドに反映。
- `MobileBottomSheet` の高さは fillContent (確定高さ) を使う ([[reference_mobilesheet_fillcontent_height]])。

### 4. 設定シート `HousingSettingsSheet`
- ボトムシート。中身 = **旧フッター(`StatusBar`)まるごと**:
  - テーマ (日/夜トグル・既存 `switchTheme` の View Transitions 演出を流用)
  - 言語 (ja/en/ko/zh)
  - 著作権 / 免責 / プライバシー / 規約
  - Ko-fi (`/support`)

### 5. アカウントシート
- 既存 `HousingAccountModal` をスマホでボトムシート/全画面化して流用。中身 = 通知一覧 (`NotificationBell`
  の内容) + アカウント情報。未読バッジはボトムナビの「ログイン」項目に出す。

## シェル変更 (`HousingShell` / `AppHeader` / `StatusBar`)
- スマホ時: `AppHeader` は最小化 — ブランド(=ホーム)だけ残し、TabBar / 検索 input / 右クラスタ
  (通知/テーマ/アバター) は非表示 (機能はボトムナビ+シートが担う)。
- スマホ時: `StatusBar` (フッター) は非表示 (中身は設定シートへ)。
- スマホ時: `HousingShell` に `HousingBottomNav` + `HousingRegisterFab` をマウント。
- **ツアー中判定**: 既存 `useHousingViewStore` の tourMode 系 state を利用してクロムの表示/非表示を切る。
  共有参加中は `useJoinedTourStore` の token 有無で判定。

## 画面別

### 探す (BrowsePage)
- 全幅。カードグリッド = **2列** (`@media (max-width:768px)`)。
- 検索/絞り込みはヘッダーから消え、**フィルターシート**へ。
- ビュー切替 (`BrowseViewToggle`) のマップは非表示 (リストのみ)。
- カード再生挙動は**不変** (1件ずつ・画面内のみ描画。現行の業界水準挙動を維持。新たな間引きは入れない)。

### お気に入り (FavoritesPage)
- 全幅・2列カード (探すと同じグリッド)。

### ツアー (TourNavPage) — 案A 横持ち
- スマホ時: 左(ショーケース)・右(進捗)パネルを非表示、中央の地図を全画面に。
- 画面下に**細い操作バー**: 行き方テキスト + [前へ] [見学] [次へ]。
- 見学 = 家の写真をオーバーレイ表示 (ショーケースをシート化)。
- 招待 (幹事) = バー隅に小さいボタン。
- 跨ぎ (DCトラベル/ワールド訪問) 案内は既存ロジックのまま (「次へ」の1回目で ack)。
- 完了オーバーレイは既存 (全画面) をそのまま。
- **縦持ち検出時**: 「横にしてね」ヒントを重ねる。
- ボトムナビ非表示。

### 共有ツアー参加 (JoinTourPage)
- ツアーと同じ横持ち地図UI。参加者は幹事に追従 = **操作ボタン(前へ/次へ)を出さない**。行き方 + 地図のみ。
- ボトムナビ非表示。

### 詳細 (HousingDetailPage)
- 既にモバイル縦積み対応済み。**全画面 + 戻るボタン**を確認/仕上げ。カードタップで開く。

### 登録 / 編集 (RegisterPage / HousingEditPage)
- 全画面フォーム (縦積み・全幅)。登録 = FAB、編集 = 自分の物件の詳細から。

### ハウジンガーPF (HousingerPage)
- 全幅の縦積み。名前タップで開く。

## i18n
- 新規UI文言 (ボトムナビラベル / 設定シート見出し / 「横にして」ヒント等) は必ず i18n キー経由、
  **ja/en/ko/zh 4言語 parity** を維持 (i18n ルール・[[feedback_locale_json_textual_edit]])。
- 既存キー (`footer.*` / `housing.workspace.topbar.theme_*` / `housing.header.*` 等) を最大限流用。

## テスト
- vitest (jsdom) はレイアウトを実測しないため、モバイル分岐は主に**条件レンダリング**を担保:
  - モバイルでボトムナビ/FAB が出る・デスクトップで出ない
  - ツアー中/共有参加中はクロムが消える
  - 未ログインで FAB → ログイン誘導
- 見た目 (2列 / 横持ち地図 / シート) は**実機目視チェックリスト**で引き継ぎ ([[feedback_no_screenshots_local_verify]])。
- push 前: `npm run build` + `vitest run` 必須 ([[feedback_vercel_tsc_strict]] / vmThreads 手順厳守)。

## 実装分割 (司令塔メモ・詳細は writing-plans で確定)
独立タスク単位に割り、機械的なものは安価なモデルのサブエージェントへ:
- **T1** `useIsMobile` フック + シェル配線 (ボトムナビ/FAB マウント・ヘッダー最小化・フッター非表示・ツアー中非表示)
- **T2** `HousingBottomNav` (5項目・アクティブ・通知バッジ・safe-area)
- **T3** `HousingRegisterFab` (＋・登録遷移・未ログイン誘導)
- **T4** `HousingFilterSheet` (検索 input + FilterPanel 移設)
- **T5** `HousingSettingsSheet` (旧フッター全部: テーマ/言語/法的/Ko-fi)
- **T6** 探す/お気に入り 2列グリッド + マップ非表示
- **T7** ツアー横持ち (案A・操作バー・見学オーバーレイ・横にしてヒント)
- **T8** 共有ツアー参加 横持ち (追従・操作なし)
- **T9** 詳細/登録/編集/PF 全画面仕上げ
- **T10** i18n キー整備 (4言語) + build/test 緑

依存: T1 が土台 (先行)。T2-T5 は T1 後に並行可。T6/T9 は独立で並行可。T7→T8 (T8 は T7 の横持ち土台を流用)。T10 は各タスクで随時 + 最後に総点検。

## デプロイ / ゲート
- 新機能につき本番反映は**ユーザーのスマホ実機確認をゲート**にする ([[feedback_deploy]])。
- 「実装完了」= ブランチで **build + test 緑** + **実機目視チェックリスト提出**まで。勝手に本番へ出さない。
- push はまとめる (Vercel Hobby ビルド制限 [[feedback_vercel_builds]])。
