# 探す地図② カード地図面化 + 大量部屋パネル 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 探す地図のカードを地図SVGと同じ変形面へ移して家と一体でパン/ズームさせ(カサカサ根治)、ホバーで画面固定サイズへ膨らませる。加えて1スポットの大量部屋(アパ最大90/FC個室最大512)を専用スクロールパネルで見せる。

**Architecture:** カードを画面座標の別レイヤーから「地図stageと同一transformの面(`.housing-bmap-card-plane`)」へ移し、マーカーを区画座標`translate(m.x,m.y)`で配置する(位置はCSS継承で家と同期=カサカサ消滅)。ホバー時は同じカード1枚が面のscaleを打ち消す逆スケール(`1/actualScale`)で画面固定サイズへ拡大(別ノードに作り直さない=動画再マウント無し)。2件以上のスポットはクリックで地図に重なる専用パネル(`RoomListPanel`)を開き、`spot.listings`を家全体/個室/アパ部屋に振り分けてグリッド表示する。

**Tech Stack:** React 18 + TypeScript(strict/erasableSyntaxOnly) / Vite / Vitest(happy-dom) + Testing Library / react-i18next(ja/en/ko/zh) / CSS custom properties(housing.css)。

## Global Constraints

- **設計原本**: `docs/superpowers/specs/2026-07-12-browse-map-card-plane-design.md`(§番号は本計画の各所で参照)。
- **トンマナ**: ハウジング独自(質感A案=濃紺フラット面 / 2アクセント[ハニー=主/青=進行] / **AI風ピル・honey gradient・過剰glow・色付きalert箱を避ける** / 縦積みは`gap`で余白リズム)。既存LoPo白黒ルールは適用外。
- **ハードコード禁止(色/font-size/寸法/影)**: すべて`--housing-*`トークン経由。新規トークンは`src/styles/housing.css`の`.housing-workspace`ブロック上部に集約。maskの`#000`/`transparent`はalpha専用で色トークン対象外(既存`.housing-tour-steps-list`と同じ規約)。
- **i18n**: 文字列は必ずキー経由。ja/en/ko/zhの4言語parityを維持。ロケールJSONは該当ブロックのみtextual編集(全体parse→stringify禁止)。
- **class名`.housing-bmap-marker-pos`は維持**(pointerdown/空白クリックの`closest`判定が依存)。
- **常時1枚マウント維持**(hoverごとのmount/unmountチャーンを復活させない=クラッシュ再発防止)。
- **push前**: `npm run build`(tsc -b厳密) + `npx vitest run`必須。DEVでuseEffect/ネイティブリスナ変更後はハードリロード。
- **視覚/操作検証はユーザーが実機で実施**(開発者画面 CSS 1489x679 / DPR 2.58)。Claudeは実機Playwrightに時間を使わず、各タスク末尾の目視チェックリストで引き継ぐ。

---

## ファイル構成

| ファイル | 役割 | 変更 |
|---|---|---|
| `src/lib/housing/mapCardClamp.ts` | 端クランプ純関数 | flip引数撤去・中央アンカー化 |
| `src/lib/housing/browseMapSpots.ts` | スポット集計純関数 | `splitSpotListings` 追加 |
| `src/components/housing/browse/ListingCard.tsx` | 共通カード | optional `onCardClick` 追加 |
| `src/components/housing/browse/map/BrowseWardMap.tsx` | 地図+マーカー | card-plane化・区画座標配置・flip撤去・逆スケール供給・`onOpenPanel` |
| `src/components/housing/browse/map/MapSpotCard.tsx` | 吹き出しカード | flip/nav撤去・逆スケールpop・clamp変換・「N件を見る」導線・click分岐 |
| `src/components/housing/browse/map/RoomListPanel.tsx` | **新規** 大量部屋パネル | ヘッダー/家全体/グリッド/フェード |
| `src/components/housing/browse/map/BrowseMapView.tsx` | 地図モード器 | `panelSpotKey` state・パネル描画・reset配線・Esc優先 |
| `src/styles/housing.css` | スタイル | card-plane/逆スケール/しっぽ撤去/chip/roompanel |
| `src/locales/{ja,en,ko,zh}.json` | i18n | パネル文言5キー |

既存テスト改修: `mapCardClamp.test.ts` / `MapSpotCard.test.tsx` / `BrowseWardMap.test.tsx`(下記各タスクに内包)。

---

## Task 1: mapCardClamp を中央アンカー化(flip撤去)

案Bのpoppedは区画中央にアンカーする(しっぽ無し)。clampを「マーカー中心に置いた矩形をコンテナ内に収める」計算へ単純化する。純関数なのでTDD。

**Files:**
- Modify: `src/lib/housing/mapCardClamp.ts`
- Test: `src/__tests__/housing/mapCardClamp.test.ts`(全面置換)

**Interfaces:**
- Produces: `clampExpandedCardOffset(input: { markerX, markerY, wrapW, wrapH, cardW, cardH }): { dx, dy }`(すべて number・screen px)。`CLAMP_EDGE_PADDING: number` を引き続き export。`EXPANDED_CARD_GAP` と `flipX/flipY` は廃止。

- [ ] **Step 1: テストを置換(失敗させる)**

`src/__tests__/housing/mapCardClamp.test.ts` を丸ごと以下に置換:

```ts
import { describe, it, expect } from 'vitest';
import { clampExpandedCardOffset, CLAMP_EDGE_PADDING } from '../../lib/housing/mapCardClamp';

// 中央アンカー: 矩形 = [markerX±cardW/2, markerY±cardH/2]。maxEdge(右/下)超過を優先補正、
// 収まっていれば minEdge(左/上)を補正。CLAMP_EDGE_PADDING=8。
describe('clampExpandedCardOffset (中央アンカー)', () => {
  it('十分広いコンテナの中央付近では補正なし', () => {
    // left=310,right=590 (in 900), top=165,bottom=435 (in 600) → 0
    expect(clampExpandedCardOffset({ markerX: 450, markerY: 300, wrapW: 900, wrapH: 600, cardW: 280, cardH: 270 }))
      .toEqual({ dx: 0, dy: 0 });
  });

  it('下端はみ出しを上へ押し戻す', () => {
    // markerY=550: top=415,bottom=685。685 > 600-8=592 → dy=592-685=-93
    const o = clampExpandedCardOffset({ markerX: 450, markerY: 550, wrapW: 900, wrapH: 600, cardW: 280, cardH: 270 });
    expect(o.dy).toBeCloseTo(-93, 9);
    expect(o.dx).toBe(0);
  });

  it('上端はみ出しを下へ押し戻す', () => {
    // markerY=20: top=-115,bottom=155。maxEdge OK, minEdge -115<8 → dy=8-(-115)=123
    const o = clampExpandedCardOffset({ markerX: 450, markerY: 20, wrapW: 900, wrapH: 600, cardW: 280, cardH: 270 });
    expect(o.dy).toBeCloseTo(123, 9);
  });

  it('右端はみ出しを左へ押し戻す', () => {
    // markerX=800: left=660,right=940。940 > 900-8=892 → dx=892-940=-48
    const o = clampExpandedCardOffset({ markerX: 800, markerY: 300, wrapW: 900, wrapH: 600, cardW: 280, cardH: 270 });
    expect(o.dx).toBeCloseTo(-48, 9);
  });

  it('左端はみ出しを右へ押し戻す', () => {
    // markerX=50: left=-90,right=190。minEdge -90<8 → dx=8-(-90)=98
    const o = clampExpandedCardOffset({ markerX: 50, markerY: 300, wrapW: 900, wrapH: 600, cardW: 280, cardH: 270 });
    expect(o.dx).toBeCloseTo(98, 9);
  });

  it('カードがコンテナより大きい極端ケースは下端(フッターCTA)優先で始端は補正しない', () => {
    // cardH=1000 > wrapH=100。markerY=50: top=-450,bottom=550。550 > 100-8=92 → dy=92-550=-458
    const o = clampExpandedCardOffset({ markerX: 450, markerY: 50, wrapW: 900, wrapH: 100, cardW: 280, cardH: 1000 });
    expect(o.dy).toBeCloseTo(100 - CLAMP_EDGE_PADDING - 550, 9);
    const top = 50 - 500;
    expect(top + o.dy).toBeLessThan(0); // 始端はコンテナ外に留まる
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/__tests__/housing/mapCardClamp.test.ts`
Expected: FAIL(旧署名`flipX`必須/`EXPANDED_CARD_GAP` import等で型/実行エラー)

