# OGPカード 背景画像の選択機能 設計書 (2026-08-03)

## 背景と目的

`api/og/_housingerCard.ts`(v4刷新、grid/sidebar 2パターン)は、代表作として選んだ画像配列の**先頭 (`photos[0]`)** を「ぼかし背景」と「コラージュ内の1枚」の両方に自動で使い回している。この「先頭=背景」を誰が・どう決めるかの選択手段が無く、実際には「マイページで代表作をクリックした順番の1番目」という分かりにくい暗黙ルールに委ねられていた。

ユーザー指摘(2026-08-03): 背景に向いた写真を選べる手段が無いのはおかしい。ただし「背景専用の別枠」のような複雑な機能は不要で、既に代表作として選んだ画像の中から1枚を「背景にも使う」と選べれば十分。

## 確定済みの決定

| 論点 | 決定 |
|---|---|
| 機能の粒度 | 新しい背景専用スロットは作らない。既存の代表作選択(最大10件・順序付き)の中から**1枚だけ「背景にも使う」を選べる**ようにする |
| 実現方法 | 選ばれた1枚を、画像配列を組み立てる際に**先頭へ並べ替えるだけ**。カード生成側(`api/og/_housingerCard.ts`・`buildBackdropLayer`等)は無改修。「先頭=背景」という既存ルールをそのまま使う |
| 背景に選んだ画像とコラージュの関係 | 分離しない。背景に選んだ画像は、今までどおりコラージュ内の1枚(先頭スロットの位置)としても表示される |
| 選択できる対象 | 既に代表作として選択済み(チェック済み)の物件のみ。未選択の物件には背景トグル自体を出さない |
| 選択の数 | 常に0枚または1枚(ラジオボタン的挙動)。新しく1枚選ぶと、それまで選ばれていた1枚は自動で解除される |
| 代表作から外した場合 | 背景に選ばれていた物件を代表作チェックから外すと、背景指定も自動で解除される(未指定状態に戻る) |
| 未指定時の挙動 | 現状と同じ(代表作の先頭が自動的に背景)。既存ユーザー・何も操作しないユーザーへの影響は無し |
| 見た目 | 代表作チェック(既存の丸い✓ボタン)の隣に、選択済みカードだけに小さい🖼アイコンのボタンを追加。背景に選ばれている間はハニーゴールドでハイライト |

## 現状の実装(前提知識)

- `src/types/housing.ts:343` 付近: `HousingerProfile` 型に `ogRepresentativeListingIds?: string[] | null` がある。これに並べて新フィールドを追加する。
- `src/components/housing/pages/HousingerPage.tsx:209-251`: 本人閲覧時のみ、`ogSelectionIds` state(代表作の選択順)を持ち、`handleToggleOgSelect` でトグル→`upsertHousingerProfile` を呼ぶ。`ListingGrid` に `selectable`/`selectedIds`/`onToggleSelect` として橋渡し。
- `src/components/housing/browse/ListingGrid.tsx:38-104`: `ListingCard` へ `selectable`/`selected`/`onToggleSelect` を1件ずつ forward するだけの薄いラッパー。
- `src/components/housing/browse/ListingCard.tsx:177-198`: カード左上 (`.housing-listing-card-topleft`) に、代表作選択の丸い✓ボタン (`housing-card-select`) を描画している。
- `src/lib/housing/housingerProfileService.ts:58-63`: `upsertHousingerProfile()` の入力型は `isPublished`/`bio`/`snsUrl`/`ogRepresentativeListingIds` のみを受け付けるホワイトリスト形式。
- `api/housing/_upsertHousingerProfileHandler.ts:29-56`: `validateUpsertBody()` が各フィールドをバリデーションし、`handler()` 内のトランザクション (`api/housing/_upsertHousingerProfileHandler.ts:113-127`) で `housing_profiles/{uid}` に書き込む。
- `api/share/_housingerPageHandler.ts:190-226`: `ogRepresentativeListingIds`(無ければ新着順上位10件)から listing を読み、`listingRepresentativeImages()` で各 listing の画像配列を集めて `listingImageArrays: string[][]` に積み、`collectImagesFromListings()` で先頭から順にスロットを埋める。**現状はここに listing の id を保持していない**(画像配列のみ)。
- `api/og/_housingerCard.ts` / `src/lib/ogpHousingerCard.ts`: 画像配列の**並び順**をそのまま使っているだけで、背景専用の概念は無い。画像URLの並びは既に署名・キャッシュハッシュの対象(`imageUrls` として `buildHousingerOgCardParams` に渡る)なので、背景選択が変われば画像の並びが変わり、結果的に新しいハッシュ(=新しいキャッシュ)になる。**このレイヤーは無改修で済む**。

## 変更が必要な範囲

### 1. データモデル

- `src/types/housing.ts`: `HousingerProfile` に `ogBackgroundListingId?: string | null` を追加(`ogRepresentativeListingIds` の直後)。
- `src/lib/housing/housingerProfileService.ts`: `upsertHousingerProfile()` の入力型に `ogBackgroundListingId?: string | null` を追加。

### 2. API: `api/housing/_upsertHousingerProfileHandler.ts`

