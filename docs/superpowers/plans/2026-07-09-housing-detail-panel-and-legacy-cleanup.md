# ハウジング詳細「大パネル1枚」化＋旧UI一掃＋編集一本化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 物件詳細をシェル内「大パネル1枚」ページへ統合（地図付き）し、旧ワークスペースUIを一掃し、編集も新フォームへ一本化する。

**Architecture:** 詳細は既に `/housing/listing/:id` へフルページ遷移している（カードクリック）。この route をシェル子ルートへ移し、`HousingDetailModalRoute` のオーケストレーションを共有 hook へ抽出して `HousingDetailPage` に載せ、`HousingDetailContent` を大パネルレイアウト＋地図（`HousingDetailMap`＝ツアー機構流用）で描画する。モーダル/フルページ二本立てと旧ワークスペース経路を撤去。編集は `RegisterPage` を `mode='edit'` 対応にして大パネルページ化し、旧フォーム一式を撤去。

**Tech Stack:** React 18 + React Router v6 + Zustand + Firebase Firestore + vitest + i18next。ハウジング独自トンマナ（`src/styles/housing.css` の `--housing-*` トークン）。

## Global Constraints

- **言語**: UI 文字列は必ず i18n キー経由（`.claude/rules/i18n.md`）。4言語（ja/en/ko/zh）parity 維持。
- **ハウジング独自トンマナ**: 白黒のみ/Inter禁止 等の LoPo ルールは**適用外**。`src/components/housing/**` と `housing.css` は `--housing-*` トークン経由・ハードコード禁止（色/px/影/寸法。`.claude/rules/housing-design.md`）。
- **ユーザーデータ = ゼロ**: ハウジング登録データは全て本人テスト（[[feedback_housing_data_disposable]]）。データ損失リスクなし。**軽減表（本体）は絶対に触らない**。
- **push 前必須**: `npm run build`（Vercel は tsc -b 厳密・未使用import/型不足で落ちる）＋ `npx vitest run`（[[feedback_vercel_tsc_strict]]）。
- **vitest 安全実行**: `npx vitest run <path>` で単体実行。出力をパイプしない（[[reference_vitest_vmthreads_hang]]）。
- **削除は葉→根**。各削除後に build ゲート。
- **DEV 専用ルート `/housing/dev/*` は撤去対象外**（残す）。
- **コミット末尾**: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

---

# Phase 1: 旧UI一掃（掃除）

> このフェーズ完了時点で「探す/お気に入り/ツアー/登録/詳細（現状のまま）」は全部動く。旧ワークスペース経路（隠しURL）だけが消える。編集フロー（`HousingRegisterView` 等）は P3 まで温存。

## Task 1.1: 死にコード `HousingCardExpanded` 削除

**Files:**
- Delete: `src/components/housing/workspace/HousingCardExpanded.tsx`
- Modify: `src/components/housing/workspace/index.ts`（`HousingCardExpanded` の export 行を削除）
- Modify: `src/styles/housing.css`（`.housing-card-expanded` セレクタブロックを削除）

**Interfaces:**
- Consumes: なし（import 0 の dead code）。
- Produces: なし。

- [ ] **Step 1: dead 確認**

Run: `npx rg -n "HousingCardExpanded" src`
Expected: `workspace/HousingCardExpanded.tsx` 自身と `workspace/index.ts` の export 行のみ（他の参照ゼロ）。もし他があれば停止して報告。

- [ ] **Step 2: ファイル削除 + barrel export 削除**

`HousingCardExpanded.tsx` を削除。`workspace/index.ts` から `export { HousingCardExpanded } ...` の行を削除。

- [ ] **Step 3: CSS 削除**

`housing.css` を開き `.housing-card-expanded` で始まるセレクタのルールブロックのみ削除（他セレクタは残す）。

- [ ] **Step 4: build + test**

Run: `npm run build`
Expected: 成功（型エラー0）。
Run: `npx vitest run src/components/housing src/__tests__/housing`
Expected: PASS（緑）。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore(housing): 死にコード HousingCardExpanded を撤去

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 1.2: 旧ワークスペース経路の撤去（App.tsx ルート + 木の削除）