- [ ] **Step 3: 実装を置換**

`src/lib/housing/mapCardClamp.ts` を丸ごと以下に置換:

```ts
// 探す地図の拡大カード (MapSpotCard) が `.housing-bmap-wrap` (overflow:hidden) の外へはみ出さない
// ための「クランプ」計算。2026-07-12 案B: popped は区画中央にアンカーする (しっぽ無し) ため、
// マーカー中心に置いた矩形をコンテナ内に収める計算に単純化した (flip 廃止)。
// 入力はすべて呼び出し側で確定済みの数値 (ResizeObserver キャッシュのコンテナ実寸 / マウント時に
// 一度測定したカード実寸 / パン・ズーム込みで算出済みのマーカー画面座標)。pointermove 中の layout
// 読み取りはしない。返す dx/dy は画面 px (呼び出し側で ÷actualScale して card-plane px に変換する)。

/** クランプ後もコンテナの縁に張り付かないための余白(px)。 */
export const CLAMP_EDGE_PADDING = 8;

export interface ClampExpandedCardInput {
  /** マーカーの画面座標 (`.housing-bmap-wrap` 基準、パン/ズーム込み)。 */
  markerX: number;
  markerY: number;
  /** コンテナ実寸 (ResizeObserver キャッシュ)。 */
  wrapW: number;
  wrapH: number;
  /** 拡大時 (画面固定サイズ) のカード実寸 (マウント時に測定した layout 実寸)。 */
  cardW: number;
  cardH: number;
}

export interface ClampExpandedCardOffset {
  dx: number;
  dy: number;
}

/**
 * 1軸ぶんのクランプ量。終端(下端/右端)のはみ出しを優先して直す(フッターの CTA を優先)。
 * 終端が収まっている場合に限り始端(上端/左端)を直す(カードがコンテナより大きい極端ケースでは
 * 両立不能なので終端側を上書きしない = CTA を犠牲にしない)。
 */
function clampAxis(minEdge: number, maxEdge: number, containerSize: number): number {
  if (maxEdge > containerSize - CLAMP_EDGE_PADDING) {
    return containerSize - CLAMP_EDGE_PADDING - maxEdge;
  }
  if (minEdge < CLAMP_EDGE_PADDING) {
    return CLAMP_EDGE_PADDING - minEdge;
  }
  return 0;
}

/** マーカー中心にアンカーした矩形がコンテナ内に収まるための追加オフセット (dx, dy・画面 px) を返す。 */
export function clampExpandedCardOffset(input: ClampExpandedCardInput): ClampExpandedCardOffset {
  const { markerX, markerY, wrapW, wrapH, cardW, cardH } = input;
  const left = markerX - cardW / 2;
  const right = markerX + cardW / 2;
  const top = markerY - cardH / 2;
  const bottom = markerY + cardH / 2;
  return {
    dx: clampAxis(left, right, wrapW),
    dy: clampAxis(top, bottom, wrapH),
  };
}
```

- [ ] **Step 4: 成功確認**

