# ハウジング ギャラリー一覧 実 Firestore 連携 設計書

- **日付**: 2026-05-21
- **対象**: `/housing` ワークスペースの物件一覧（Pinterest ビュー / マップビュー）
- **目的**: 一覧のデータ源を mock（`MOCK_LISTINGS` 50 件）から本番 Firestore `housing_listings` に付け替える
- **前提**: Phase 3（詳細表示・通報・通知・編集削除）は実装済で、いずれも実 Firestore doc 前提で動作する（実機確認済: 実 doc `koefEkmi4ENVJ0R8UC1G` で詳細ページ正常描画）。一覧だけが mock のままで分断されているため、E2E が動かない

---

## 1. 背景と問題

- 一覧コンポーネント（`CenterArea` → `PinterestView` / `MapView` / `HousingCard`）は `src/data/housing/mockListings.ts` の `MOCK_LISTINGS`（型 `MockListing`）を**直接 import** している。
- 詳細ルート（`HousingDetailPage` / `HousingDetailModalRoute`）は Firestore `housing_listings/{id}` を `getDoc` で取得する。
- mock の id は `mock-001`〜`mock-050` で Firestore に存在しないため、カードを押すと `notFound` → 一覧へバウンス。Phase 3 UI が一切表示されない（実機確認済）。
- 本番 Firestore の実物件は現在 **1 件**（`koefEkmi4ENVJ0R8UC1G`, Materia/Bismarck, LavenderBeds 23-6, house, imageMode=none, 表示中）。

## 2. ゴール / 非ゴール

**ゴール**
- 一覧が Firestore `housing_listings` の実データを表示する。
- カード → 詳細 → 通報/通知/編集/削除 の全フローが実データで繋がる（ログインが要る部分はユーザー操作）。
- loading / 空 / error の各状態を持つ。

**非ゴール**
- **マップビューの実データ配置**。マップは `sampleWardLayout`（mock 位置）前提で、実マップ配置は TODO 既出の Phase 2B 別タスク。**詳細に遷移するのは Pinterest（一覧）ビューのみ**（MapView は CenterArea で noop）なので、E2E 解消には Pinterest ビューだけ実データ化すれば十分。マップビューは本タスクでは現状維持。
- 偽データを本番 Firestore に投入しない（公開リポジトリ衛生・ユーザー誤認回避）。実物件が少なく一覧が疎なのは正しい挙動。
- 無限スクロール / ページネーション（YAGNI、`limit(200)` で当面足りる。将来別タスク）。
- 個室・アパート（roomKind）の一覧上の特別扱い（既存どおりの表示で可）。
- `HousingCardExpanded` の撤去（別タスク。TODO に既出）。

## 3. 型方針: アダプタ方式

一覧コードは `MockListing` 型前提で、これは `region`（JP/NA/EU/OCE）を必須に持つ一方、Firestore の `HousingListing` は `region` を持たず `dc` のみ（`buildingType`/`addressKey`/`isHidden`/`deletedAt`/`reportCount` 等は逆に実型のみ）。

- **`HousingListing → MockListing`（= ギャラリー表示用 view-model）のアダプタ 1 本**を新設し、データ源だけ差し替える。
- `region` は既存 `regionForDC(dc)`（`src/data/housing/dcServerMap.ts`）で導出。マップに無い dc は除外（`null` を弾く）。
- `MockListing` 型は実質「一覧カードの view-model」なので**そのまま型名を流用**（リネームによる広範な import 変更を避ける）。`mockListings.ts` 本体は**テスト用フィクスチャとして残す**（一覧の本番経路からは参照されなくなる）。
- 変換規則:
  - `id, ownerUid, dc, server, area, ward, plot, size, imageMode, postUrl, ogImageUrl, thumbnailPath, tags, description` → そのまま写す
  - `region` ← `regionForDC(dc)`（`null` のレコードは一覧から除外）
  - `createdAt` ← number（`HousingListing.createdAt` は既に number 設計。Firestore Timestamp が来る可能性に備え、`Timestamp` なら `.toMillis()`、number ならそのまま、欠損は `0` にフォールバック）
  - `plot`/`size` が無い（アパート個室等）レコードでも落ちないようにする（`MockListing` 上は必須なので、欠損時の既定値または除外方針をアダプタで明示）。当面は **`plot`/`size` が無いレコードは一覧から除外**（マップ/カードが plot/size 前提のため）。これは非ゴールの個室扱いに踏み込まない安全側の判断。

