# ツアー追加のフィードバックアニメーション 設計書 (2026-08-10)

## 背景と目的

ハウジングの「ツアーに追加」ボタン(探すページのカード / 詳細ページの操作バー)は、押しても成功・失敗の手がかりがほぼ無い。

- 成功時: リップル(波紋)が広がるだけ。トレイの件数表示は変わるが、詳細ページ (`/housing/listing/:listingId`) はページ内にツアートレイ自体が無い(PC・スマホとも別レイアウト)ため、押した本人には「本当に追加されたか」が分からない。
- 失敗時(別リージョンの家を今のツアーに混ぜようとした場合): 画面下中央に汎用トースト (`ToastContainer`) が出るだけで、どのカード・どのボタンの操作で失敗したのかが視覚的に紐付いていない。

ユーザー指摘(2026-08-10): 成功時は「かわいい・最新」な印象のフィードバックアニメーションが欲しい。失敗時は押したボタンの近くで、はっきり気づけるフィードバックにしたい。

## 確定済みの決定(ユーザー合意・2026-08-10)

| 論点 | 決定 |
|---|---|
| 成功時の演出の方向性 | 「チェックマーク描画」系(住所確認ボタン `.housing-confirm-button` の bounce+draw+ripple+glow を踏襲)。お気に入りハートのポン+粒子飛散パターンは不採用(♡=お気に入りと意味が混同するため) |
| 成功後のボタンの状態 | 一時的な演出だけでなく、**トレイに入っている間ずっと「追加済み」の見た目を維持する**(トレイ側から見なくても分かる状態表示) |
| 「追加済み」ボタンの再クリック | **トグルとして扱う**。もう一度押すとツアーから外れ、元の「＋ツアーに追加」表示に戻る(お気に入りハートと同じ操作感) |
| 失敗時に何を揺らすか | **押したボタン自体だけ**。探すページのカード全体・詳細ページの操作バー全体は揺らさない(2案の場所で仕組みを統一し、実装をシンプルにする) |
| 失敗時のメッセージの出し方 | 押したボタンの真上に、その場だけのメッセージを表示する。画面下中央の汎用トースト (`showToast`) は**この操作(ツアー追加ボタン押下時の地域跨ぎエラー)に関しては使わない(置き換え)** |
| 対象外にした範囲 | 「ツアーを開始する」ボタン押下時の地域跨ぎ警告 (`housing.tour.region_block_start`、`BrowsePage.commitStart` / `MobileTourTrayBar.commitStart`) は今回の対象外。現状の画面下中央トーストのまま変更しない |

## 現状の実装(前提知識)

### 成功時に何が起きているか

- 探すページのカード: `src/components/housing/browse/ListingCard.tsx:299-319` の `.housing-card-add-btn` ボタン。クリックで `addRipple(e)` (`useRipple`) → `onAddToTour(listing.id)` を呼ぶだけ。ボタン自体はトレイに入っているかどうかに関わらず常に同じ見た目(`<Plus/>` + 「ツアーに追加」)。
- 詳細ページ: `src/components/housing/listing/HousingActionBar.tsx:71-88` の `onAddToTour` ハンドラ。`addRipple(e)` → 地域チェック → `setTrayIds` を直接呼ぶ。ボタンの見た目もクリック後に変化しない。
- どちらも `MapSpotCard.tsx` (`src/components/housing/browse/map/MapSpotCard.tsx:201-205`) 経由で `ListingCard` を再利用している画面(地図ビュー・複数件パネル)にも同じボタンが使われているため、`ListingCard` 側を直せば地図系画面にも自動で反映される。

### 失敗時(地域跨ぎブロック)に何が起きているか

- 判定ロジックは `canAddToTour` / `tourAnchorRegion` (`src/lib/housing/tourCrossing.ts`)。
- 探すページ: `BrowsePage.tsx:113-130` の `addToTray` 内でチェックし、失敗時 `showToast(t('housing.tour.region_block'), 'error')`。
- 詳細ページ: `HousingActionBar.tsx:71-88` の `onAddToTour` 内でほぼ同じチェックを独立に実装(コード中のコメントにも「BrowsePage.addToTray と同じロジック」と明記されており、既に重複が自覚されている)。
- `showToast` (`src/components/Toast.tsx`) はハウジング専用ではなく LoPo 全体共通の実装で、`fixed bottom-24 left-1/2` に、`glass-tier3` 等の LoPo 標準トークンで表示される(`--housing-*` トークンではない)。ハウジングの独自トンマナには乗っていない、汎用の通知。