Run: `npx vitest run src/__tests__/housing/mapCardClamp.test.ts`
Expected: PASS(6件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/housing/mapCardClamp.ts src/__tests__/housing/mapCardClamp.test.ts
git commit -m "refactor(housing): 探す地図clampを中央アンカー化 (flip撤去・案B ②-c)"
```

---

## Task 2: splitSpotListings 純関数

パネルが`spot.listings`を「家全体/個室/アパ部屋」に振り分けるための純関数。TDD。

**Files:**
- Modify: `src/lib/housing/browseMapSpots.ts`(末尾に追記)
- Test: `src/lib/housing/__tests__/browseMapSpots.test.ts`(既存に describe 追記)

**Interfaces:**
- Consumes: `BrowseMapSpot`(既存)、`MockListing`(既存・`roomKind?: 'private_chamber' | 'apartment_room'`)。
- Produces: `splitSpotListings(spot: BrowseMapSpot): { houseWholes: MockListing[]; chambers: MockListing[]; apartmentRooms: MockListing[] }`。

- [ ] **Step 1: テスト追記(失敗させる)**

`src/lib/housing/__tests__/browseMapSpots.test.ts` の末尾に追記(既存 import の並びに合わせ、ファイル冒頭の import 群へ `splitSpotListings` を追加。`BrowseMapSpot`/`MockListing` の生成ヘルパは既存ファイルのものを流用、無ければ以下の最小 mk を使う):

```ts
import { splitSpotListings } from '../browseMapSpots';

describe('splitSpotListings', () => {
  const L = (over: Partial<import('../../../data/housing/mockListings').MockListing>) =>
    ({
      id: `x${Math.random()}`, ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP',
      area: 'Mist', ward: 1, size: 'M', imageMode: 'none', tags: [], createdAt: 1,
      lastConfirmedAt: 1, addressKey: 'k', buildingType: 'house', plot: 5, ...over,
    }) as import('../../../data/housing/mockListings').MockListing;
  const spot = (kind: 'plot' | 'apart', listings: import('../../../data/housing/mockListings').MockListing[]) =>
    ({ key: `${kind}:5`, kind, plot: 5, listings, representative: listings[0] });

  it('apart スポットは全件を apartmentRooms に入れる', () => {
    const rooms = [L({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 1 }),
                   L({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 2 })];
    const g = splitSpotListings(spot('apart', rooms));
    expect(g.apartmentRooms).toHaveLength(2);
    expect(g.houseWholes).toHaveLength(0);
    expect(g.chambers).toHaveLength(0);
  });

  it('plot スポットは 家全体(roomKind未設定) と 個室(private_chamber) に分ける', () => {
    const house = L({});
    const c1 = L({ roomKind: 'private_chamber', roomNumber: 1 });
    const c2 = L({ roomKind: 'private_chamber', roomNumber: 2 });
    const g = splitSpotListings(spot('plot', [house, c1, c2]));
    expect(g.houseWholes).toEqual([house]);
    expect(g.chambers).toEqual([c1, c2]);
    expect(g.apartmentRooms).toHaveLength(0);
  });

  it('家全体が複数(重複登録)でも全部 houseWholes に残す', () => {
    const h1 = L({}); const h2 = L({});
    const g = splitSpotListings(spot('plot', [h1, h2]));
    expect(g.houseWholes).toEqual([h1, h2]);
    expect(g.chambers).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/housing/__tests__/browseMapSpots.test.ts`
Expected: FAIL(`splitSpotListings` 未定義)

- [ ] **Step 3: 実装追記**

`src/lib/housing/browseMapSpots.ts` の末尾に追記:

```ts
export interface SpotRoomGroups {
  /** 家全体登録 (roomKind 未設定)。plot スポットのみ。通常 1 件、重複登録で複数もありうる。 */
  houseWholes: MockListing[];
  /** FC 個室 (roomKind==='private_chamber')。plot スポットのみ。 */
  chambers: MockListing[];
  /** アパート部屋 (apart スポットの全件)。 */
  apartmentRooms: MockListing[];
}

/**
 * スポットの listings を大量部屋パネル用に振り分ける (spec §4.3)。
 * apart スポットは全件が apartment_room。plot スポットは 家全体(roomKind 未設定) と 個室(private_chamber)。
 * Firestore 再取得はしない (既に集約済み・一覧と同じフィルタ結果)。
 */
export function splitSpotListings(spot: BrowseMapSpot): SpotRoomGroups {
  if (spot.kind === 'apart') {
    return { houseWholes: [], chambers: [], apartmentRooms: spot.listings.slice() };
  }
  const houseWholes: MockListing[] = [];
  const chambers: MockListing[] = [];
  for (const l of spot.listings) {
    if (l.roomKind === 'private_chamber') chambers.push(l);
    else houseWholes.push(l);
  }
  return { houseWholes, chambers, apartmentRooms: [] };
}
```

- [ ] **Step 4: 成功確認**

Run: `npx vitest run src/lib/housing/__tests__/browseMapSpots.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/housing/browseMapSpots.ts src/lib/housing/__tests__/browseMapSpots.test.ts
git commit -m "feat(housing): splitSpotListings 追加 (大量部屋パネル用の振り分け・案B ②-b)"
```

---

## Task 3: ListingCard に optional onCardClick

複数スポットのカードクリックを「詳細遷移でなくパネル起動」に振り向けるための最小フック。未指定なら従来どおり詳細へ(非破壊)。

**Files:**
- Modify: `src/components/housing/browse/ListingCard.tsx`
- Test: `src/components/housing/browse/__tests__/ListingCard.test.tsx`(describe 追記)

**Interfaces:**
- Produces: `ListingCardProps.onCardClick?: () => void`。指定時は article の onClick / Enter がこれを呼ぶ(navigate しない)。♡/選択/ツアー追加ボタンは従来どおり `stopPropagation` で独立動作。

- [ ] **Step 1: テスト追記(失敗させる)**

`src/components/housing/browse/__tests__/ListingCard.test.tsx` の既存パターンに合わせ、以下の describe を追記(navigate モックは既存ファイルの流儀に合わせる。無ければ `const navigate = vi.fn(); vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));` を冒頭に置く):

```ts
describe('ListingCard — onCardClick override', () => {
  it('onCardClick 指定時、カード本体クリックは navigate せず onCardClick を呼ぶ', () => {
    const onCardClick = vi.fn();
    render(/* 既存 render ヘルパで */ <ListingCardWith onCardClick={onCardClick} />);
    fireEvent.click(screen.getByTestId('housing-listing-card'));
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
});
```

(実際の render は既存テストの render ヘルパ/Provider を流用する。`ListingCardWith` は擬似・既存の `renderCard` 等に置換する。)

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: FAIL(`onCardClick` 未対応で navigate が呼ばれる)

- [ ] **Step 3: 実装**

`src/components/housing/browse/ListingCard.tsx`:

`ListingCardProps` に追記(既存 props の後ろ):

```tsx
  /** 指定時、カード本体クリック/Enter で詳細遷移せずこれを呼ぶ (例: 地図の複数スポット→パネル起動)。 */
  onCardClick?: () => void;
```

分割代入に `onCardClick` を追加し、`openDetail` の直後に activate を定義:

```tsx
  // カード全体クリック → 既定は詳細ページ。onCardClick 指定時はそちらを優先 (♡/選択/ツアー追加は stopPropagation で独立)。
  const openDetail = () => navigate(`/housing/listing/${listing.id}`);
  const activate = onCardClick ?? openDetail;
```

article の onClick / onKeyDown を `activate` に差し替え:

```tsx
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter') activate();
      }}
```

- [ ] **Step 4: 成功確認**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: PASS(既存 + 新規)

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/browse/ListingCard.tsx src/components/housing/browse/__tests__/ListingCard.test.tsx
git commit -m "feat(housing): ListingCard に optional onCardClick (複数スポット→パネル用)"
```

---

## Task 4: カードを地図面へ(②-c 本体)

カードを画面座標レイヤーから地図stageと同一transformの面へ移し、区画座標配置(カサカサ根治+家と一体ズーム)、逆スケールpop(画面固定サイズ)、clamp変換、flip/しっぽ/nav撤去を一括で行う。**この時点ではまだパネルは無い**(複数スポットは代表のみ・クリックは代表の詳細へ)。jsdomでは transform/scale の実挙動を検証できないため、末尾の**実機チェックリストが最終ゲート**。

**Files:**
- Modify: `src/components/housing/browse/map/BrowseWardMap.tsx`
- Modify: `src/components/housing/browse/map/MapSpotCard.tsx`
- Modify: `src/styles/housing.css`
- Test: `src/__tests__/housing/MapSpotCard.test.tsx`(flip/nav 撤去・clamp 更新)
- Test: `src/__tests__/housing/BrowseWardMap.test.tsx`(renderMap に onOpenPanel 追加)

**Interfaces:**
- `MapSpotCardProps`: `flip` を削除。`mapScale: number`(=actualScale) と `onOpenPanel: (key: string) => void` を追加。既存 `spot/expanded/onExpand/onAddToTour/markerPos/wrapSize/gestureActiveRef` は維持。
- `BrowseWardMapProps`: `onOpenPanel: (key: string) => void` を追加。
- CSS 変数: `.housing-bmap-card-plane` が `--housing-bmap-scale-inv`(=1/actualScale・unitless) を供給。`.housing-bmap-card` は `--housing-bmap-scale` / `--housing-bmap-clamp-x/y` を消費。

- [ ] **Step 1: MapSpotCard を書き換え**

`src/components/housing/browse/map/MapSpotCard.tsx`:

(a) import から `ChevronLeft, ChevronRight` を削除(nav廃止)。`clampExpandedCardOffset` の import は維持。

(b) Props を差し替え:

```tsx
export interface MapSpotCardProps {
  spot: BrowseMapSpot;
  expanded: boolean;
  onExpand: (key: string | null) => void;
  onAddToTour: (id: string) => void;
  /** 複数スポット (listings>=2) のカードクリック/「N件を見る」で大量部屋パネルを開く。 */
  onOpenPanel: (key: string) => void;
  /** マーカーの画面座標 (パン/ズーム込み)。popped の clamp 計算に使う。 */
  markerPos: { x: number; y: number };
  /** コンテナ実寸 (ResizeObserver キャッシュ)。clamp 計算に使う。 */
  wrapSize: { w: number; h: number };
  /** 地図の実描画倍率 (actualScale)。clamp の 画面px→plane px 変換に使う。 */
  mapScale: number;
  /** パン/ピンチ/カード上ドラッグの間 true。hover 拡大を抑止する。 */
  gestureActiveRef: React.RefObject<boolean>;
}
```

(c) 分割代入を `flip` 抜き・`onOpenPanel/mapScale` 込みに更新。`flipX/flipY`・`index/setIndex`・`goPrev/goNext`・`total` の index 用途を削除。代わりに:

```tsx
  const total = spot.listings.length;
  const isMulti = total >= 2;
```

(d) clampOffset を新署名 + ÷mapScale に:

```tsx
  const clampOffset = useMemo(() => {
    if (!expanded || !cardSize) return { dx: 0, dy: 0 };
    const screen = clampExpandedCardOffset({
      markerX: markerPos.x,
      markerY: markerPos.y,
      wrapW: wrapSize.w,
      wrapH: wrapSize.h,
      cardW: cardSize.w,
      cardH: cardSize.h,
    });
    // 画面 px → card-plane px。plane が ×mapScale するので ÷mapScale で相殺し、画面上は screen.dx/dy になる。
    return { dx: screen.dx / mapScale, dy: screen.dy / mapScale };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, cardSize, markerPos.x, markerPos.y, wrapSize.w, wrapSize.h, mapScale]);
```

(e) JSX root から `data-flip-x/y` を削除し、nav ブロックを「N件を見る」導線に差し替え、ListingCard に onCardClick を渡す:

```tsx
  return (
    <div
      className="housing-bmap-card"
      data-testid={`bmap-card-${spot.key}`}
      data-expanded={expanded ? 'true' : 'false'}
      ref={cardRef}
      style={
        {
          '--housing-bmap-clamp-x': `${clampOffset.dx}px`,
          '--housing-bmap-clamp-y': `${clampOffset.dy}px`,
        } as React.CSSProperties
      }
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      onFocus={expandImmediately}
      onClick={(e) => e.stopPropagation()}
    >
      {isMulti && (
        <button
          type="button"
          className="housing-bmap-card-more"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPanel(spot.key);
          }}
        >
          {t('housing.map.spot_open_panel', { count: total })}
        </button>
      )}
      <ListingCard
        listing={spot.representative}
        onAddToTour={onAddToTour}
        onCardClick={isMulti ? () => onOpenPanel(spot.key) : undefined}
      />
    </div>
  );
```

(先頭コメントの「旧/新」説明は案B(中央アンカー・逆スケールpop・パネル)に沿って1〜2行更新する。)

- [ ] **Step 2: BrowseWardMap を書き換え**

`src/components/housing/browse/map/BrowseWardMap.tsx`:

(a) `FLIP_MARGIN_X` / `FLIP_MARGIN_Y` 定数とその長いコメントを削除。

(b) `BrowseWardMapProps` に `onOpenPanel: (key: string) => void;` を追加し、分割代入に足す。

(c) markers の描画ブロック(現 `.housing-bmap-markers` div 一式)を card-plane に置換:

```tsx
          <div
            className="housing-bmap-card-plane"
            data-testid="bmap-card-plane"
            style={
              {
                transform: `translate(${view.tx}px, ${view.ty}px) scale(${actualScale})`,
                '--housing-bmap-scale-inv': String(1 / actualScale),
              } as React.CSSProperties
            }
          >
            {markers.map((m) => {
              // sx/sy は popped の clamp 用にのみ算出 (配置は下の translate(m.x,m.y) が担う)。
              const sx = m.x * actualScale + view.tx;
              const sy = m.y * actualScale + view.ty;
              return (
                <div
                  key={m.spot.key}
                  className="housing-bmap-marker-pos"
                  style={{ transform: `translate(${m.x}px, ${m.y}px)` }}
                >
                  <MapSpotCard
                    spot={m.spot}
                    expanded={expandedKey === m.spot.key}
                    onExpand={onExpand}
                    onAddToTour={onAddToTour}
                    onOpenPanel={onOpenPanel}
                    markerPos={{ x: sx, y: sy }}
                    wrapSize={wrapSize}
                    mapScale={actualScale}
                    gestureActiveRef={gestureActiveRef}
                  />
                </div>
              );
            })}
          </div>
```

(compass / hint の2ブロックは card-plane の**前**(=下)に残す。順序は stage → compass → hint → card-plane。)

- [ ] **Step 3: housing.css を書き換え**

`src/styles/housing.css` の `.housing-bmap-markers` 〜 `.housing-bmap-card-nav-label`(概ね L5240〜5405)を以下に置換:

```css
/* カードレイヤ = 地図 stage と同一 transform の面 (2026-07-12 案B ②-c: カードを地図面へ移し
 * 家と一体でパン/ズーム = カサカサ根治)。自身は pointer-events:none で地図操作を透過し、
 * カード (.housing-bmap-card) だけ auto に戻す。transform/transform-origin は BrowseWardMap が
 * stage と同じ view から算出するため常に一致する。 */
.housing-bmap-card-plane {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  pointer-events: none;
}
/* 位置決めラッパ: JS 側で区画座標 translate(m.x, m.y) を当てる (面の scale で家と一緒に拡縮)。
 * class 名は維持 (BrowseWardMap の pointerdown / 空白クリックの closest 判定が依存)。 */
.housing-bmap-marker-pos {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

/* ドラッグ由来のゴースト画像を抑止 (カード内 <img> 起点のドラッグとパンの紛れを防ぐ)。 */
.housing-bmap-card,
.housing-bmap-card img {
  -webkit-user-drag: none;
  user-select: none;
}

/* 吹き出しカード (2026-07-12 案B): フル ListingCard を常時1枚描画し、区画中央にアンカー。
 * 通常時は面の scale で小さく (--housing-bmap-scale-collapsed)、hover/focus で面の scale を
 * 打ち消す逆スケール (--housing-bmap-scale-inv = 1/actualScale) で画面固定サイズへ膨らむ。
 * しっぽ (::after) と flip は廃止 (中央アンカー)。frosted glass は入れ子 transform で崩れうるため
 * 実機で崩れたら background を --housing-panel-bg-solid へ寄せ backdrop-filter を外す (spec §3.5)。 */
.housing-bmap-card {
  --housing-bmap-clamp-x: 0px;
  --housing-bmap-clamp-y: 0px;
  --housing-bmap-scale: var(--housing-bmap-scale-collapsed);
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: var(--housing-bmap-card-w);
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: auto;
  cursor: pointer;
  border-radius: 14px;
  background: var(--housing-panel-bg);
  --tw-backdrop-blur: blur(8px);
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  transform-origin: 50% 50%;
  transform: translate(
      calc(-50% + var(--housing-bmap-clamp-x)),
      calc(-50% + var(--housing-bmap-clamp-y))
    )
    scale(var(--housing-bmap-scale));
  transition: transform 180ms ease;
}
/* hover/focus 中 (= 親が expandedKey に選んだスポット): 面の scale を打ち消して画面固定サイズへ。 */
.housing-bmap-card[data-expanded="true"] {
  --housing-bmap-scale: var(--housing-bmap-scale-inv);
  z-index: 10;
}
/* 拡大中スポットの marker-pos を兄弟より前面へ (自スタッキングコンテキストの底上げ)。 */
.housing-bmap-marker-pos:has(.housing-bmap-card[data-expanded="true"]) {
  z-index: 1;
}

/* 複数スポットの「N件を見る」導線 (パネルを開く)。AI 風ピルを避け、ヘアライン + 静かなグレー文字。 */
.housing-bmap-card-more {
  align-self: stretch;
  appearance: none;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--housing-panel-border);
  background: var(--housing-panel-bg-solid);
  color: var(--housing-text-dim);
  font-size: var(--housing-text-xs);
  text-align: center;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.housing-bmap-card-more:hover {
  border-color: var(--housing-honey-border);
  color: var(--housing-candle);
}
```

(注: 置換前に該当範囲を Read で確認し、`.housing-bmap-card::after` / `[data-flip-x]` / `[data-flip-y]` / `.housing-bmap-card-nav*` が確実に消えていること。L6530 付近の `.housing-bmap-stage .housing-map-svg-host ...` の淡色化ブロックは**触らない**。)

- [ ] **Step 4: MapSpotCard.test.tsx を更新**

`src/__tests__/housing/MapSpotCard.test.tsx`:
- `renderCard` の props から `flip={noFlip}` を削除し、`onOpenPanel={() => {}}` と `mapScale={1}` を追加。`noFlip` 定数を削除。
- describe「MapSpotCard — flip」(旧 L312-326) を丸ごと削除。
- describe「MapSpotCard — 複数件の前後ナビ (循環)」(旧 L137-168) を丸ごと削除し、以下の describe に置換:

```tsx
describe('MapSpotCard — 複数スポットの導線 (パネル)', () => {
  it('listings>=2 のとき「N件を見る」導線を描画し、クリックで onOpenPanel(spot.key)', () => {
    const onOpenPanel = vi.fn();
    const spot = mkSpot([mkListing(), mkListing(), mkListing()]);
    renderCard({ spot, expanded: true, onOpenPanel });
    const btn = screen.getByRole('button', { name: /3件を見る/ });
    fireEvent.click(btn);
    expect(onOpenPanel).toHaveBeenCalledWith('plot:5');
  });

  it('listings=1 のときは導線を出さない', () => {
    const { container } = renderCard({ spot: mkSpot([mkListing()]), expanded: true });
    expect(container.querySelector('.housing-bmap-card-more')).toBeNull();
  });

  it('複数スポットはカード本体クリックでも onOpenPanel を呼ぶ (詳細遷移しない)', () => {
    const onOpenPanel = vi.fn();
    const spot = mkSpot([mkListing(), mkListing()]);
    renderCard({ spot, expanded: true, onOpenPanel });
    fireEvent.click(screen.getByTestId('housing-listing-card'));
    expect(onOpenPanel).toHaveBeenCalledWith('plot:5');
    expect(navigate).not.toHaveBeenCalled();
  });
});
```

- 「n=1 のときは前後ナビを描画しない」(旧 L130-134) を削除(上の「導線を出さない」で代替)。
- describe「拡大カードのコンテナ内クランプ (Finding2)」を中央アンカー + mapScale に更新:

```tsx
describe('MapSpotCard — 拡大カードのコンテナ内クランプ', () => {
  it('下端寄りスポットで --housing-bmap-clamp-y が負になり CSS で下端が収まる (mapScale=1)', () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 280, height: 270, top: 0, left: 0, right: 280, bottom: 270, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    try {
      renderCard({ spot: mkSpot([mkListing()]), expanded: true, markerPos: { x: 450, y: 550 }, wrapSize: { w: 900, h: 600 }, mapScale: 1 });
      // top=550-135=415, bottom=550+135=685 > 600-8=592 → dy=592-685=-93
      expect(screen.getByTestId('bmap-card-plot:5').style.getPropertyValue('--housing-bmap-clamp-y')).toBe('-93px');
    } finally { rectSpy.mockRestore(); }
  });

  it('mapScale>1 のとき clamp 値は ÷mapScale で plane 座標に変換される', () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 280, height: 270, top: 0, left: 0, right: 280, bottom: 270, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    try {
      renderCard({ spot: mkSpot([mkListing()]), expanded: true, markerPos: { x: 450, y: 550 }, wrapSize: { w: 900, h: 600 }, mapScale: 2 });
      // screen dy=-93 → plane -93/2=-46.5
      expect(screen.getByTestId('bmap-card-plot:5').style.getPropertyValue('--housing-bmap-clamp-y')).toBe('-46.5px');
    } finally { rectSpy.mockRestore(); }
  });

  it('中央付近では clamp-x/-y が 0px', () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 280, height: 270, top: 0, left: 0, right: 280, bottom: 270, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    try {
      renderCard({ spot: mkSpot([mkListing()]), expanded: true, markerPos: { x: 450, y: 300 }, wrapSize: { w: 900, h: 600 }, mapScale: 1 });
      const el = screen.getByTestId('bmap-card-plot:5');
      expect(el.style.getPropertyValue('--housing-bmap-clamp-x')).toBe('0px');
      expect(el.style.getPropertyValue('--housing-bmap-clamp-y')).toBe('0px');
    } finally { rectSpy.mockRestore(); }
  });
});
```

(既存の常時マウント/Esc/hover 開閉/gesture 抑止の describe はそのまま残す。`renderCard` から `flip` を消したことでこれらは影響を受けない。)

- [ ] **Step 5: BrowseWardMap.test.tsx を更新**

`renderMap` の既定 props に `onOpenPanel={() => {}}` を追加(型必須になったため)。他の既存アサーション(testid `bmap-card-plot:5` / `bmap-stage` transform / marker-pos closest / gesture 抑止 / zoom-pan)はそのまま通る。

- [ ] **Step 6: テスト + build**

Run: `npx vitest run src/__tests__/housing/MapSpotCard.test.tsx src/__tests__/housing/BrowseWardMap.test.tsx src/__tests__/housing/mapCardClamp.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 成功(未使用 import[ChevronLeft 等]/未使用変数が残っていれば tsc が落とすので掃除する)

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/browse/map/BrowseWardMap.tsx src/components/housing/browse/map/MapSpotCard.tsx src/styles/housing.css src/__tests__/housing/MapSpotCard.test.tsx src/__tests__/housing/BrowseWardMap.test.tsx
git commit -m "feat(housing): 探す地図カードを地図面へ移し家と一体ズーム+逆スケールpop (案B ②-c)"
```

- [ ] **Step 8: ユーザー実機チェック(引き継ぎ)**

DEV をハードリロード後、探す→地図→Mana/Anima→Mist 1区(ダミー稼働中)で目視:
1. パン/ズーム中、カードが家と完全一体で動く(震えない=カサカサ消滅)。
2. ホイール/ピンチでカードが家と一緒に拡縮する。
3. ホバー/フォーカスで、どの倍率でもカードが読めるフルサイズに膨らむ。ツアー追加/♡ ボタンが押せる。
4. コンテナ端のスポットでも膨らんだカードが見切れない(下端CTAが残る)。
5. 空白クリックで閉じる/カード上クリックで閉じない。単発スポットのカードクリックで詳細へ遷移。
6. backdrop-filter(カード背景ぼかし)が崩れていないか。崩れていたら報告(→ソリッド地へ切替)。

---

## Task 5: RoomListPanel 新規(②-b パネル本体)

大量部屋パネルのUI。`spot.listings`を振り分けてグリッド表示。まだ配線しない(次タスク)。

**Files:**
- Create: `src/components/housing/browse/map/RoomListPanel.tsx`
- Modify: `src/styles/housing.css`(roompanel スタイル + トークン1つ)
- Modify: `src/locales/{ja,en,ko,zh}.json`(5キー)
- Test: `src/__tests__/housing/RoomListPanel.test.tsx`(新規)

**Interfaces:**
- Consumes: `splitSpotListings`(Task2)、`ListingCard`、`BrowseMapSpot`。
- Produces: `RoomListPanel: React.FC<{ spot: BrowseMapSpot; onClose: () => void; onAddToTour: (id: string) => void }>`。

- [ ] **Step 1: i18n キー追記(4言語)**

各 `src/locales/{ja,en,ko,zh}.json` の `housing.map` ブロック内(`apartment_label` の後ろ)に textual 追記。既存 `plot_label`/`apartment_label` はパネルタイトルに再利用する。

ja:
```json
    "spot_open_panel": "{{count}}件を見る",
    "roompanel_back": "地図に戻る",
    "roompanel_house": "家全体",
    "roompanel_chambers": "個室 {{count}}件",
    "roompanel_all": "この区画の登録 {{count}}件"
```
en:
```json
    "spot_open_panel": "View {{count}}",
    "roompanel_back": "Back to map",
    "roompanel_house": "Entire house",
    "roompanel_chambers": "{{count}} private chambers",
    "roompanel_all": "{{count}} listings on this plot"
```
ko:
```json
    "spot_open_panel": "{{count}}건 보기",
    "roompanel_back": "지도로 돌아가기",
    "roompanel_house": "집 전체",
    "roompanel_chambers": "개인실 {{count}}건",
    "roompanel_all": "이 구획의 등록 {{count}}건"
```
zh:
```json
    "spot_open_panel": "查看{{count}}件",
    "roompanel_back": "返回地图",
    "roompanel_house": "整栋房屋",
    "roompanel_chambers": "个人房间 {{count}}件",
    "roompanel_all": "该区划的登记 {{count}}件"
```

(挿入位置の直前キーには末尾カンマが要る。ko/zh はネイティブ確認を将来別途[TODO Phase3 の翻訳実値]。)

- [ ] **Step 2: テスト(失敗させる)**

`src/__tests__/housing/RoomListPanel.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { RoomListPanel } from '../../components/housing/browse/map/RoomListPanel';
import type { BrowseMapSpot } from '../../lib/housing/browseMapSpots';
import type { MockListing } from '../../data/housing/mockListings';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({ lng: 'ja', fallbackLng: 'ja', resources: { ja: { translation: jaTranslations } }, interpolation: { escapeValue: false } });
  }
});

let seq = 0;
const L = (over: Partial<MockListing> = {}): MockListing => {
  seq += 1;
  return { id: `l-${seq}`, ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP', area: 'Mist', ward: 1, buildingType: 'house', plot: 5, size: 'M', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, addressKey: `k-${seq}`, ...over } as MockListing;
};
const spot = (over: Partial<BrowseMapSpot>): BrowseMapSpot => {
  const listings = over.listings ?? [L()];
  return { key: 'plot:5', kind: 'plot', plot: 5, listings, representative: listings[0], ...over };
};
const renderPanel = (s: BrowseMapSpot, onClose = vi.fn()) =>
  render(<I18nextProvider i18n={i18n}><MemoryRouter><RoomListPanel spot={s} onClose={onClose} onAddToTour={() => {}} /></MemoryRouter></I18nextProvider>);

describe('RoomListPanel', () => {
  it('戻るボタンで onClose を呼ぶ', () => {
    const onClose = vi.fn();
    renderPanel(spot({ listings: [L(), L()] }), onClose);
    fireEvent.click(screen.getByRole('button', { name: '地図に戻る' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('FC個室レイアウト: 家全体1件 + 個室ありのとき「家全体」と「個室 N件」の見出しを出す', () => {
    const house = L();
    const chambers = [L({ roomKind: 'private_chamber', roomNumber: 1 }), L({ roomKind: 'private_chamber', roomNumber: 2 })];
    renderPanel(spot({ kind: 'plot', listings: [house, ...chambers] }));
    expect(screen.getByText('家全体')).toBeTruthy();
    expect(screen.getByText('個室 2件')).toBeTruthy();
    expect(screen.getAllByTestId('housing-listing-card')).toHaveLength(3); // 家 + 個室2
  });

  it('アパート: タイトルにアパート、全部屋をグリッド表示', () => {
    const rooms = [L({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 1 }), L({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 2 })];
    renderPanel(spot({ key: 'apart:1', kind: 'apart', plot: 1, listings: rooms }));
    expect(screen.getByText('アパート')).toBeTruthy();
    expect(screen.getAllByTestId('housing-listing-card')).toHaveLength(2);
  });
});
```

Run: `npx vitest run src/__tests__/housing/RoomListPanel.test.tsx`
Expected: FAIL(RoomListPanel 未作成)

- [ ] **Step 3: RoomListPanel 実装**

`src/components/housing/browse/map/RoomListPanel.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import type { BrowseMapSpot } from '../../../../lib/housing/browseMapSpots';
import { splitSpotListings } from '../../../../lib/housing/browseMapSpots';
import { ListingCard } from '../ListingCard';

export interface RoomListPanelProps {
  spot: BrowseMapSpot;
  onClose: () => void;
  onAddToTour: (id: string) => void;
}

/**
 * 1スポット大量部屋の専用パネル (案B ②-b・spec §4)。地図に重なる A案。
 * spot.listings を家全体/個室/アパ部屋に振り分けてグリッド表示 (Firestore 再取得なし)。
 * FC個室 (家全体ちょうど1件 + 個室あり) は 家全体カードを上に、個室をグリッドに。
 * それ以外 (アパート / 家全体のみ / 重複登録) は全件グリッド。最大 512室 (個室) を想定し
 * content-visibility (ListingCard 内蔵) + contain-intrinsic-size (CSS) で軽く保つ。
 */
export const RoomListPanel: React.FC<RoomListPanelProps> = ({ spot, onClose, onAddToTour }) => {
  const { t } = useTranslation();
  const groups = splitSpotListings(spot);
  const isApartment = spot.kind === 'apart';
  const title = isApartment ? t('housing.map.apartment_label') : t('housing.map.plot_label', { plot: spot.plot });

  const fcLayout = !isApartment && groups.houseWholes.length === 1 && groups.chambers.length > 0;
  const gridListings = isApartment
    ? groups.apartmentRooms
    : fcLayout
      ? groups.chambers
      : [...groups.houseWholes, ...groups.chambers];

  return (
    <div className="housing-bmap-roompanel" data-testid="bmap-roompanel" role="dialog" aria-label={title}>
      <div className="housing-bmap-roompanel-header">
        <button type="button" className="housing-bmap-roompanel-back" onClick={onClose}>
          <ChevronLeft size={16} aria-hidden="true" />
          {t('housing.map.roompanel_back')}
        </button>
        <span className="housing-bmap-roompanel-title">{title}</span>
      </div>
      <div className="housing-bmap-roompanel-body">
        {fcLayout && (
          <>
            <div className="housing-bmap-roompanel-section-label">{t('housing.map.roompanel_house')}</div>
            <div className="housing-bmap-roompanel-house">
              <ListingCard listing={groups.houseWholes[0]} onAddToTour={onAddToTour} />
            </div>
            <div className="housing-bmap-roompanel-section-label">
              {t('housing.map.roompanel_chambers', { count: groups.chambers.length })}
            </div>
          </>
        )}
        <div className="housing-bmap-roompanel-grid">
          {gridListings.map((l) => (
            <ListingCard key={l.id} listing={l} onAddToTour={onAddToTour} />
          ))}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: housing.css に roompanel スタイル + トークン追記**

`.housing-workspace` トークンブロック(L188 付近、`--housing-bmap-scale-collapsed` の近く)に追記:

```css
  /* 大量部屋パネルのスクロール上下端フェード距離 (スクロールバー代わり)。 */
  --housing-bmap-roompanel-fade: 24px;
```

housing.css の探す地図関連ブロックの末尾(`.housing-bmap-card-more:hover` の後ろ)に追記:

```css
/* ============================================================
 * RoomListPanel (②-b): 1スポット大量部屋の専用パネル (A案・地図に重なる)。
 * 地図はマウントしたまま裏に残す。質感A案 (濃紺フラット)・全 token 経由。
 * mask の #000/transparent は alpha 専用 (色トークン対象外・.housing-tour-steps-list と同規約)。
 * ============================================================ */
.housing-bmap-roompanel {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: var(--housing-panel-bg-solid);
  border-radius: inherit;
  animation: housing-bmap-roompanel-in 190ms ease;
}
@keyframes housing-bmap-roompanel-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.housing-bmap-roompanel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--housing-divider);
}
.housing-bmap-roompanel-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  appearance: none;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--housing-panel-border);
  background: transparent;
  color: var(--housing-text-dim);
  font-size: var(--housing-text-sm);
  transition: border-color 0.15s ease, color 0.15s ease;
}
.housing-bmap-roompanel-back:hover {
  border-color: var(--housing-honey-border);
  color: var(--housing-candle);
}
.housing-bmap-roompanel-title {
  font-size: var(--housing-text-md);
  font-weight: 600;
  color: var(--housing-text);
}
.housing-bmap-roompanel-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
  scrollbar-width: none; /* Firefox: スクロールバー非表示 (端はフェードで示す) */
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 var(--housing-bmap-roompanel-fade), #000 calc(100% - var(--housing-bmap-roompanel-fade)), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 var(--housing-bmap-roompanel-fade), #000 calc(100% - var(--housing-bmap-roompanel-fade)), transparent 100%);
}
.housing-bmap-roompanel-body::-webkit-scrollbar { display: none; } /* WebKit: スクロールバー非表示 */
.housing-bmap-roompanel-section-label {
  font-size: var(--housing-text-sm);
  color: var(--housing-text-mute);
  margin: 4px 0 10px;
}
.housing-bmap-roompanel-house {
  max-width: var(--housing-bmap-card-w);
  margin-bottom: 16px;
}
.housing-bmap-roompanel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--housing-listing-card-min-w), 1fr));
  gap: 12px;
}
/* 最大512室でも軽く: 画面外カードは描画スキップ (ListingCard は content-visibility:auto 内蔵)。 */
.housing-bmap-roompanel-grid .housing-listing-card {
  contain-intrinsic-size: 0 240px;
}
```

(`--housing-text-md` / `--housing-divider` / `--housing-panel-bg-solid` / `--housing-honey-border` / `--housing-candle` が housing.css に定義済みか grep で確認。未定義のものがあれば近い既存トークンに置換する[例: `--housing-text-md` 無ければ本文既定サイズトークン]。)

- [ ] **Step 5: テスト成功 + build**

Run: `npx vitest run src/__tests__/housing/RoomListPanel.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/components/housing/browse/map/RoomListPanel.tsx src/styles/housing.css src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/__tests__/housing/RoomListPanel.test.tsx
git commit -m "feat(housing): 大量部屋パネル RoomListPanel 新規 + i18n (案B ②-b)"
```

---

## Task 6: パネルを配線(BrowseMapView + Esc優先)

`panelSpotKey` state を持ち、複数スポットのクリックでパネルを開き、area/ward/kind/world 変更でリセット、Esc はパネル優先で閉じる。BrowseWardMap へ `onOpenPanel` を渡す。

**Files:**
- Modify: `src/components/housing/browse/map/BrowseMapView.tsx`
- Test: `src/__tests__/housing/BrowseMapView.test.tsx`(あれば追記・無ければ新規で最小結合テスト)

**Interfaces:**
- Consumes: `RoomListPanel`(Task5)、`BrowseWardMap.onOpenPanel`(Task4)。

- [ ] **Step 1: BrowseMapView 実装**

`src/components/housing/browse/map/BrowseMapView.tsx`:

(a) import 追加:

```tsx
import { useEffect, useState } from 'react';
import { RoomListPanel } from './RoomListPanel';
```
(`useEffect` は既存 import に含まれていればそのまま。)

(b) state 追加(既存 `expandedKey` の近く):

```tsx
  const [panelSpotKey, setPanelSpotKey] = useState<string | null>(null);