- `validateUpsertBody()`: `ogBackgroundListingId` が `undefined`/`null`/非空文字列以外なら `invalid_body` 相当のエラーを返す(`ogRepresentativeListingIds` の検証と同じ形)。
- トランザクション内の `next` オブジェクトに `ogBackgroundListingId: v.ogBackgroundListingId !== undefined ? v.ogBackgroundListingId : prev?.ogBackgroundListingId ?? null` を追加。

### 3. マイページ UI

- `src/components/housing/pages/HousingerPage.tsx`:
  - 新規 state `ogBackgroundId: string | null`(初期値は `profile?.ogBackgroundListingId ?? null`)。
  - `handleToggleOgBackground(id)`: 対象が `ogSelectionIds` に含まれない場合は何もしない(ガード)。既に `ogBackgroundId === id` なら解除(`null`)、それ以外なら `id` を設定(=ラジオ的に前の選択を自動で置き換え)。楽観的更新 + 失敗時ロールバックは既存 `handleToggleOgSelect` と同じパターン。
  - `handleToggleOgSelect(id)`: 代表作から外す (`isSelected===true` 側の分岐) 際、`id === ogBackgroundId` なら同じ `upsertHousingerProfile` 呼び出しに `ogBackgroundListingId: null` を含めて一緒に解除する(2回に分けない)。
  - `ListingGrid` へ `backgroundId={isSelf ? ogBackgroundId : undefined}` / `onToggleBackground={isSelf ? handleToggleOgBackground : undefined}` を追加で渡す。
- `src/components/housing/browse/ListingGrid.tsx`: `ListingGridProps` に `backgroundId?: string | null` / `onToggleBackground?: (id: string) => void` を追加し、`ListingCard` へ `isBackground={backgroundId === l.id}` / `onToggleBackground` として forward。
- `src/components/housing/browse/ListingCard.tsx`:
  - Props に `isBackground?: boolean` / `onToggleBackground?: (id: string) => void` を追加。
  - `.housing-listing-card-topleft` 内、既存の `housing-card-select` ボタンの直後に、`selected && onToggleBackground` の時だけ新ボタン(lucide-react の `Image` アイコン、`housing-card-background-select` クラス、`isBackground` なら `is-selected` 相当のハニーゴールド強調)を追加。クリックで `onToggleBackground(listing.id)` を呼ぶ(`e.stopPropagation()` は既存ボタンと同様に必須)。
- `src/styles/housing.css`: `housing-card-select` と並ぶ新トークン/クラス(`housing-card-background-select` 等)を追加。既存の丸ボタンの意匠(サイズ・余白・ホバー)を流用し、選択中のみハニーゴールドで塗る。
- i18n (`src/locales/ja.json` ほか全言語): `housing.housinger.ogSelect.backgroundToggle`(aria-label、例: 「背景にも使う」)を追加。既存 `housing.housinger.ogSelect.hint` の文言に、背景選択についての一文を追記する(例: 「選んだカードの🖼アイコンで、その1枚を背景にも使えます」)。

### 4. `api/share/_housingerPageHandler.ts`

- `listingImageArrays` の構築を `string[][]` から `{ id: string; images: string[] }[]` に変更(2つの分岐 `selectedIds.length > 0` / フォールバック新着順、いずれも listing の doc id を保持するよう修正)。
- 配列構築後、`profile.ogBackgroundListingId` が文字列であり、かつ `listingImageArrays` 内に同じ `id` を持つ要素が存在する場合、その要素を配列の先頭へ移動する(`splice` して `unshift`)。該当なし(未指定/代表作から既に外れている/非公開になった等)の場合は何もしない = 既存の並び順のまま(自動フォールバック、追加のガード不要)。
- 並べ替え後、`.map((e) => e.images)` してから既存の `collectImagesFromListings(images, MAX_CARD_IMAGES)` に渡す(この関数自体は無改修)。

## テストで確認する範囲

- `api/housing/__tests__/upsertHousingerProfile.test.ts`: `ogBackgroundListingId` のバリデーション(不正値拒否/undefined時は現状維持/null時は明示的に解除)。
- `api/share/__tests__/_housingerPageHandler.test.ts`: `ogBackgroundListingId` が代表作内の1件と一致する場合に画像配列の先頭が入れ替わること、一致しない(存在しない/対象外)場合は並び替えが起きないこと。
- `src/__tests__/housing/HousingerPage.test.tsx`: 背景トグルの表示条件(代表作選択済みのカードのみ)、クリックでの排他選択(ラジオ的挙動)、代表作解除時の連動解除。
- `src/components/housing/browse/__tests__/ListingCard.test.tsx`: `isBackground`/`onToggleBackground` 有無によるボタン表示・クリック時コールバック呼び出し。

## スコープ外

- 個々の物件(listing)が複数枚持つ画像の中から「どの1枚を代表画像にするか」を選ぶ機能(現状どおり `listingRepresentativeImages()` の固定優先順位のまま)。
- 背景画像専用のクロップ/明るさ調整などの画像加工。
- grid/sidebar パターンの選択(既存の別実装、本タスクの対象外)。

## 参照

- `docs/.private/2026-08-01-ogp-card-design-mockups.md`(OGPカードデザイン刷新の経緯・2026-08-03追記1〜3)
- `docs/superpowers/specs/2026-07-31-housinger-ogp-card-redesign-design.md`(代表作選択の元設計)
