# 探すページ 地図表示モード 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development または superpowers:executing-plans でタスク単位に実行。
>
> spec = `docs/superpowers/specs/2026-07-10-housing-browse-map-design.md` (承認済み・本計画の正)。
> コード断片は 2026-07-10 時点の main を採取済み。行番号は目安。

**Goal:** 探す中央パネルの 一覧 ⇔ 地図 切替。区画マップ上に登録ハウジングの吹き出しミニカードが常時浮かび、hover で探すカードそのものに拡大する。

**Architecture:** 探す専用の新設コンポーネント群 (`BrowseMapView` / `BrowseWardMap` / `MapSpotCard`)。地図素材 (`WARD_MAP_LOADERS` / `useWardMapAsset`) と純関数 (`mapZoom.ts` / `resolveWardMapRef` / `plotToPlacementIn`) は**読み込みのみ流用**し、ツアー側ファイル (`TourNavMap.tsx` 等) は**一切変更しない**。

**Tech Stack:** React + zustand + インラインSVG + CSS transform。追加通信ゼロ (listing は全件クライアント store 済)。

## Global Constraints (全タスク共通)

- 会話・コメント・ドキュメントは日本語。**push 禁止**。`docs/TODO.md` 編集禁止。
- ブランチ: `feat/housing-browse-map`。タスク単位でコミット (`feat(housing): …` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`)。
- `.claude/rules/housing-design.md` を編集前に読む。装飾999pxピル/色付きalert箱/過剰glow禁止。配色は既存 `--housing-*` トークン。
- 新規 UI 文言は「ハウジング」統一。ロケール JSON はブロック単位 textual 編集・**4言語 parity**。
- **ツアー側のファイル (`src/components/housing/tour/**`, `buildTourMapPlacements.ts`, `wardRoute.ts`, `mapZoom.ts`, `resolveWardMapRef.ts`) は import して使うのは可・編集は不可** (spec §2-7)。
- イベント中に `scrollWidth`/`getBoundingClientRect` 連打をしない (コンテナ rect は ResizeObserver でキャッシュ)。
- 検証: `npm run build` + `npx vitest run` (パイプしない) + `npx tsc -b --noEmit`。

## ⚠ 実行前提

- **3 ブランチ (登録改善/タグ刷新/小物UI) の main マージ後に着手** (タグ刷新が `FilterPanel` / 探す周辺を変更しているため)。着手時に BrowsePage / FilterPanel の現状を必ず読み直す。

## 主要な既存部品 (採取済み・そのまま使う)

- `WARD_MAP_LOADERS` (`src/data/housing/wardMapManifest.ts:15`): mapKey = `mist` / `mist-sub` / `goblet` / … 10種。`WardMapJson = { area, viewBox:{w,h}, nodes, edges, houses:[{kind:'plot'|'apart', plot, x, y, node, outline}], roadPath, visibleRoadPath }` (x,y は 0-1 正規化)。
- `useWardMapAsset(mapKey: string | null)` (`src/lib/housing/useWardMapAsset.ts:9`): `idle|loading|ready{json,svg}|error` の判別共用体。
- `resolveWardMapRef(area, plot, apartmentBuilding, buildingType)` (`src/lib/housing/resolveWardMapRef.ts`): listing → mapKey + highlightPlot + highlightKind。**着手時に実装を読むこと** (buildTourMapPlacements.ts:29-32 の `refOf` が使用例)。
- `plotToPlacementIn(json, plot, kind)` / `apartToPlacementIn(json)` (`src/lib/housing/wardRoute.ts:24-33`): → `{x, y, nodeId, outline}` (viewBox px)。
- `MapView` / `applyWheelZoom` / `zoomAt` (`src/lib/housing/mapZoom.ts`): ズーム計算の純関数。
- パン/ピンチの参考実装 = `TourNavMap.tsx:227-286` (pointer events 統一・ピンチ→単指の引き継ぎ)。**コピーして新部品内に書く** (import しない)。
- i18n 既存キー: `housing.browse.view_aria` / `view_list` / `view_map` (`src/locales/ja.json:1950-1960`、4言語存在)。`view_route` は使わない。
- `ListingCard` (`browse/ListingCard.tsx:20-30`): props = `{ listing: MockListing; onAddToTour: (id)=>void; selectable?; selected?; onToggleSelect? }`。
- BrowsePage の中央分岐 (`pages/BrowsePage.tsx:88-104`) と `filtered` (`:46-49`)、トレイ `addToTray` (`:63-65`)。

---

## Task 1: 集計純関数 + 代表画像の共有化

**Files:**
- Create: `src/lib/housing/browseMapSpots.ts`
- Create: `src/lib/housing/representativeImage.ts`
- Modify: `src/components/housing/browse/ListingCard.tsx:32-38` (ローカル `representativeImage`/`PLACEHOLDER` を削除して新モジュールから import。**挙動変更なし**)
- Test: `src/lib/housing/__tests__/browseMapSpots.test.ts`

**Interfaces (Produces):**

```ts
// representativeImage.ts (ListingCard.tsx:32-38 の移設。中身は一字一句同じロジック)
export const LISTING_IMAGE_PLACEHOLDER = '/housing/mock-thumbs/1.svg';
export function representativeImage(l: MockListing): string;

// browseMapSpots.ts
export type WardMapKind = 'main' | 'sub';
export interface BrowseMapSpot {
  key: string;                 // `${kind}:${plot}` (apart は plot=アパートエントリの plot 値)
  kind: 'plot' | 'apart';
  plot: number;                // json.houses と突き合わせる番号
  listings: MockListing[];     // この場所の全件 (lastConfirmedAt desc)
  representative: MockListing; // listings[0]
}
export function selectWardListings(filtered: MockListing[], area: HousingArea, ward: number): MockListing[];
export function groupListingsByMapSpot(wardListings: MockListing[], mapKey: string): BrowseMapSpot[];
export function countListingsByWard(filtered: MockListing[], area: HousingArea): Map<number, number>;
export function countListingsByMapKind(wardListings: MockListing[]): { main: number; sub: number };
export function findInitialWardTarget(filtered: MockListing[]): { area: HousingArea; ward: number } | null; // 最多の住宅街×区。0件なら null
```

**実装要点:**
- グルーピングは各 listing を `resolveWardMapRef(l.area, l.plot ?? null, l.apartmentBuilding ?? null, l.buildingType)` に通し、返る mapKey が引数の mapKey と一致するものだけを `highlightKind` + `highlightPlot` で束ねる (アパートは号棟1/2とも同じ apart スポットに集約 = spec §5.2 建物1点粒度)。
- ref が null / 解決不能な listing はスキップ (console.warn、クラッシュしない = spec §5.5)。
- 代表 = `lastConfirmedAt` 最大 (同値は `createdAt` 最大)。

- [ ] **Step 1: 失敗するテストを書く** — ①同一 plot 2件が1スポットに集約され代表が lastConfirmedAt 最新 ②アパート号棟1と2が同一 apart スポット ③main/sub が mapKey で分かれる (plot 5 → main, plot 35 → sub) ④findInitialWardTarget が最多の area×ward を返す・0件で null ⑤解決不能 listing はスキップ。テストの listing フィクスチャは `MockListing` 必須フィールドを最小で埋める (既存 `browse` 系テストのフィクスチャを参考にする)
- [ ] **Step 2: FAIL 確認 → 実装 → PASS**
- [ ] **Step 3: representativeImage 移設 → 既存テスト全緑確認 (`npx vitest run` で ListingCard 系が通ること)**
- [ ] **Step 4: コミット** `feat(housing): 地図スポット集計の純関数 + 代表画像ロジックの共有化`

---

## Task 2: ビュー切替 (一覧 | 地図)

**Files:**
- Modify: `src/store/useHousingViewStore.ts` (`browseView: 'list' | 'map'` + `setBrowseView` を追加。既存 `viewMode: 'map'|'pinterest'` は**触らない・使わない** — 旧 Phase 2B の偽データ地図の意味なので誤用防止コメントを1行足すのみ)
- Create: `src/components/housing/browse/BrowseViewToggle.tsx`
- Modify: `src/components/housing/pages/BrowsePage.tsx` (中央カラム: トグル + `browseView` 分岐で `ListingGrid` ⇔ `BrowseMapView`)
- Modify: `src/styles/housing.css`
- Test: `src/__tests__/housing/BrowseViewToggle.test.tsx`

**BrowseViewToggle 仕様:** 2ボタンのセグメント切替 (`role="tablist"`)。ラベルは既存キー `housing.browse.view_list` / `view_map`、`aria-label` = `view_aria`。選択状態は `data-selected`。装飾は `.housing-sort-trigger` (BrowseSortSelect.tsx:18-72) と同系の控えめな質感。

**BrowsePage の分岐:** `status==='ready'` 側のみ変更。`browseView==='map'` なら `<BrowseMapView filtered={filtered} onAddToTour={addToTray} />` (Task 3 で仮実装を置く)。ローディング/エラー分岐は共通のまま。**トレイ (右カラム) は地図モードでも従来どおり表示される** (中央だけが切り替わる = spec §4.4)。

- [ ] **Step 1: トグルのテスト** (list⇔map 切替で store が変わる・selected 表示) → FAIL → 実装 → PASS
- [ ] **Step 2: BrowsePage 分岐 (BrowseMapView はこの時点ではプレースホルダの空 div でよい — Task 3 で実装)**
- [ ] **Step 3: `npx vitest run` 全緑 → コミット** `feat(housing): 探す中央の 一覧|地図 ビュー切替`

---

## Task 3: ワールド選択ゲート + BrowseMapView コンテナ

**Files:**
- Modify: `src/store/useHousingFilterStore.ts` (`setServerExclusive: (server: string) => void` を追加 = `set({ servers: [server] })`)
- Create: `src/components/housing/browse/map/BrowseMapView.tsx`
- Create: `src/components/housing/browse/map/WorldSelectGate.tsx`
- Modify: ロケール 4言語 (`housing.map.*` ブロック新設) / `src/styles/housing.css`
- Test: `src/__tests__/housing/BrowseMapView.test.tsx`

**BrowseMapView (コンテナ) の責務:** `props = { filtered: MockListing[]; onAddToTour: (id: string) => void }`
1. `useHousingFilterStore` の `servers` を見て `servers.length !== 1` なら `<WorldSelectGate />` を描画 (spec §3.2)。
2. 1つに絞れていれば: 地図の対象 listing = `filtered` (＝一覧と完全に同じフィルタ結果。地図側で独自緩和しない = spec §5.3)。
3. area/ward/mapKind のローカル state。初期値 = `findInitialWardTarget(filtered)` (null = ワールド内0件 → 空状態: `EmptyResult` の形を踏襲した `housing.map.empty_world` 文言 + 「一覧に戻る」ボタン (`setBrowseView('list')`))。
4. 操作列 (Task 6) + `BrowseWardMap` (Task 4) を配置。

**WorldSelectGate 仕様:** 見出し `housing.map.gate.title` (ja: 「あなたのワールドは?」) + 説明 1 行 (ja: 「地図はワールドごとに表示します」)。DC 一覧 (`ALL_DCS`、`src/data/housing/dcServerMap.ts`) → 選択で `DC_SERVER_MAP[dc].servers` のワールドボタン一覧。ワールド選択で `setDC(dc)` + `setServerExclusive(server)` → ゲートが自動的に外れて地図へ。既に `dc` 選択済みならその DC のワールド一覧から開始。

**i18n (ja 実値。en/ko/zh は同構造で自然な訳):**

```json
"map": {
    "gate": {
        "title": "あなたのワールドは?",
        "description": "地図はワールドごとに表示します",
        "dc_label": "データセンター",
        "world_label": "ワールド"
    },
    "empty_world": "このワールドにはまだ登録がありません",
    "back_to_list": "一覧に戻る",
    "load_error": "地図を読み込めませんでした",
    "ward_label": "{{ward}}区",
    "ward_count": "{{ward}}区 ({{count}}件)",
    "main_tab": "本街",
    "sub_tab": "拡張街",
    "tab_count": "{{label}} ({{count}})",
    "prev_ward": "前の区へ",
    "next_ward": "次の区へ",
    "spot_more": "この場所の家 {{index}}/{{total}}",
    "plot_label": "{{plot}}番地",
    "apartment_label": "アパート"
}
```

- [ ] **Step 1: ゲートのテスト** (servers 0件/2件 → ゲート表示・ワールド選択で setDC+setServerExclusive が呼ばれる / 1件 → 地図側へ) → FAIL → 実装 → PASS
- [ ] **Step 2: 空状態 (findInitialWardTarget null) のテスト → 実装**
- [ ] **Step 3: 4言語ロケール + `npm run build` → コミット** `feat(housing): 地図モードのワールド選択ゲートとコンテナ`

---

## Task 4: BrowseWardMap (SVG + パン/ズーム + マーカーレイヤ)

**Files:**
- Create: `src/components/housing/browse/map/BrowseWardMap.tsx`
- Modify: `src/styles/housing.css`
- Test: `src/__tests__/housing/BrowseWardMap.test.tsx` (`useWardMapAsset` を vi.mock)

**Props:** `{ mapKey: string; spots: BrowseMapSpot[]; expandedKey: string | null; onExpand: (key: string | null) => void; onAddToTour: (id: string) => void }`

**実装要点:**
1. `useWardMapAsset(mapKey)` → `loading` はスピナー相当の静かな文言、`error` は `housing.map.load_error` + 一覧に戻る (spec §5.5)。
2. `ready` 時: 外枠 `div.housing-bmap-wrap` (position:relative, overflow:hidden, touch-action:none) の中に
   - ステージ `div.housing-bmap-stage` — `width: json.viewBox.w px; height: json.viewBox.h px; transform: translate(tx px, ty px) scale(scale); transform-origin: 0 0`。中に SVG ホスト (`dangerouslySetInnerHTML={{ __html: svg }}`、`TourNavMap.tsx:329` と同形の `role="img"` + aria-label)。
   - マーカーレイヤ `div.housing-bmap-markers` — ステージの**外**の兄弟要素 (absolute inset:0, pointer-events:none。カード自身は pointer-events:auto)。各スポットの画面座標 = `sx = x*scale + tx`, `sy = y*scale + ty` (x,y は `plotToPlacementIn`/`apartToPlacementIn` の viewBox px)。カードは `transform: translate(sx px, sy px)` の子に `translate(-50%, -100%)` で吹き出しの根本をスポットに合わせる。**カード自体は scale を掛けない = 画面上一定サイズ** (spec §4.3)。
3. ビュー state `{ scale, tx, ty }` は `MapView` 型 (`src/lib/housing/mapZoom.ts` を import — 純関数の流用は可)。ホイール = `applyWheelZoom`、ピンチ = `zoomAt`。パン/ピンチの pointer 処理は `TourNavMap.tsx:227-286` の形を**新部品内に書き写す** (ネイティブ wheel 登録 = passive:false、ピンチ→単指の pan 再初期化を含める)。
4. 初期ビュー: コンテナ実寸 (ResizeObserver でキャッシュした rect) に `contain` フィット (`scale = min(cw/vw, ch/vh)`、中央寄せ `tx = (cw - vw*scale)/2` 等)。mapKey 変更でリセット。
5. ズーム範囲はフィット×1 〜 ×6 で clamp (mapZoom の clamp 仕様を読んで合わせる)。
6. 地図の空白クリック (マーカー以外) で `onExpand(null)` (拡大カードを閉じる)。

- [ ] **Step 1: テスト** (mock ready json {viewBox 100x100, houses: plot5/apart} + spots 2件 → マーカー2個が描画される / error → load_error 文言 / 空白クリックで onExpand(null)) → FAIL → 実装 → PASS
- [ ] **Step 2: `npm run build` → コミット** `feat(housing): 探す専用ワード地図 (SVG+パン/ズーム+マーカーレイヤ)`

---

## Task 5: MapSpotCard (吹き出しミニカード ⇔ 拡大 = ListingCard)

**Files:**
- Create: `src/components/housing/browse/map/MapSpotCard.tsx`
- Modify: `src/styles/housing.css`
- Test: `src/__tests__/housing/MapSpotCard.test.tsx`

**Props:** `{ spot: BrowseMapSpot; expanded: boolean; onExpand: (key: string | null) => void; onAddToTour: (id: string) => void; flip: { x: boolean; y: boolean } }` (flip は Task 4 が画面座標から算出して渡す: コンテナ右端/上端に近いとき反転)

**ミニカード (常時):**
- `button.housing-bmap-mini` — 中身: `representativeImage(spot.representative)` のサムネ (48px 角・角丸) + ラベル (`plot_label` or `apartment_label`) + 件数バッジ `×{{n}}` (n>1 のみ、`span.housing-bmap-badge`)。下に吹き出しのしっぽ (CSS 三角形、`::after`)。
- hover / focus / クリック / Enter → `onExpand(spot.key)`。`aria-expanded` 付与。

**拡大 (expanded=true):**
- ミニカードの位置に `div.housing-bmap-expanded` を重ねて **既存 `ListingCard` をそのまま描画** (`listing={spot.listings[index]}`, `onAddToTour` 素通し = ツアー追加/お気に入り/詳細クリックが一覧と同一挙動 = spec §4.2)。幅は一覧カード相当を CSS 変数で固定 (`--housing-bmap-card-w: 280px` 目安・実機で調整)。
- 複数件: 上部に `spot_more` (「この場所の家 1/3」) + 前後ボタンで `index` を循環。
- 閉じる: Esc (`useEffect` で keydown)、地図空白クリック (Task 4)、別スポットの `onExpand` (親が expandedKey を持つので自動排他)。
- 拡大中カードは `z-index` でミニカード群の前面。`flip.x/y` で吹き出しの向きと展開方向を反転。
- マウント時のみ ListingCard を生成 (常時マウントしない = spec §5.3)。

- [ ] **Step 1: テスト** (①n=1 でバッジなし・n=3 で ×3 ②expanded で ListingCard が描画され onAddToTour が届く ③前後ボタンで 1/3→2/3 ④Esc で onExpand(null)) → FAIL → 実装 → PASS
- [ ] **Step 2: housing.css (ミニ/吹き出し/バッジ/拡大)。色は既存トークンのみ・glow 控えめ → コミット** `feat(housing): 地図の吹き出しミニカード⇔拡大カード`

---

## Task 6: 操作列 + 初期表示 + 統合仕上げ

**Files:**
- Create: `src/components/housing/browse/map/MapControls.tsx`
- Modify: `src/components/housing/browse/map/BrowseMapView.tsx` (操作列 + BrowseWardMap + MapSpotCard 配線の完成)
- Modify: ロケール 4言語 / `src/styles/housing.css`
- Test: `src/__tests__/housing/MapControls.test.tsx`

**MapControls 仕様:** `{ area, ward, mapKind, wardCounts: Map<number,number>, kindCounts: {main,sub}, onAreaChange, onWardChange, onKindChange }`
- 住宅街切替: 5 ボタンのセグメント。ラベルは既存の住宅街名 i18n (FilterPanel が使うキーを grep して流用。無ければ `housing.map.area.*` を新設し 4言語)。
- 区: `BrowseSortSelect.tsx:18-72` と同形のドロップダウン (1〜30、各行 `ward_count` で件数付き、0件の区も選べる) + 前後矢印ボタン (`prev_ward`/`next_ward`、1↔30 は端で止める)。
- 本街/拡張街: 2タブ。ラベル = `tab_count` で件数付き (例「拡張街 (3)」)。
- area/ward 変更時: `mapKind` は件数が多い側へ自動セット (両方 0 なら main)。

**BrowseMapView 完成形の配線:**

```tsx
const wardListings = selectWardListings(filtered, area, ward);
const kindCounts = countListingsByMapKind(wardListings);
const mapKey = mapKind === 'main' ? AREA_MAP_KEY[area] : `${AREA_MAP_KEY[area]}-sub`;
const spots = groupListingsByMapSpot(wardListings, mapKey);
// AREA_MAP_KEY: HousingArea → 'mist'|'goblet'|'lavender'|'shirogane'|'empyreum'
// (resolveWardMapRef 内に同等の対応表があるはず — 読んで、export されていれば流用、
//  ローカル定数の場合は browseMapSpots.ts に定数として定義し重複コメントで出典を明記)
```

- ward 変更・area 変更で expandedKey をリセット。
- [ ] **Step 1: MapControls テスト** (件数表示・前後矢印の端・kind 自動選択) → FAIL → 実装 → PASS
- [ ] **Step 2: BrowseMapView 統合 + 目視用の全配線**
- [ ] **Step 3: 全体検証** — `npm run build` / `npx vitest run` 全緑 / `npx tsc -b --noEmit` / 4言語 `housing.map` ブロックのキー集合一致
- [ ] **Step 4: コミット** `feat(housing): 地図モードの操作列と初期表示 (統合完成)`

**実機確認チェックリスト (ユーザー向け・最終報告に含める):**
1. 一覧⇔地図の切替、ワールド未選択→ゲート→選択→地図
2. 初期表示が「登録最多の住宅街×区」になっている
3. ミニカードの常時表示・×N バッジ・hover 拡大で画像がよく見える
4. 拡大カードから ツアーに追加 (右のトレイに載る)・お気に入り・クリックで詳細
5. パン/ズームでカードが追従し、大きさは一定のまま
6. 本街/拡張街タブの件数と切替、区ドロップダウンの件数
7. DPR 2.58 実画面での吹き出し視認性 (サイズ調整が要るなら報告)

## 受け入れ基準

- 一覧と地図の件数が常に一致 (同じ filtered を使用)
- ツアー側ファイルの diff が**ゼロ** (`git diff --stat main -- src/components/housing/tour src/lib/housing/buildTourMapPlacements.ts src/lib/housing/wardRoute.ts src/lib/housing/mapZoom.ts src/lib/housing/resolveWardMapRef.ts` が空)
- 地図素材読み込み失敗・座標欠落でクラッシュしない

## やらないこと (spec §8)

「ルート」ビュー / ワールド横断・全区俯瞰 / ヒートマップ / スマホ専用最適化 / 地図からの登録導線 / 空き区画表示 / ツアー地図の改修