```

(c) パネルを開く/リセットのヘルパ。`handleAreaChange`/`handleWardChange`/`handleKindChange` の各所と world 初期化 effect に `setPanelSpotKey(null)` を追加(`setExpandedKey(null)` を呼んでいる箇所すべてに並べる)。開くハンドラ:

```tsx
  const openPanel = (key: string) => {
    setExpandedKey(null); // popped を閉じてから (Esc がパネル優先になる)
    setPanelSpotKey(key);
  };
```

(d) Esc でパネルを閉じる effect(early return より前・フックなので order 固定に注意。`servers.length!==1` 等の early return の**前**に置く):

```tsx
  useEffect(() => {
    if (!panelSpotKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelSpotKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelSpotKey]);
```

(e) `spots` 確定後に panelSpot を解決し、BrowseWardMap の後ろにパネルを描画:

```tsx
  const panelSpot = panelSpotKey ? spots.find((s) => s.key === panelSpotKey) ?? null : null;
```

return の `<BrowseWardMap ... />` に `onOpenPanel={openPanel}` を追加し、直後に:

```tsx
      {panelSpot && (
        <RoomListPanel
          spot={panelSpot}
          onClose={() => setPanelSpotKey(null)}
          onAddToTour={onAddToTour}
        />
      )}
```

- [ ] **Step 2: 結合テスト(happy-dom)**

`src/__tests__/housing/BrowseMapView.test.tsx`(既存があれば describe 追記、無ければ新規)。`useWardMapAsset` を ready モックし、servers を1件に絞った filter store 前提で、複数 listing の spot を作って「N件を見る」クリック→ `bmap-roompanel` 出現、`地図に戻る`→消滅、Esc→消滅 を検証する。フィルタ store / view store の準備は既存 BrowseWardMap.test / 他の housing 結合テストの流儀を踏襲する。

最小の代表アサーション(擬似・実際は Provider/store 準備を既存流儀で):

```tsx
it('複数スポットの「N件を見る」でパネルが開き、戻るで閉じる', () => {
  // ... ready モック + servers=[Anima] + 複数 listing の filtered を用意して render ...
  fireEvent.click(screen.getByRole('button', { name: /件を見る/ }));
  expect(screen.getByTestId('bmap-roompanel')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '地図に戻る' }));
  expect(screen.queryByTestId('bmap-roompanel')).toBeNull();
});
```

Run: `npx vitest run src/__tests__/housing/BrowseMapView.test.tsx`
Expected: PASS

- [ ] **Step 3: 全 housing テスト + build**

Run: `npx vitest run src/__tests__/housing src/lib/housing`
Expected: PASS

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/housing/browse/map/BrowseMapView.tsx src/__tests__/housing/BrowseMapView.test.tsx
git commit -m "feat(housing): 大量部屋パネルを配線 (発火/戻る/Esc優先・案B ②-b)"
```