## 4. クエリ層

`src/lib/housingListingsService.ts` に追加:

```ts
export async function getGalleryListings(max = 200): Promise<HousingListing[]>
```

- `query(collection(db, 'housing_listings'), where('isHidden','==',false), orderBy('createdAt','desc'), limit(max))`
- 取得後、**クライアント側で `deletedAt != null` を除外**（既存 `findHouseForChamber` と同じ client-filter 方式。`deletedAt==null` の二重等値クエリを避け、複合インデックスを軽量に保つ）。
- 必要な複合インデックス: `housing_listings` の `isHidden ASC, createdAt DESC` を `firestore.indexes.json` に追記し `firebase deploy --only firestore:indexes`。

## 5. 取得フック

`src/components/housing/workspace/useGalleryListings.ts`（新設）:

```ts
type GalleryState =
  | { kind: 'loading' }
  | { kind: 'ready'; listings: MockListing[] }
  | { kind: 'error'; message: string };
```

- マウント時に `getGalleryListings()` → アダプタ変換 → `region===null` / `plot`欠損 を除外。
- cancelled ガード（アンマウント時の setState 回避、既存 `HousingDetailPage` と同型）。
- 返り値は state（または `{ listings, loading, error }` に正規化）。

## 6. CenterArea 改修

- **Pinterest（一覧）ビューのみ実データ化**。`useGalleryListings()` を使い、`applyFilters` → `PinterestView` に渡す配列を Firestore 由来に置換。
- **マップビューは現状維持**（`MOCK_LISTINGS` + `sampleWardLayout` で `pickRandomWard` / `listListingsForWard` → `MapView`）。実マップ配置は Phase 2B 別タスク（非ゴール §2）。`MOCK_LISTINGS` import はマップ用に残す。
- Pinterest ビューの表示状態（`useGalleryListings` の `kind` で分岐）:
  - `loading` → ローディング表記（housing.css token 経由 / i18n キー）
  - `error` → エラーメッセージ（i18n キー経由）
  - `ready` かつ取得 0 件 / フィルタ 0 件 → 既存 `EmptyResult`
- 件数表示 `{filtered.length} / {total}` は**アクティブビューに応じて**切替: pinterest=実データ件数、map=`MOCK_LISTINGS.length`（現状維持）。

## 7. i18n

新規文言（loading / error）は i18n キー経由（`ja` 先行、en/ko/zh は ja コピーで追従。既存 housing i18n の慣例どおり）。ハウジングは独自トンマナ・i18n キー必須ルール対象。

## 8. テスト（TDD）

- **アダプタ** `firestoreToGalleryListing`: region 導出（Materia→OCE 等）、Timestamp→number、plot/size 欠損・region null の除外、フィールド写し。
- **`useGalleryListings`**: service をモックし loading→ready / loading→error / 空配列 / 除外フィルタ を検証。
- **`CenterArea`**: `useGalleryListings`（または service）をモックし、Pinterest ビューの loading/error/empty/ready の分岐描画を検証。既存テストのうち **Pinterest のカード枚数を `MOCK_LISTINGS.length` で assert している箇所**（`switches to Pinterest grid`）はモックデータ件数に追従して更新。マップビュー系テスト（bubble 5 件等）は現状維持で無改修。
- 既存 `applyFilters` / `randomWard` / `sortByAddress` テストは `MockListing` フィクスチャのまま有効（無改修）。

## 9. デプロイ / 検証

1. `npm run build` + `vitest run`（housing スイート）通過。
2. `firebase deploy --only firestore:indexes`。
3. ローカル dev で一覧が実物件 1 件を表示 → カードクリックで詳細モーダルが**バウンスせず開く**ことを Playwright で確認（匿名ビューア）。
4. ログインが要る E2E（通報送信 / 通知ベル / 家主編集・削除）は、ユーザー向けクリック手順を別途提示し、ユーザーが 2 アカウントで実施。

## 10. リスク / 留意

- **App Check**: dev で debug token 交換が 403 だが Firestore 読取りは成功している（実機確認済）。書込み系 API は別途 debug token 登録が要る可能性。
- **インデックス未作成時**: 初回クエリが `failed-precondition`（要インデックス）になり得る → デプロイ手順を実装計画に含める。error 状態で握り潰さずメッセージ表示。
- **疎な一覧**: 実物件 1 件のため見た目が寂しい。偽データ投入はしない方針。ユーザーが実 UI から登録して populate する。