**Files:**
- Modify: `src/App.tsx`（旧ルート3本 + import を削除）
- Delete（葉→根の順）: `src/components/housing/workspace/MapBubbleCard.tsx` → `MapView.tsx` → `PinterestView.tsx` → `HousingCard.tsx` → `CenterArea.tsx` → `RightPanel.tsx` → `TopBar.tsx` → `TourBuilderItem.tsx` → `TourBuilderPane.tsx` → `FavoritesListPane.tsx` → `FavoritesModal.tsx` → `HousingWorkspace.tsx` → `src/components/housing/HousingPage.tsx`
- Delete: 上記各コンポーネントに対応する `__tests__/*.test.tsx`（例 `TopBar.test.tsx` / `CenterArea.test.tsx` / `RightPanel.test.tsx` / `PinterestView` 参照の `routes.test.tsx`・`CenterArea.test.tsx`・`HousingWorkspace.test.tsx`・`tourRouteAutoEnter.test.tsx`・`a11y.test.tsx`・`FavoritesModal.test.tsx`・`FavoritesListPane.test.tsx`・`TourBuilderPane.test.tsx`）
- Modify: `src/components/housing/workspace/index.ts`（上記の export 行を削除）
- Modify: `src/components/housing/index.ts`（`HousingPage` export があれば削除）
- Modify: `src/styles/housing.css`（旧UI固有セレクタのみ削除: `.housing-top` / `.housing-bubble-card` / `.housing-view-mode-toggle` 等。**`--housing-*` トークン・`.housing-panel`・`.housing-register-modal-*`・`.housing-workspace`（新旧共有）は削除禁止**）

**Interfaces:**
- Consumes: これらは `/housing/legacy`・`/housing/p/:id`・`/housing/tour/:tourId`（App.tsx:114,128-129）からのみ到達。撤去でこれら URL は catch-all（`/` リダイレクト）に落ちる。
- Produces: なし。

- [ ] **Step 1: App.tsx から旧ルート + import を削除**

`src/App.tsx` の以下を削除:
- 行114 `<Route path="/housing/legacy" element={<HousingPage />} />`
- 行128-129 `<Route path="/housing/p/:listingId" .../>` と `<Route path="/housing/tour/:tourId" .../>`（直上のコメント `{/* 旧ワークスペース ... */}` も）
- 冒頭の `import { HousingPage, HousingWorkspace } from './components/housing';`（※他に `HousingPage`/`HousingWorkspace` 参照が無いことを `rg` で確認してから）

- [ ] **Step 2: 依存の葉から順にファイル + テスト削除**

各ファイルを削除する前に `npx rg -n "<ComponentName>" src` で「削除対象外（LIVE）からの参照が無い」ことを確認しながら、Files に列挙した順（葉→根）で `.tsx` と対応 `__tests__` を削除。`workspace/index.ts` の該当 export 行も都度削除。

> 注意（残す）: `HousingCardAmbientSlideshow` / `HousingCardVideoOverlay` は LIVE（browse/tour）。`HousingRegisterModal`（workspace）/ `HousingRegisterView` は編集で LIVE（P3 まで残す）。これらは**削除しない**。

- [ ] **Step 3: CSS の旧UI固有セレクタ削除**

`housing.css` で旧UI専用クラス（`.housing-top`, `.housing-bubble-card`, `.housing-view-mode-toggle` 等）を `rg` で当該コンポーネント名の痕跡と突き合わせて削除。判断に迷うセレクタ（共有の可能性）は残す。

- [ ] **Step 4: build + test（型エラーで漏れを検出）**

Run: `npm run build`
Expected: 成功。もし「未使用 import」「見つからないモジュール」エラーが出たら、それが消し漏れ/消しすぎ。App.tsx や barrel の残骸を修正。
Run: `npx vitest run`
Expected: PASS。削除したコンポーネントの test が残っていれば「モジュールが見つからない」で赤 → その test ファイルを削除。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore(housing): 旧ワークスペース経路一式を撤去(legacy/p/tour route + workspace tree)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 1.3: 旧「作成」フォーム撤去（HousingRegisterForm / HousingRegisterFormModal）

**Files:**
- Delete: `src/components/housing/register/HousingRegisterFormModal.tsx` → `src/components/housing/register/HousingRegisterForm.tsx`
- Delete: 対応 `__tests__`（`HousingRegisterForm.test.tsx` / `HousingRegisterFormModal.test.tsx`）
- Modify: barrel（`register/index.ts` 等）に export があれば削除