- [ ] **Step 5: ユーザー実機チェック(引き継ぎ)**

DEV ハードリロード後、ダミー稼働の Mist 1区で:
7. 区画5(家1+個室30)クリック→パネル: 上に家全体、下に「個室 30件」グリッド、内部スクロール、端フェード。
8. アパート棟1(90室)クリック→パネル: 部屋グリッド、スクロール軽快(カクつかない)。
9. パネルの部屋カードからツアー追加ができる/カードクリックで詳細へ。
10. パネル表示中に Esc→パネルが閉じる(地図に戻る)。区/住宅街/ワールドを変えるとパネルが閉じる。
11. 単発スポット(1件)はパネルにならずホバー拡大のまま。

---

## Task 7: 総点検 + 仕上げ

**Files:** なし(検証と記録)

- [ ] **Step 1: 全テスト + build 最終確認**

Run: `npx vitest run`
Expected: 全 PASS(既存 2849+ 件が緑・新規追加分込み)

Run: `npm run build`
Expected: 成功

- [ ] **Step 2: housing.css 自己レビュー(トークン漏れ)**

`src/styles/housing.css` の追加分に `rgb(` / `rgba(` / `#[0-9a-f]{3,8}`(mask の #000 除く) / 生 `px` の色・寸法直書きが無いか grep。あれば token 化。

- [ ] **Step 3: spec §5 実機総点検12項目をユーザーへ引き継ぎ**

Task4 Step8(1-6) + Task6 Step5(7-11) に加え、最後の1項目:
12. backdrop-filter が崩れる場合の切替(`.housing-bmap-card` の background を `--housing-panel-bg-solid` にし backdrop-filter 行を削除)を、ユーザー報告があれば別コミットで対応。

- [ ] **Step 4: TODO.md に隣接課題を記録**

`docs/TODO.md` のハウジング残タスクに1行追記(spec §7): 「詳細ページの『他の部屋』が `findApartmentRoomsInWard` `limit(20)` / `findChambersInPlot` `limit(50)` で実最大(90/512)を下回り truncate する — 別タスクで limit 見直し」。

- [ ] **Step 5: ダミー削除は最終確認後(このタスクでは実行しない)**

②全体をユーザーが実機最終確認 → OK が出てから別途:
```bash
node scripts/seed-housing-overlap-dummy.mjs --clear
git rm scripts/seed-housing-overlap-dummy.mjs
```
→ main 反映 → `firebase deploy --only firestore`(PF rules+indexes 先)→ push。

---

## Self-Review(計画者チェック)

- **spec 網羅**: §3.1 card-plane=Task4 / §3.2 resting zoom=Task4 / §3.3 逆スケール pop=Task4 / §3.4 clamp 変換=Task1+Task4 / §3.5 backdrop-filter 保険=Task4 Step8-6・Task7 / §4.1 発火条件=Task4(MapSpotCard) / §4.2 パネル器=Task5+Task6 / §4.3 データ振り分け=Task2 / §4.4 性能=Task5(content-visibility) / §4.5 状態管理=Task6 / §5 総点検=Task4/6/7 / §6 ファイル=全タスク / §7 隣接課題=Task7 Step4。**網羅**。
- **プレースホルダ**: Task3/Task6 のテストは既存 Provider/store 流儀への差し込みを前提に擬似記法を含むが、実装コードは全て具体。テストの render ヘルパは既存ファイルの実体に合わせる旨を明記済み。
- **型整合**: `clampExpandedCardOffset`(flip 無し6引数)=Task1定義=Task4使用。`splitSpotListings`戻り値=Task2定義=Task5使用。`onOpenPanel`/`mapScale`=Task4定義=Task6接続。`onCardClick`=Task3定義=Task4使用。一致。