### 使えるアニメーション資産(既存・流用元)

- `src/styles/housing.css:1563-1605` `.housing-confirm-button[data-animating="true"]`: 丸ボタンの ✓ アイコンが `stroke-dashoffset` でパスを描画しながら、`housing-check-bounce`(拡大→縮小→戻る) + `housing-check-glow`(ハニーゴールドの光が一瞬強くなる) + `::after` の `housing-check-ripple`(輪が広がって消える)を同時再生する。丸型ボタン前提(`border-radius:50%` の `::after`)。
- `src/styles/housing.css:6951-6980` `.housing-card-fav.is-pop` / `.housing-fav-particle`: ハート押下時の拡大+ひねりバウンド+多方向パーティクル飛散。今回は不採用だが、`prefers-reduced-motion` 対応など実装作法の参考にする。
- `.housing-card-add-btn` (`src/styles/housing.css:7040-7055`): 対象ボタンの素の見た目。`border-radius: 8px` の角丸矩形(円ではない)。`position: relative; overflow: hidden` 済みなのでリップルや疑似要素の重ね描画がそのまま使える。
- 揺れ(shake)アニメーションは housing.css に既存のものが無い。今回新規追加する。
- 色: 危険/警告用トークン `--housing-danger` (`#ff8a6c`) / `--housing-danger-soft` (`src/styles/housing.css:109-111`) が既にあるので、失敗演出はこれを流用し新規カラーは作らない。

### i18n(現状のキー)

- `housing.card.add_to_tour` = 「ツアーに追加」(カードのボタンラベル兼、詳細ページボタンの aria-label)
- `housing.detail.add_to_tour` = 「ツアー」(詳細ページボタンの可視ラベル。操作バーが横に長く並ぶため短縮表記)
- `housing.tour.region_block` = 「別リージョンのハウジングは同じツアーに入れられません」(失敗メッセージ本文。今回はこの文言・キーをそのまま使い、表示位置だけ変える)

## 変更が必要な範囲

### 1. 共有ロジック: 新規 hook `useTourAddFeedback`

新規ファイル `src/lib/housing/useTourAddFeedback.ts`。探すページ側 (`ListingCard`) と詳細ページ側 (`HousingActionBar`) が独立に実装している「地域チェック→成功/失敗の演出トリガー」を1箇所に統合する(現状の重複の根治も兼ねる)。

- 入力: 対象 listing の `id` / `region`、地域チェックに必要な現在のトレイ内容(呼び出し側から渡すか、hook 内で `useTourTrayStore` を直接購読するかは実装時に決定。後者の方が呼び出し側の配線が薄くなるため推奨)。
- 内部状態: `animState: 'idle' | 'success' | 'error'`(演出用の一時フラグ。アニメーション再生時間経過後に自動で `idle` に戻す。既存の `.housing-confirm-button[data-animating="true"]` と同じ「一定時間だけ属性を立てて自動で下ろす」パターンを踏襲)。
- 「追加済み」判定は hook 内で state を持たず、**呼び出し側がストア (`useTourTrayStore`) から `trayIds.includes(id)` を購読して真偽値として渡す/参照する**(トレイ側で外した場合に自動で見た目が追従するようにするため。ローカル state で「追加した」を覚えると、トレイ側からの削除と同期が取れなくなる)。
- 公開する関数: `attemptToggle()` — 現在「追加済み」なら `setTrayIds` から除去して即終了(演出は再生しない。外す操作は静かでよい)。「未追加」なら地域チェックを行い、
  - OK: `setTrayIds` に追加 + `animState = 'success'`
  - NG: `animState = 'error'` + 表示するメッセージ(`housing.tour.region_block` の翻訳済み文字列)を返す/state に積む
- 返り値: `{ isAdded, animState, message, attemptToggle }` のような形(詳細な型は実装計画で確定)。

### 2. ボタン側の見た目変更

#### `src/components/housing/browse/ListingCard.tsx`

- `.housing-card-add-btn` の中身を `useTourAddFeedback` の返り値で出し分け:
  - 通常: `<Plus/>` + `t('housing.card.add_to_tour')`
  - 追加済み: `<Check/>`(lucide-react、既存 import 追加) + `t('housing.card.added_to_tour')`(新規 i18n キー) + `aria-pressed={true}` + `data-animating` 属性(success 再生中のみ)