**Interfaces:**
- Consumes: `HousingRegisterFormModal` は Task 1.2 で消えた `HousingPage`/`HousingWorkspace` からのみ使われていた。`HousingRegisterForm` は `HousingRegisterFormModal` からのみ。
- Produces: なし。

- [ ] **Step 1: 参照確認**

Run: `npx rg -n "HousingRegisterFormModal|HousingRegisterForm\b" src`
Expected: 自身とテストのみ（Task 1.2 後は他の参照なし）。他があれば停止。
> **区別**: `HousingRegisterForm`（旧作成フォーム・削除対象）と `HousingRegisterView`（編集で LIVE・残す）は別物。混同しない。

- [ ] **Step 2: 削除**

`HousingRegisterFormModal.tsx` → `HousingRegisterForm.tsx` とテストを削除。barrel の export を削除。

- [ ] **Step 3: build + test**

Run: `npm run build`
Expected: 成功。
Run: `npx vitest run src/components/housing`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore(housing): 旧作成フォーム(HousingRegisterForm/Modal)を撤去

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase 2: 詳細＝シェル内「大パネル1枚」ページ（地図付き）

> 完了時点で: カード/共有URL/通知 の全経路が同一の大パネル詳細ページに着地。モーダル/フルページ二本立て撤去。地図表示追加。

## Task 2.1: `HousingDetailMap` コンポーネント（ツアー地図の1軒流用）

**Files:**
- Create: `src/components/housing/listing/HousingDetailMap.tsx`
- Test: `src/components/housing/listing/__tests__/HousingDetailMap.test.tsx`

**Interfaces:**
- Consumes（既存・`pages/TourNavPage.tsx:10-13,71-103` と同じ）:
  - `resolveWardMapRef(area: string, plot: number|null, apartmentBuilding: string|null, buildingType): { mapKey: string, ... } | null`（`lib/housing/resolveWardMapRef`）
  - `useWardMapAsset(mapKey: string|null): { status: 'idle'|'loading'|'ready'|'error', svg, json }`（`lib/housing/useWardMapAsset`）
  - `buildTourMapPlacements(json, mapKey, mapRef, listing, steps, currentIndex)`（`lib/housing/buildTourMapPlacements`）
  - `getPlotDirections(area, plot)`（`lib/housing/wardDirections`）
  - `TourNavMap`（`components/housing/tour/TourNavMap`）
- Produces: `HousingDetailMap: React.FC<{ listing: HousingListing }>` — 地図が引ければ `TourNavMap` を描画、引けなければ `null` を返す。

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// __tests__/HousingDetailMap.test.tsx
import { render } from '@testing-library/react';
import { HousingDetailMap } from '../HousingDetailMap';
import type { HousingListing } from '../../../../types/housing';

// TourNavMap をスタブ化して「呼ばれたか」だけ観測
vi.mock('../../tour/TourNavMap', () => ({
  TourNavMap: (p: { status: string }) => <div data-testid="tour-nav-map" data-status={p.status} />,
}));
// mapRef が引けないケース: resolveWardMapRef が null
vi.mock('../../../../lib/housing/resolveWardMapRef', () => ({
  resolveWardMapRef: () => null,
}));

it('mapRef 引けない物件では何も描画しない(null)', () => {
  const listing = { id: 'x', area: 'Unknown', plot: null, buildingType: 'house' } as unknown as HousingListing;
  const { queryByTestId } = render(<HousingDetailMap listing={listing} />);
  expect(queryByTestId('tour-nav-map')).toBeNull();
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `npx vitest run src/components/housing/listing/__tests__/HousingDetailMap.test.tsx`
Expected: FAIL（`HousingDetailMap` 未定義）。

- [ ] **Step 3: 実装**

`pages/TourNavPage.tsx:71-103` の地図配線を 1 軒用に写す。`steps=[{ listing, ... }]` 相当は `buildTourMapPlacements` が要求する形に合わせる（TourNavPage が `steps`/`currentIndex=0..` に渡しているのと同じ引数を、この 1 軒だけの `steps` で渡す）。実装例の骨子:

```tsx
import { useMemo } from 'react';
import type { HousingListing } from '../../../types/housing';
import { resolveWardMapRef } from '../../../lib/housing/resolveWardMapRef';
import { useWardMapAsset } from '../../../lib/housing/useWardMapAsset';
import { buildTourMapPlacements } from '../../../lib/housing/buildTourMapPlacements';
import { getPlotDirections } from '../../../lib/housing/wardDirections';
import { TourNavMap } from '../tour/TourNavMap';

export const HousingDetailMap: React.FC<{ listing: HousingListing }> = ({ listing }) => {
  const directions = useMemo(() => getPlotDirections(listing.area ?? '', listing.plot), [listing]);
  const mapRef = useMemo(
    () => resolveWardMapRef(listing.area, listing.plot ?? null, listing.apartmentBuilding ?? null, listing.buildingType),
    [listing],
  );
  const asset = useWardMapAsset(mapRef?.mapKey ?? null);
  // TourNavPage と同じ: この 1 軒だけを steps に、currentIndex=0。
  const steps = useMemo(() => [{ listing }], [listing]);
  const model = useMemo(
    () => (asset.status === 'ready' && mapRef ? buildTourMapPlacements(asset.json, mapRef.mapKey, mapRef, listing, steps as never, 0) : null),
    [asset, mapRef, listing, steps],
  );
  if (!mapRef) return null; // 引けない物件は地図ブロックごと非表示
  const status = asset.status === 'ready' ? 'ready' : asset.status === 'error' ? 'error' : 'loading';
  return (
    <TourNavMap
      status={status}
      svg={asset.status === 'ready' ? asset.svg : null}
      viewBox={asset.status === 'ready' ? asset.json.viewBox : null}
      model={model}
      stepKey={0}
      originName={directions?.aetheryte ?? model?.originName ?? null}
    />
  );
};
```

> 実装前に `pages/TourNavPage.tsx:71-103` と `TourNavMap` の props（`status/svg/viewBox/model/stepKey/originName`）を実ファイルで確認し、`buildTourMapPlacements`/`resolveWardMapRef` の実シグネチャに厳密に合わせること（上記は骨子・型は現物に合わせる）。`steps` の要素形状は `lib/housing/tourNav.ts` の `TourStep` に合わせる（`{ listing, ... }` の実フィールド確認）。

- [ ] **Step 4: テストが通るのを確認**

Run: `npx vitest run src/components/housing/listing/__tests__/HousingDetailMap.test.tsx`
Expected: PASS。

- [ ] **Step 5: build + Commit**

Run: `npm run build` → 成功。
```bash
git add -A && git commit -m "feat(housing): 詳細用 HousingDetailMap(ツアー地図を1軒流用)を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 2.2: 詳細オーケストレーションを共有 hook `useHousingDetail` へ抽出

**Files:**
- Create: `src/components/housing/listing/useHousingDetail.ts`
- Test: `src/components/housing/listing/__tests__/useHousingDetail.test.tsx`（`HousingDetailModalRoute` の既存テストがあれば流用/移植）
- Reference（写す元）: `src/components/housing/listing/HousingDetailModalRoute.tsx:35-280`

**Interfaces:**
- Consumes: `getDoc`/`canViewListing`/`findListingsByAddressKey`/`purgeIfTweetGone`/`useHousingDelete`/`useResolveReport`/`useNotifications`/`firestoreToGalleryListing`/`useHousingListingsStore`（すべて `HousingDetailModalRoute` が現在 import しているもの）。
- Produces: `useHousingDetail(listingId: string|undefined): { listing, notFound, peers, hasDuplicates, reportNotice, refreshAfterChange, onConfirmDelete, onListingDeleted, viewerUid }` — `HousingDetailModalRoute` が state/handler として持っていたものを丸ごと返す hook。編集は「route へ navigate」に変わるため `editOpen` state は返さない（後述 Task 3.3 で `onEdit = () => navigate(edit)` に置換）。

- [ ] **Step 1: `HousingDetailModalRoute` のロジックを hook へ機械移送**

`HousingDetailModalRoute.tsx:35-280` の state（`listing/notFound/notification/hasDuplicates/peers`）・effect（`loadListing`/peers 取得/notification 取得/notFound toast/tweet purge）・handler（`refreshAfterChange`/`onDispute`/`onDismiss`/`handleListingSaved`/`onConfirmDelete`/`onListingDeleted`/`reportNotice` 構築）を **挙動を変えずに** `useHousingDetail.ts` へ移す。`close = navigate(-1)` は呼び出し側に残し、hook は `navigate` を受けない純データ+アクションに寄せる（`notFound` 時の toast+戻るは呼び出し側 effect で行う）。`onEdit` は Task 3.3 まで暫定で「編集モーダルを開く」を返してよい（P2 完了時点では編集は従来どおりモーダルで動く）。

> **重要（挙動不変）**: 移送のみ。ロジックの新規実装・分岐追加はしない。既存の `HousingDetailModalRoute` のテストがあれば hook 版に張り替えて緑を維持。

- [ ] **Step 2: build + test**

Run: `npm run build` → 成功。
Run: `npx vitest run src/components/housing/listing`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "refactor(housing): 詳細のデータ/アクションを useHousingDetail hook へ抽出(挙動不変)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 2.3: `HousingDetailPage` を大パネル司令塔に再構成 + ルートをシェルへ移設 + モーダル撤去

**Files:**
- Modify: `src/components/housing/listing/HousingDetailPage.tsx`（`useHousingDetail` を使い、`HousingDetailContent` + `HousingDetailMap` + 「← 戻る」を大パネルで描画。body-overflow 解禁は撤去＝シェル内スクロールに合わせる）
- Modify: `src/App.tsx`（route `/housing/listing/:listingId` を**シェル子ルートへ移動**＝105-113 の中へ。行131 の旧位置を削除。overlay Routes ブロック 160-167 を削除。`backgroundLocation` 機構＝82-83,94 の `location.state` 参照を撤去し `<Routes location={location}>` に単純化。import `HousingDetailModalRoute` を削除）
- Modify: `src/components/housing/notifications/NotificationItem.tsx:51-52`（`state={{ backgroundLocation: location }}` を削除。`to` はそのまま `/housing/listing/:id?notification=:id`。`useLocation` が不要になれば import も削除）
- Delete: `src/components/housing/listing/HousingDetailModal.tsx` / `HousingDetailModalRoute.tsx` / `HousingDetailLayout.tsx` ＋ 対応テスト
- Modify: barrel（`listing/index.ts` 等）から削除分の export を削除

**Interfaces:**
- Consumes: `useHousingDetail`（Task 2.2）、`HousingDetailMap`（Task 2.1）、`HousingDetailContent`（既存）。
- Produces: シェル子ルート `/housing/listing/:listingId` → 大パネル詳細。

- [ ] **Step 1: HousingDetailPage を再構成**

`HousingDetailPage` から `useHousingDetail(listingId)` を呼び、`state.kind` 相当（loading/not_found/error/ok）を hook の `listing/notFound` から導く。ok 時に「← 戻る」（`navigate(-1)` か `Link to="/housing"`）＋ `HousingDetailContent`（`peers/hasDuplicates/reportNotice/onListingUpdated/onDeleted/onPeerHidden` を hook から接続）＋ `HousingDetailMap listing={listing}` を大パネルレイアウトで描画。**body-overflow 解禁 effect（現行 38-47 行）は削除**（シェルがスクロールを管理）。ルート要素は現行の `housing-detail-fullpage housing-workspace...` から**大パネル用クラス**（Task 2.4 で定義する `housing-detail-panel` 等）へ。

- [ ] **Step 2: App.tsx ルート移設 + モーダル撤去**

- `<Route path="/housing/listing/:listingId" element={<HousingDetailPage />} />` を**シェルの子**（105-113 内、`register` の隣など）へ移動。旧行131を削除。
- overlay ブロック（160-167）と `backgroundLocation` 参照（82-83、94の `location=` 引数）を削除 → `<Routes location={location}>`。
- `import { HousingDetailModalRoute }`（行17）を削除。

- [ ] **Step 3: NotificationItem の backgroundLocation 撤去**

`NotificationItem.tsx:52` の `state={{ backgroundLocation: location }}` を削除。通知タップは通常遷移で `/housing/listing/:id?notification=:id` へ（シェル詳細ページが `?notification` を hook 経由で処理）。

- [ ] **Step 4: モーダル系ファイル削除**

`HousingDetailModal.tsx` / `HousingDetailModalRoute.tsx` / `HousingDetailLayout.tsx` と対応テストを削除。barrel export を削除。

- [ ] **Step 5: build + test**

Run: `npm run build`
Expected: 成功（未使用 import / 見つからないモジュールが無いこと）。
Run: `npx vitest run`
Expected: PASS。削除した Modal/Layout の test が残っていれば削除。ルート系テスト（`routes.test.tsx` 等）で backgroundLocation 前提のものは新挙動（通常遷移）へ更新。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(housing): 詳細をシェル内大パネル1枚ページへ統合(モーダル/フルページ二本立て撤去)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 2.4: 大パネルレイアウト + 地図配置（CSS・トークン経由）

**Files:**
- Modify: `src/components/housing/listing/HousingDetailContent.tsx`（地図スロットを追加。ワイド=左:ギャラリー+地図/右:情報+操作+peers、狭:縦積み。地図は `HousingDetailMap` を配置するだけ＝フック汚染しない）
- Modify: `src/styles/housing.css`（`.housing-detail-*` を大パネル用に再設計。既存 `.housing-detail-content` グリッドを更新 or `.housing-detail-panel` を新設。**全て `--housing-*` トークン経由**）
- Reference: 現行 `.housing-detail-content` / `.housing-detail-gallery` / `.housing-detail-info` の CSS を `housing.css` で先に確認

**Interfaces:**
- Consumes: `HousingDetailMap`（Task 2.1）。
- Produces: 大パネル詳細の見た目。

- [ ] **Step 1: 現行 CSS 確認**

Run: `npx rg -n "housing-detail-(content|gallery|info|fullpage|panel)" src/styles/housing.css`
現行のグリッド定義を把握してから改修（既存を活かして大パネル用に更新）。

- [ ] **Step 2: HousingDetailContent に地図スロット追加**

`HousingDetailContent` の JSX に地図領域を追加。左カラム（ビジュアル）に `<HousingDetailMap listing={listing} />` を配置（ギャラリーの下）。右カラムに情報+ActionBar+peers。レイアウトは CSS クラスで制御（JSX は構造のみ）。`HousingDetailMap` が `null` を返す物件では地図領域が消えてもレイアウトが崩れないようにする（グリッドの `auto` 行 or 条件付きラッパ）。

- [ ] **Step 3: housing.css 大パネルレイアウト**

`.housing-detail-*` を「大パネル1枚（探す/ツアーと同じシェル面）」に。ワイド（`md` 以上）は2カラム grid（左=ギャラリー+地図 / 右=情報+操作+peers）、狭は単一カラム縦積み。色/寸法/影/角丸は `--housing-*` トークン経由（新規トークンが要れば `housing.css` の `.housing-workspace` ブロック上部に追加）。**ハードコード禁止**（実装後 `rg "#[0-9a-f]{3,8}|rgba?\(|[0-9]+px" 当該追加分` で自己チェック）。

- [ ] **Step 4: build + test + 実機**

Run: `npm run build` → 成功。
Run: `npx vitest run src/components/housing/listing` → PASS。
**実機確認（ユーザー）**: 開発者の実画面（CSS 1489 / DPR 2.58）で HMR 確認。カード→詳細大パネル遷移、地図表示、← 戻る、狭画面の縦積みを目視（[[feedback_no_screenshots_local_verify]]）。地図が引けない物件（例アパート/未対応エリア）で崩れないこと。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(housing): 詳細大パネルのレイアウト(左ギャラリー+地図/右情報)をトークン経由で実装

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase 3: 編集フォーム一本化（方式A・編集も大パネルページ化）

> ハウジングのユーザーデータはゼロ＝データ保全テスト不要。機能テストで担保。P2 完了後に着手（編集導線は詳細ページから入るため）。

## Task 3.1: `RegisterPage` を `mode`/`initialValues` 対応（プリフィル）

**Files:**
- Modify: `src/components/housing/pages/RegisterPage.tsx`（`mode: 'create'|'edit'` と `initialValues?: HousingListing` を props 追加。edit 時は各 state（address/tags/description/title/visibility/publishUntil/sourceImageUrls 等）を initialValues から初期化。create 挙動は不変＝加算的）
- Test: `src/components/housing/pages/__tests__/RegisterPage.test.tsx`（既存に edit プリフィルの test を追加）
- Reference: 編集で現在使う `HousingRegisterView`（`register/HousingRegisterView.tsx`）の初期化ロジック（何をどう prefill しているか）を写す元にする

**Interfaces:**
- Consumes: 既存 `RegisterPage` の state 群（`address/tags/description/title/visibility/publishUntil/localImages/sourceImageUrls/snsCapture`＝RegisterPage.tsx:622 の依存リスト参照）。
- Produces: `RegisterPage({ mode?, initialValues? })`。`mode` 既定 `'create'`。

- [ ] **Step 1: プリフィルの失敗テスト**

```tsx
// RegisterPage.test.tsx（追加）
it('mode=edit で initialValues が住所/紹介文/公開範囲へプリフィルされる', () => {
  const listing = { id: 'l1', dc:'Meteor', server:'Ramuh', area:'LavenderBeds', ward:29, plot:3, buildingType:'house', size:'L', description:'テスト紹介文', tags:['お茶会'], visibility:'public', sourceImageUrls:['https://x/a.jpg'] } as unknown as HousingListing;
  renderRegisterPage({ mode: 'edit', initialValues: listing }); // 既存テストの render helper に mode/initialValues を通す
  expect(screen.getByDisplayValue('テスト紹介文')).toBeInTheDocument();
  // 住所/公開範囲/タグの反映も同様に assert（既存 test の getter に合わせる）
});
```

- [ ] **Step 2: FAIL 確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: FAIL（props 未対応 / prefill されない）。

- [ ] **Step 3: 実装（prefill・加算的）**

`RegisterPage` に `mode`/`initialValues` props を追加。`useState` の初期値を `initialValues` から導く（`HousingRegisterView` の edit 初期化を写す）。SNS/画像は `sourceImageUrls` を初期表示、address は `{dc,server,area,ward,plot,buildingType,roomKind,size}` を反映。**create（initialValues 無し）は現状の初期値のまま**。

- [ ] **Step 4: PASS 確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: PASS。

- [ ] **Step 5: build + Commit**

Run: `npm run build` → 成功。
```bash
git add -A && git commit -m "feat(housing): RegisterPage を mode/initialValues 対応(編集プリフィル)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 3.2: 編集保存（`useHousingUpdate` 接続）+ 文言

**Files:**
- Modify: `src/components/housing/pages/RegisterPage.tsx`（`performRegister`/`handleSubmit` を mode 分岐。edit は更新 API を呼び、保存後は詳細へ戻る＋一覧同期。主ボタン文言を edit 時「保存する」に）
- Reference: `src/components/housing/edit/useHousingUpdate.tsx`（`HousingRegisterView` が使う更新 hook。シグネチャを現物で確認して同じ呼び方で接続）
- Test: `RegisterPage.test.tsx`（edit 保存が update を呼ぶ・保存後 navigate を確認）

**Interfaces:**
- Consumes: `useHousingUpdate`（現物のシグネチャに従う）、`useHousingListingsStore`（`fetchAndUpsert`/`loadMine`＝RegisterPage.tsx:656-657 と同じ）。
- Produces: edit 保存フロー。

- [ ] **Step 1: 保存分岐の失敗テスト**

```tsx
it('mode=edit の主アクションで update が呼ばれ、保存後に詳細へ戻る', async () => {
  const update = vi.fn().mockResolvedValue({ ok: true });
  // useHousingUpdate をモック（現物の返り値形に合わせる）
  renderRegisterPage({ mode:'edit', initialValues: editableListing });
  await clickPrimaryAction(); // 既存 test の submit ヘルパ
  expect(update).toHaveBeenCalled();
  expect(navigateMock).toHaveBeenCalledWith(`/housing/listing/${editableListing.id}`);
});
```

- [ ] **Step 2: FAIL 確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 実装**

`performRegister`/`handleSubmit` に `mode==='edit'` 分岐を追加。edit は `registerListing` の代わりに `useHousingUpdate` の更新関数を `initialValues.id` + draft で呼ぶ（`HousingRegisterView` の保存経路を写す）。成功時: `fetchAndUpsert(id)` + `loadMine` + `navigate('/housing/listing/'+id)`（詳細へ戻る）。主ボタン文言は `mode==='edit'` で `housing.edit.*`（既存の編集文言 i18n キーを流用）。重複チェック（`checkDuplicate`）は edit ではスキップ（自分自身が重複扱いになるため）。

- [ ] **Step 4: PASS 確認 + build**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx` → PASS。
Run: `npm run build` → 成功。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(housing): RegisterPage の編集保存(useHousingUpdate接続+保存後詳細へ)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

## Task 3.3: 編集ルート追加 + 詳細の編集導線を route へ + 旧編集フォーム撤去

**Files:**
- Modify: `src/App.tsx`（シェル子に `<Route path="listing/:listingId/edit" element={<RegisterPage mode="edit" .../>} />` を追加。ただし `initialValues` は listing 取得が要る → 編集ページ用の薄いラッパ `HousingEditPage`（getDoc して `RegisterPage mode=edit initialValues` を描画）を用意するのが素直）
- Create: `src/components/housing/pages/HousingEditPage.tsx`（`useHousingDetail` or getDoc で listing を読み、`<RegisterPage mode="edit" initialValues={listing} />` を大パネルで描画。取得不可は詳細と同じ not_found 処理）
- Modify: 詳細の「編集」導線（`HousingActionBar`（kebab の編集）と `useHousingDetail` の `reportNotice.onEdit`）を、モーダルを開く代わりに `navigate('/housing/listing/'+id+'/edit')` に変更
- Delete: `src/components/housing/edit/HousingEditModal.tsx` / `src/components/housing/workspace/HousingRegisterModal.tsx` / `src/components/housing/register/HousingRegisterView.tsx` ＋ 各テスト
- Modify: barrel export（`workspace/index.ts` の `HousingRegisterView`/`HousingRegisterModal`、他）を削除。`housing.css` の**編集モーダル専用**セレクタ（`.housing-register-modal-*` のうち編集モーダルでしか使わないもの）を削除（作成フォームと共有なら残す＝要 `rg` 確認）

**Interfaces:**
- Consumes: `RegisterPage`（Task 3.1/3.2）。
- Produces: シェル子ルート `/housing/listing/:listingId/edit`。旧編集フォーム一式の撤去。

- [ ] **Step 1: HousingEditPage + ルート**

`HousingEditPage.tsx` を作成（listing を getDoc・家主のみ編集可の gate は既存 `canViewListing`＋オーナー判定に合わせる）。App.tsx シェル子に `listing/:listingId/edit` を追加。

- [ ] **Step 2: 詳細の編集導線を route 遷移へ**

`HousingActionBar`（編集ボタン/kebab）と `useHousingDetail` の `onEdit` を `navigate` に変更。`HousingEditModal` の open は使わない。

- [ ] **Step 3: 旧編集フォーム撤去**

`HousingEditModal` / `workspace/HousingRegisterModal` / `HousingRegisterView` とテストを削除。参照を `rg` で確認（Step 1-2 後は残っていないはず）。barrel と編集専用 CSS を削除。

- [ ] **Step 4: build + test + 実機**

Run: `npm run build` → 成功。
Run: `npx vitest run` → PASS（削除した編集フォームのテストは撤去、編集導線テストは新挙動へ更新）。
**実機（ユーザー）**: ログインして自分の物件の詳細 → 編集 → `/edit` 大パネルでプリフィル → 変更 → 保存 → 詳細へ戻り反映、を1周（[[feedback_endpoint_user_verification]]）。通報バナー経由の編集導線も確認。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(housing): 編集も大パネルページ化し旧編集フォーム(View/Modal/EditModal)を撤去

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# 最終チェック

- [ ] `npm run build` 全緑 / `npx vitest run` 全緑。
- [ ] `npx rg -n "HousingWorkspace|HousingCardExpanded|HousingRegisterView|HousingRegisterForm\b|HousingDetailModal|backgroundLocation" src` が**ヒット0**（撤去完了の確認）。
- [ ] 実機: カード/共有URL/通知 の3経路が同一の大パネル詳細に着地・地図表示・編集1周（ユーザー確認）。
- [ ] `docs/TODO.md`「現在の状態」更新 + 完了分を TODO_COMPLETED へ。

## 実行メモ（マルチエージェント配分・ユーザー要望）
- **P1（掃除）**: 機械的・安価モデル(haiku)で高速に。ただし削除ごとの build/test ゲートは厳守（型エラーが消し漏れ検出器）。共有ファイル（App.tsx/housing.css/workspace/index.ts）は**同時並列編集しない**（1エージェント逐次 or worktree 分離）。
- **P2（詳細）**: 中〜上位モデル。Task 2.1→2.2→2.3→2.4 は逐次依存。
- **P3（編集）**: 中位モデル＋機能テスト。P2 完了後。
- 各フェーズ末で緑を確認してから次へ（常に出荷可能点を維持）。