- クリックハンドラを `attemptToggle()` 呼び出しに置き換え(`unlisted` の既存ガードは維持)。
- 失敗時: ボタンに shake 用のクラス/`data-shake` 属性を一時付与 + ボタン直上に小さな吹き出し(新規コンポーネント、下記)を表示。

#### `src/components/housing/listing/HousingActionBar.tsx`

- 同様に `useTourAddFeedback` を使うよう置き換え。可視ラベルは通常時 `housing.detail.add_to_tour`(「ツアー」)のままだが、追加済み時はカード側と同じ新規キー `housing.card.added_to_tour`(「追加済み」)に統一する(短縮表記を別途作らない・キーを1つに保つ)。aria-label も同キーを使う。
- 現状 `HousingActionBar` 内に直書きされている地域チェック処理 (`onAddToTour` 内の `canAddToTour` 呼び出し) は hook に委譲して削除する。

### 3. 失敗時の吹き出し(新規・小コンポーネント)

新規ファイル案: `src/components/housing/HousingInlineErrorBubble.tsx`(名称は実装時に調整可)。

- ボタンの `ref` から `getBoundingClientRect()` を取り、`createPortal` で `document.body` 直下に絶対配置する(`ListingCard.tsx` の `visibilityMenuPos` と同じ確立済みパターンを踏襲。カードの `overflow:hidden` に切り取られないようにするため)。
- 見た目: ハウジングのガラスパネル + `--housing-danger` 系の縁取り。小さめの吹き出し(矢印はCSSの三角形 or ボーダートリックで表現)。
- 表示時間: 2.5秒程度で自動フェードアウト(既存トーストの3秒と大きく変えない)。
- スマホでの画面端はみ出し対策: `ListingCard` の視認性バグ修正 (2026-08-10 対応済み・`fixed`+`portal`化) と同様、ビューポート内に収まるよう左右位置をクランプする。

### 4. CSS 追加 (`src/styles/housing.css`)

- 成功演出: `.housing-card-add-btn[data-animating="success"]` 用に、既存の `housing-check-bounce` / `housing-check-glow` を流用しつつ、`::after` のリング (`housing-check-ripple` 相当)は `border-radius: inherit`(8px)に変更した専用キーフレームを新設(丸ボタン前提の既存クラスをそのまま使い回すと角丸矩形に対して不自然になるため)。
- 追加済み状態の地色: ハニーゴールド寄りの塗り(お気に入り `.is-on` や `housing-card-background-select.is-selected` と同系統のトークンを使用)。
- 失敗演出: 新規 `@keyframes housing-shake`(左右に小さく往復する短時間の揺れ、320ms 程度)。`--housing-danger` で縁取り/アイコン色を一時的に変える。
- `prefers-reduced-motion: reduce` では、既存の `.housing-card-fav` 節と同様に shake/bounce 系アニメーションを無効化し、状態変化(追加済み表示の切替・吹き出しの表示/非表示)は即時反映にする。

### 5. i18n (5言語: ja/en/ko/zh/zh-Hant)

- 新規キー `housing.card.added_to_tour`(例: 「追加済み」)を追加。カード・詳細ページ両方の「追加済み」ラベル/aria-label で共用する。
- `housing.tour.region_block` は既存キーをそのまま流用(文言変更なし、表示場所が変わるだけ)。

## テスト方針

- `useTourAddFeedback` の単体テスト: 追加成功 → `isAdded=true` に変わる / 地域NG → `isAdded=false` のまま・エラーメッセージが返る / 追加済み状態から `attemptToggle()` → トレイから除去される、の3系統。
- `ListingCard.test.tsx` / `HousingActionBar.test.tsx`: 追加済み時にラベルが「追加済み」に変わり `aria-pressed=true` になること、失敗時に吹き出し用の要素がレンダーされること(アニメーション自体の見た目はユニットテストで検証しない)。
- 実機確認: 開発者本人の画面(CSS 1489px / DPR 2.58)で、探すページ・詳細ページ両方の成功/失敗パターンをスクリーン確認(ユーザー側で実施)。

## 非対象・据え置き事項

- 「ツアー開始」ボタン押下時の地域跨ぎ警告(`region_block_start`)は変更しない。
- お気に入り機能・トレイ本体の並べ替え/開始フローには手を入れない。
- 新規ライブラリの追加は無し(既存の CSS keyframes 方式のみで実現)。
