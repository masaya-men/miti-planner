# ハウジングツアー 本物のナビ化 P2＋P4 統合 Implementation Plan（自動並べ替え＋全エリア地図＋実エーテライト起点＋ゴージャス経路）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツアーを「自動で最適な巡回順に並べ替え」、中央地図を全5エリア対応にし、**どの家でも毎回、その家の本物の最寄りエーテネットシャードから家の玄関まで、しっかりゴージャスに光る経路をアニメーション**する。

**Architecture:** 純関数 `orderTourStops` で巡回順を決定（開始点2箇所に配線）。中央地図の Mist ハードコードを撤去し、`resolveWardMapRef` + `WARD_MAP_LOADERS`（10マップ遅延ローダ）で「現在の目的地のワード地図」を非同期ロード。**元SVG（`docs/housing-maps-src/*.svg`）からエーテネットシャードの名前＋座標を抽出**し、P1 の per-plot 最寄りエーテライト名と**同一地図内でのみ**照合して「各家の起点ノード」を解決（本街/拡張は plot 1-30 / 31-60 で完全分離・クロス0を自動テストで保証）。座標解決はワード JSON を引数に取る純関数へ一般化し、起点ノード→家への道なり経路をゴージャスに描画する。

**Tech Stack:** TypeScript / React 18 / Zustand / react-i18next / Vitest（`pool: 'vmThreads'` 厳守）/ Node スクリプト（データ生成）。ビルドは `npm run build`（`tsc -b` 厳密）。

## 検証済みの前提（2026-07-04・実データで確認済）

- **エーテライト起点データは全復元可能**: `docs/housing-maps-src/*.svg`（全10枚）にシャードが名前付きグループ（entity 符号化 Japanese）で存在。プロトタイプで **全300区画マッチ=300/300・本街↔拡張クロス=0** を実証（`scratchpad/aeth_verify.mjs`）。
- **本街/拡張の分離は構造的**: 各家は plot 1-30=本街 / 31-60=拡張 で地図が決まり（`resolveWardMapRef`）、シャードは各地図のSVGからのみ抽出。拡張名には `[拡張街]` タグが残る。照合の正規化は `（…）` 括弧注記の除去のみ（`[拡張街]` タグは保持）。
- **全10マップは完全連結**: `node_1` から全31区画へ到達可（`buildRoutePathIn` が必ず経路を返せる）。ただし `node_1` はエーテライト位置ではない（起点は下記シャードノードを使う）。

## Global Constraints

- **憶測禁止・path:line 引用**（CLAUDE.md「推測を抑制する5原則」）。
- **i18n**: UI 文字列は i18n キー経由。追加/変更キーは **ja / en / zh / ko の4言語すべて**（`src/locales/*.json`）。tour の `src/components/housing/tour/__tests__/i18nParity.test.ts` が parity 検証。
- **ハウジング独自トンマナ**: 色・寸法・影は `--housing-*` トークン経由（`src/styles/housing.css`）。**ハードコード（rgb/rgba/hex/px 直書き）禁止**。新規 CSS は housing.css に token/クラスで追加。
- **地図 SVG host クラスは `.housing-map-svg-host` 固定**（赤線/赤丸ノード隠蔽 CSS がこのセレクタ配下でのみ有効）。
- **本街/拡張を混ぜない**（ユーザー厳命）: エーテライト照合は必ず「その家の地図（mapKey）内のシャード」に限定。自動テストで全300区画のクロス0を常時保証する。
- **生成データは非破壊**: 既存 10 ward JSON は変更しない。エーテライトは別ファイル `wardAetherytes.generated.json` に出力。
- **見た目の承認**: ゴージャス経路の視覚は実装後に実機（1489×2.58）スクショでユーザー承認を得る（housing-design.md の承認フロー・「実画面で1つずつ確認」）。
- **テスト**: `npx vitest run <path>`（`pool: 'vmThreads'` 削除厳禁・出力パイプ禁止）。純関数は元配列を mutate しない。
- **コミット**: 各タスク末尾で1コミット・日本語メッセージ。

---

## File Structure

**新規作成:**
- `scripts/parse-ward-aetherytes.mjs` — 元SVG10枚 → 各シャードの {name, x, y} 抽出 → 最寄りノードへ snap → `wardAetherytes.generated.json` 出力（P1名集合と同一地図内で照合）。
- `src/data/housing/wardAetherytes.generated.json` — `{ [mapKey]: Array<{ name, x, y, node }> }`（スクリプト生成）。
- `src/lib/housing/orderTourStops.ts` + `__tests__/orderTourStops.test.ts`
- `src/lib/housing/wardAetherytes.ts` — 生成JSONを読み `getMapAetherytes(mapKey)` を提供。
- `src/lib/housing/plotOrigin.ts` + `__tests__/plotOrigin.test.ts` — `getPlotOriginNode(area, plot)`。
- `src/lib/housing/buildTourMapPlacements.ts` + `__tests__/buildTourMapPlacements.test.ts`
- `src/lib/housing/useWardMapAsset.ts` + `__tests__/useWardMapAsset.test.ts`

**変更:**
- `src/lib/housing/wardRoute.ts`（`*In(json,...)` 一般化・既存 Mist export は委譲）+ `__tests__/wardRoute.test.ts`
- `src/lib/housing/tourNav.ts`（`isTourPlaceable` 追加・`isMistPlaceable` 削除）+ `__tests__/tourNav.test.ts`
- `src/components/housing/pages/FavoritesPage.tsx` / `BrowsePage.tsx`（開始時に並べ替え）
- `src/components/housing/tour/TourNavMap.tsx`（全面書き換え・ゴージャス経路）+ `__tests__/TourNavMap.test.tsx`
- `src/components/housing/pages/TourNavPage.tsx`（地図解決差し替え）+ `__tests__/TourNavPage.test.tsx`
- `src/components/housing/tour/TourRouteSteps.tsx`（`isTourPlaceable`）+ `__tests__/TourNextDestinationPanel.test.tsx`
- `src/locales/{ja,en,zh,ko}.json`（`map_pending` 更新・`map_none`/`map_error` 追加）
- `src/styles/housing.css`（ゴージャス経路のレイヤー用クラス/トークン・loading/none 状態）
- `docs/TODO.md`

---

### Task 1: `orderTourStops` 巡回順の純関数

**Files:** Create `src/lib/housing/orderTourStops.ts` / Test `src/lib/housing/__tests__/orderTourStops.test.ts`

**Interfaces:** Consumes `MockListing`, `HOUSING_AREAS`(`src/types/housing.ts`), `ALL_REGIONS`(`src/data/housing/dcServerMap.ts`)。Produces `orderTourStops<T>(listings): T[]` / `orderTourStopIds(ids, pool): string[]`。

- [ ] **Step 1: 失敗テスト** — `src/lib/housing/__tests__/orderTourStops.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import { orderTourStops, orderTourStopIds } from '../orderTourStops';

const listing = (over: Partial<MockListing>): MockListing => ({
  id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP',
  area: 'Mist', ward: 1, buildingType: 'house', plot: 1, size: 'M',
  addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, ...over,
});

describe('orderTourStops', () => {
  it('空配列はそのまま空配列', () => { expect(orderTourStops([])).toEqual([]); });

  it('元配列を mutate しない', () => {
    const input = [ listing({ id: 'b', region: 'NA', dc: 'Aether', server: 'Gilgamesh', addressKey: 'kb' }), listing({ id: 'a', region: 'JP', addressKey: 'ka' }) ];
    const snap = input.map((l) => l.id); orderTourStops(input);
    expect(input.map((l) => l.id)).toEqual(snap);
  });

  it('最上位はリージョン順 (JP→NA→EU→OCE)', () => {
    const input = [ listing({ id: 'eu', region: 'EU', dc: 'Chaos', server: 'Cerberus', addressKey: 'e' }), listing({ id: 'oce', region: 'OCE', dc: 'Materia', server: 'Bismarck', addressKey: 'o' }), listing({ id: 'jp', region: 'JP', addressKey: 'j' }), listing({ id: 'na', region: 'NA', dc: 'Aether', server: 'Gilgamesh', addressKey: 'n' }) ];
    expect(orderTourStops(input).map((l) => l.id)).toEqual(['jp', 'na', 'eu', 'oce']);
  });

  it('同リージョン内は DC → サーバー → エリア → 区 → 番地', () => {
    const input = [
      listing({ id: 'plot10', server: 'Anima', area: 'Mist', ward: 1, plot: 10, addressKey: 'k1' }),
      listing({ id: 'plot3', server: 'Anima', area: 'Mist', ward: 1, plot: 3, addressKey: 'k2' }),
      listing({ id: 'ward2', server: 'Anima', area: 'Mist', ward: 2, plot: 1, addressKey: 'k3' }),
      listing({ id: 'lav', server: 'Anima', area: 'LavenderBeds', ward: 1, plot: 1, addressKey: 'k4' }),
      listing({ id: 'srv', server: 'Asura', area: 'Mist', ward: 1, plot: 1, addressKey: 'k5' }),
      listing({ id: 'dc', dc: 'Meteor', server: 'Belias', area: 'Mist', ward: 1, plot: 1, addressKey: 'k6' }),
    ];
    expect(orderTourStops(input).map((l) => l.id)).toEqual(['plot3', 'plot10', 'ward2', 'lav', 'srv', 'dc']);
  });

  it('同 ward 内は house が apartment より先・apartment は 棟→部屋 昇順', () => {
    const input = [
      listing({ id: 'apt2', buildingType: 'apartment', plot: undefined, size: undefined, apartmentBuilding: 2, roomNumber: 1, addressKey: 'a2' }),
      listing({ id: 'apt1', buildingType: 'apartment', plot: undefined, size: undefined, apartmentBuilding: 1, roomNumber: 5, addressKey: 'a1' }),
      listing({ id: 'house', buildingType: 'house', plot: 30, addressKey: 'h' }),
    ];
    expect(orderTourStops(input).map((l) => l.id)).toEqual(['house', 'apt1', 'apt2']);
  });

  it('同住所 (同 addressKey) は隣接維持し lastConfirmedAt desc', () => {
    const input = [ listing({ id: 'other', addressKey: 'kk', plot: 20 }), listing({ id: 'dupA', addressKey: 'same', plot: 5, lastConfirmedAt: 100 }), listing({ id: 'dupB', addressKey: 'same', plot: 5, lastConfirmedAt: 900 }) ];
    expect(orderTourStops(input).map((l) => l.id)).toEqual(['dupB', 'dupA', 'other']);
  });
});

describe('orderTourStopIds', () => {
  it('pool の住所情報で id を並べ替える', () => {
    const pool = [ listing({ id: 'na', region: 'NA', dc: 'Aether', server: 'Gilgamesh', addressKey: 'n' }), listing({ id: 'jp', region: 'JP', addressKey: 'j' }) ];
    expect(orderTourStopIds(['na', 'jp'], pool)).toEqual(['jp', 'na']);
  });
  it('pool に無い id は末尾に元順で温存', () => {
    const pool = [listing({ id: 'jp', region: 'JP', addressKey: 'j' })];
    expect(orderTourStopIds(['ghost', 'jp'], pool)).toEqual(['jp', 'ghost']);
  });
});
```

- [ ] **Step 2: 失敗確認** — `npx vitest run src/lib/housing/__tests__/orderTourStops.test.ts` → FAIL
- [ ] **Step 3: 実装** — `src/lib/housing/orderTourStops.ts`

```ts
import type { MockListing } from '../../data/housing/mockListings';
import { HOUSING_AREAS } from '../../types/housing';
import { ALL_REGIONS } from '../../data/housing/dcServerMap';

type OrderableListing = Pick<MockListing,
  'region' | 'dc' | 'server' | 'area' | 'ward' | 'buildingType' | 'plot' | 'apartmentBuilding' | 'roomNumber' | 'addressKey' | 'lastConfirmedAt' | 'createdAt'>;

function regionIndex(r: string): number { const i = ALL_REGIONS.indexOf(r as typeof ALL_REGIONS[number]); return i === -1 ? ALL_REGIONS.length : i; }
function areaIndex(a: string): number { const i = HOUSING_AREAS.indexOf(a as typeof HOUSING_AREAS[number]); return i === -1 ? HOUSING_AREAS.length : i; }

function compareForTour(a: OrderableListing, b: OrderableListing): number {
  const rd = regionIndex(a.region) - regionIndex(b.region); if (rd !== 0) return rd;
  const dc = a.dc.localeCompare(b.dc); if (dc !== 0) return dc;
  const sv = a.server.localeCompare(b.server); if (sv !== 0) return sv;
  const ar = areaIndex(a.area) - areaIndex(b.area); if (ar !== 0) return ar;
  if (a.ward !== b.ward) return a.ward - b.ward;
  const aApt = a.buildingType === 'apartment', bApt = b.buildingType === 'apartment';
  if (aApt !== bApt) return aApt ? 1 : -1;
  if (aApt && bApt) { const bd = (a.apartmentBuilding ?? 0) - (b.apartmentBuilding ?? 0); if (bd !== 0) return bd; return (a.roomNumber ?? 0) - (b.roomNumber ?? 0); }
  return (a.plot ?? 0) - (b.plot ?? 0);
}

/** ツアー巡回順: リージョン→DC→サーバー→エリア→区→建物種別(house先)→番地。同住所(addressKey)は隣接維持。元配列は mutate しない。 */
export function orderTourStops<T extends OrderableListing>(listings: T[]): T[] {
  if (listings.length === 0) return [];
  const groups = new Map<string, T[]>();
  for (const l of listings) { const arr = groups.get(l.addressKey); if (arr) arr.push(l); else groups.set(l.addressKey, [l]); }
  for (const arr of groups.values()) arr.sort((a, b) => b.lastConfirmedAt - a.lastConfirmedAt || b.createdAt - a.createdAt);
  return Array.from(groups.values()).sort((a, b) => compareForTour(a[0], b[0])).flat();
}

/** id リストを pool の住所情報で並べ替える。pool に無い id は末尾に元順で温存。 */
export function orderTourStopIds(ids: string[], pool: MockListing[]): string[] {
  const byId = new Map(pool.map((l) => [l.id, l]));
  const known: MockListing[] = [], unknown: string[] = [];
  for (const id of ids) { const l = byId.get(id); if (l) known.push(l); else unknown.push(id); }
  return [...orderTourStops(known).map((l) => l.id), ...unknown];
}
```

- [ ] **Step 4: 通過確認** — `npx vitest run src/lib/housing/__tests__/orderTourStops.test.ts` → PASS
- [ ] **Step 5: コミット** — `git commit -m "feat(housing): ツアー巡回順の自動並べ替え純関数 orderTourStops (region→DC→server→area→ward→plot・同住所隣接)"`

---

### Task 2: ツアー開始点2箇所に並べ替えを配線

**Files:** Modify `FavoritesPage.tsx:111-118` / `BrowsePage.tsx:65-71`
**Interfaces:** Consumes `orderTourStopIds`。FavoritesPage は `allListings`、BrowsePage は `merged`（両方とも全 pool・view 絞り込み前）。

- [ ] **Step 1** FavoritesPage import 追加: `import { orderTourStopIds } from '../../../lib/housing/orderTourStops';`
- [ ] **Step 2** `commitStart` を並べ替え対応に:

```ts
  const commitStart = useCallback(() => {
    if (trayIds.length === 0) return;
    const orderedIds = orderTourStopIds(trayIds, allListings);
    useHousingTourStore.getState().setListings(orderedIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
    setMannerOpen(false);
    navigate('/housing/tour');
  }, [trayIds, allListings, navigate]);
```

- [ ] **Step 3** BrowsePage import 追加（同上）。
- [ ] **Step 4** `onStart` を並べ替え対応に:

```ts
  const onStart = () => {
    if (trayIds.length === 0) return;
    const orderedIds = orderTourStopIds(trayIds, merged);
    useHousingTourStore.getState().setListings(orderedIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
    navigate('/housing/tour');
  };
```

- [ ] **Step 5** `npm run build` → EXIT 0
- [ ] **Step 6** コミット: `git commit -m "feat(housing): ツアー開始時に orderTourStopIds で巡回順へ自動並べ替え (探す/お気に入り両入口)"`

---

### Task 3: エーテライト起点データ生成パイプライン（本街/拡張 分離・クロス0）

**Files:** Create `scripts/parse-ward-aetherytes.mjs` / 生成 `src/data/housing/wardAetherytes.generated.json` / Create `src/lib/housing/wardAetherytes.ts`

**Interfaces:** Produces
- `wardAetherytes.generated.json`: `{ [mapKey: string]: Array<{ name: string; x: number; y: number; node: string }> }`（x,y は 0..1 正規化・node はそのワード JSON の最寄りノード id）。
- `wardAetherytes.ts`: `getMapAetherytes(mapKey: string): Array<{ name: string; x: number; y: number; node: string }>`。

> このアルゴリズムはプロトタイプで **全300区画マッチ=300/300・クロス0** を実証済（`scratchpad/aeth_verify.mjs`）。mapKey ↔ 元SVG ↔ ward JSON の対応は下表:
> | area | mainKey / SVG / wardJSON | subKey / SVG / wardJSON |
> |---|---|---|
> | Mist | mist / mist.svg / mistWard | mist-sub / mist-sub.svg / mistSubWard |
> | LavenderBeds | lavender / lavender-main.svg / lavenderWard | lavender-sub / lavender-sub.svg / lavenderSubWard |
> | Goblet | goblet / goblet-main.svg / gobletWard | goblet-sub / goblet-sub.svg / gobletSubWard |
> | Shirogane | shirogane / shirogane-main.svg / shiroganeWard | shirogane-sub / shirogane-sub.svg / shiroganeSubWard |
> | Empyreum | empyreum / empyreum-main.svg / empyreumWard | empyreum-sub / empyreum-sub.svg / empyreumSubWard |

- [ ] **Step 1: 生成スクリプトを作成** — `scripts/parse-ward-aetherytes.mjs`

```js
// 元SVG(docs/housing-maps-src/*.svg) からエーテネットシャードの名前+座標を抽出し、
// 各マップの ward JSON の最寄りノードへ snap して wardAetherytes.generated.json を生成する。
// 照合対象は P1 wardDirections の per-plot 最寄りエーテライト名集合(同一地図内のみ)。本街/拡張は完全分離。
import { readFileSync, writeFileSync } from 'node:fs';

function decode(s) {
  const parts = s.split(/(&#\d+;)/); const b = [];
  for (const p of parts) { const m = p.match(/^&#(\d+);$/); if (m) b.push(Number(m[1])); else for (const ch of Buffer.from(p, 'utf8')) b.push(ch); }
  return Buffer.from(b).toString('utf8');
}
const nums = (s) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
const norm = (s) => s.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();

// depth-aware group 抽出: {name, inner}[]
function groups(svg) {
  const res = [], stack = [], re = /<g\b([^>]*)>|<\/g>/g; let m;
  while ((m = re.exec(svg))) {
    if (m[0] === '</g>') { const g = stack.pop(); if (g) res.push({ name: g.name, inner: svg.slice(g.contentStart, m.index) }); }
    else { const idm = m[1].match(/\bid="([^"]*)"/); stack.push({ name: idm ? decode(idm[1]) : null, contentStart: re.lastIndex }); }
  }
  return res;
}
function bboxCenter(inner) {
  const ds = [...inner.matchAll(/\sd="([^"]+)"/g)].map((x) => x[1]).join(' ');
  const extra = [...inner.matchAll(/\s(?:x|y|cx|cy)="(-?[\d.]+)"/g)].map((x) => x[1]).join(' ');
  const ns = nums(ds + ' ' + extra); let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (let i = 0; i + 1 < ns.length; i += 2) { const x = ns[i], y = ns[i + 1]; if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  if (!isFinite(a)) return null; return { x: (a + c) / 2, y: (b + d) / 2 };
}
function nearestNode(ward, x, y) { let best = null, bd = Infinity; for (const n of ward.nodes) { const dd = Math.hypot(n.x - x, n.y - y); if (dd < bd) { bd = dd; best = n; } } return best ? best.id : null; }

const AREAS = [
  { area: 'Mist', main: ['mist', 'mist.svg', 'mistWard'], sub: ['mist-sub', 'mist-sub.svg', 'mistSubWard'] },
  { area: 'LavenderBeds', main: ['lavender', 'lavender-main.svg', 'lavenderWard'], sub: ['lavender-sub', 'lavender-sub.svg', 'lavenderSubWard'] },
  { area: 'Goblet', main: ['goblet', 'goblet-main.svg', 'gobletWard'], sub: ['goblet-sub', 'goblet-sub.svg', 'gobletSubWard'] },
  { area: 'Shirogane', main: ['shirogane', 'shirogane-main.svg', 'shiroganeWard'], sub: ['shirogane-sub', 'shirogane-sub.svg', 'shiroganeSubWard'] },
  { area: 'Empyreum', main: ['empyreum', 'empyreum-main.svg', 'empyreumWard'], sub: ['empyreum-sub', 'empyreum-sub.svg', 'empyreumSubWard'] },
];
const wd = JSON.parse(readFileSync('src/data/housing/wardDirections.generated.json', 'utf8'));
const out = {};
let total = 0, matched = 0;
for (const A of AREAS) {
  for (const seg of [{ m: A.main, lo: 1, hi: 30 }, { m: A.sub, lo: 31, hi: 60 }]) {
    const [mapKey, svgFile, wardKey] = seg.m;
    const svg = readFileSync(`docs/housing-maps-src/${svgFile}`, 'utf8');
    const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const W = +vb[1], H = +vb[2];
    const ward = JSON.parse(readFileSync(`src/data/housing/${wardKey}.generated.json`, 'utf8'));
    const targets = new Set(); for (let p = seg.lo; p <= seg.hi; p++) { const n = wd[A.area][p]?.aetheryte; if (n) targets.add(norm(n)); }
    const byNorm = new Map();
    for (const g of groups(svg)) { if (!g.name) continue; const key = norm(g.name); if (!targets.has(key) || byNorm.has(key)) continue; const c = bboxCenter(g.inner); if (!c) continue; byNorm.set(key, { name: g.name, x: +(c.x / W).toFixed(5), y: +(c.y / H).toFixed(5) }); }
    const shards = [...byNorm.values()].map((s) => ({ ...s, node: nearestNode(ward, s.x, s.y) }));
    out[mapKey] = shards;
    // カバレッジ検算
    for (let p = seg.lo; p <= seg.hi; p++) { total++; const n = wd[A.area][p]?.aetheryte; if (n && byNorm.has(norm(n))) matched++; }
  }
}
writeFileSync('src/data/housing/wardAetherytes.generated.json', JSON.stringify(out, null, 2));
console.log(`wardAetherytes.generated.json 出力。カバレッジ ${matched}/${total}`);
for (const k of Object.keys(out)) console.log(`  ${k}: ${out[k].length} shards (node 未 snap = ${out[k].filter((s) => !s.node).length})`);
```

- [ ] **Step 2: 生成実行** — `node scripts/parse-ward-aetherytes.mjs`
Expected: `カバレッジ 300/300`、各 mapKey に 6〜8 shards、`node 未 snap = 0`。

- [ ] **Step 3: `wardAetherytes.ts` を実装**

```ts
import data from '../../data/housing/wardAetherytes.generated.json';

export interface WardAetheryte { name: string; x: number; y: number; node: string }
const TABLE = data as Record<string, WardAetheryte[]>;

/** mapKey → そのワード地図のエーテネットシャード一覧 (x,y は 0..1 正規化・node は最寄りノード)。 */
export function getMapAetherytes(mapKey: string): WardAetheryte[] {
  return TABLE[mapKey] ?? [];
}
```

- [ ] **Step 4: 生成データの妥当性テスト** — `src/lib/housing/__tests__/wardAetherytes.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { getMapAetherytes } from '../wardAetherytes';
import { WARD_MAP_LOADERS } from '../../data/housing/wardMapManifest';

describe('wardAetherytes.generated.json', () => {
  it('全 mapKey にシャードがあり x,y は 0..1・node は非空', () => {
    for (const mapKey of Object.keys(WARD_MAP_LOADERS)) {
      const shards = getMapAetherytes(mapKey);
      expect(shards.length, mapKey).toBeGreaterThan(0);
      for (const s of shards) {
        expect(s.x, `${mapKey} ${s.name} x`).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(1);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(1);
        expect(s.node.length, `${mapKey} ${s.name} node`).toBeGreaterThan(0);
      }
    }
  });

  it('拡張街(-sub) の shard 名は [拡張街] 付き・本街は付かない (本街/拡張の分離)', () => {
    for (const mapKey of Object.keys(WARD_MAP_LOADERS)) {
      const isSub = mapKey.endsWith('-sub');
      for (const s of getMapAetherytes(mapKey)) {
        expect(s.name.startsWith('[拡張街]'), `${mapKey} ${s.name}`).toBe(isSub);
      }
    }
  });
});
```

- [ ] **Step 5: 通過確認 + snap ノードが実在すること** — `npx vitest run src/lib/housing/__tests__/wardAetherytes.test.ts` → PASS
- [ ] **Step 6: コミット** — `git add scripts/parse-ward-aetherytes.mjs src/data/housing/wardAetherytes.generated.json src/lib/housing/wardAetherytes.ts src/lib/housing/__tests__/wardAetherytes.test.ts` → `git commit -m "feat(housing): エーテネットシャード座標データ生成(全10マップ・本街/拡張分離・最寄りノードsnap)"`

---

### Task 4: `getPlotOriginNode` 起点解決（全300区画・クロス0を自動保証）

**Files:** Create `src/lib/housing/plotOrigin.ts` / Test `src/lib/housing/__tests__/plotOrigin.test.ts`

**Interfaces:** Consumes `getPlotDirections`(`wardDirections.ts`), `resolveWardMapRef`, `getMapAetherytes`(Task 3)。Produces:
- `getPlotOriginNode(area: string, plot: number | null | undefined): { node: string; aetheryte: string; x: number; y: number } | null`

> P1名の正規化は `（…）` 括弧注記の除去のみ（`[拡張街]` タグは保持）。照合は必ず `resolveWardMapRef` が返す mapKey のシャード内でのみ行う＝本街/拡張の混在は構造的に不可能。

- [ ] **Step 1: 失敗テスト** — `src/lib/housing/__tests__/plotOrigin.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { getPlotOriginNode } from '../plotOrigin';

describe('getPlotOriginNode', () => {
  it('全5エリア×全60区画で起点ノードが解決できる (300/300)', () => {
    for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum']) {
      for (let p = 1; p <= 60; p++) {
        const o = getPlotOriginNode(area, p);
        expect(o, `${area} ${p}`).not.toBeNull();
        expect(o!.node.length).toBeGreaterThan(0);
      }
    }
  });

  it('本街(1-30)は非[拡張街]シャード・拡張街(31-60)は[拡張街]シャードに解決 (クロス0)', () => {
    for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum']) {
      for (let p = 1; p <= 30; p++) expect(getPlotOriginNode(area, p)!.aetheryte.startsWith('[拡張街]'), `${area} ${p}`).toBe(false);
      for (let p = 31; p <= 60; p++) expect(getPlotOriginNode(area, p)!.aetheryte.startsWith('[拡張街]'), `${area} ${p}`).toBe(true);
    }
  });

  it('plot 無し/範囲外/未知エリアは null', () => {
    expect(getPlotOriginNode('Mist', null)).toBeNull();
    expect(getPlotOriginNode('Mist', 61)).toBeNull();
    expect(getPlotOriginNode('Nowhere', 1)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗確認** — `npx vitest run src/lib/housing/__tests__/plotOrigin.test.ts` → FAIL
- [ ] **Step 3: 実装** — `src/lib/housing/plotOrigin.ts`

```ts
import { getPlotDirections } from './wardDirections';
import { resolveWardMapRef } from './resolveWardMapRef';
import { getMapAetherytes } from './wardAetherytes';

const norm = (s: string) => s.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();

/**
 * 家(area, plot)の「最寄りエーテネットシャード起点」を解決する純関数。
 * P1名 → 正規化 → その家の地図(mapKey)のシャードとのみ照合(本街/拡張の混在なし) → 起点ノード+座標。
 * 照合不可(データ欠落)は null (呼び出し側で区の基準点にフォールバック)。
 */
export function getPlotOriginNode(
  area: string,
  plot: number | null | undefined,
): { node: string; aetheryte: string; x: number; y: number } | null {
  const dir = getPlotDirections(area, plot);
  if (!dir) return null;
  const ref = resolveWardMapRef(area, plot ?? null, null, 'house');
  if (!ref) return null;
  const key = norm(dir.aetheryte);
  const shard = getMapAetherytes(ref.mapKey).find((s) => norm(s.name) === key);
  if (!shard || !shard.node) return null;
  return { node: shard.node, aetheryte: shard.name, x: shard.x, y: shard.y };
}
```

- [ ] **Step 4: 通過確認（300/300・クロス0）** — `npx vitest run src/lib/housing/__tests__/plotOrigin.test.ts` → PASS
- [ ] **Step 5: コミット** — `git commit -m "feat(housing): getPlotOriginNode(各家の最寄りエーテライト起点・本街/拡張分離をテストで保証)"`

---

### Task 5: `wardRoute` をワード JSON 引数の一般化版に

**Files:** Modify `src/lib/housing/wardRoute.ts` / Test `src/lib/housing/__tests__/wardRoute.test.ts`

**Interfaces:** 追加 export `plotToPlacementIn(json, plot, kind?)` / `nodeToPointIn(json, nodeId)` / `buildRoutePathIn(json, originNodeId, goalNodeId)`。既存 `MAP_VIEWBOX`/`WARD_CENTER_NODE`/`plotToPlacement`/`nodeToPoint`/`buildRoutePath`/`Placement` は Mist 委譲で後方互換維持。

- [ ] **Step 1: 非 Mist JSON の失敗テストを追記**（`gobletWard` を使用）

```ts
import { plotToPlacementIn, nodeToPointIn, buildRoutePathIn } from '../wardRoute';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import gobletWardRaw from '../../../data/housing/gobletWard.generated.json';
const gobletWard = gobletWardRaw as unknown as WardMapJson;

describe('wardRoute *In (ワード JSON 引数・非 Mist で成立)', () => {
  it('plotToPlacementIn: 既知 plot は px 座標', () => { const p = plotToPlacementIn(gobletWard, 1); expect(p).not.toBeNull(); expect(p!.x).toBeGreaterThan(0); });
  it('plotToPlacementIn: 存在しない plot は null', () => { expect(plotToPlacementIn(gobletWard, 999)).toBeNull(); });
  it('nodeToPointIn: 先頭ノードは座標・未知は null', () => { expect(nodeToPointIn(gobletWard, gobletWard.nodes[0].id)).not.toBeNull(); expect(nodeToPointIn(gobletWard, 'node_zzz')).toBeNull(); });
  it('buildRoutePathIn: 玄関ノードを持つ家まで経路が引ける', () => { const h = gobletWard.houses.find((x) => x.kind === 'plot' && x.node); const path = buildRoutePathIn(gobletWard, gobletWard.nodes[0].id, h!.node!); expect(path).toMatch(/^M/); });
  it('buildRoutePathIn: 未知ノードは null', () => { expect(buildRoutePathIn(gobletWard, gobletWard.nodes[0].id, 'node_zzz')).toBeNull(); });
});
```

- [ ] **Step 2: 失敗確認** — `npx vitest run src/lib/housing/__tests__/wardRoute.test.ts` → FAIL
- [ ] **Step 3: `wardRoute.ts` を一般化版へ**（既存内部の BFS/edge 連結ロジックを json 引数化。既存 Mist export は委譲）

```ts
import mistWardRaw from '../../data/housing/mistWard.generated.json';
import type { WardMapJson } from '../../data/housing/wardMapManifest';

const mistWard = mistWardRaw as unknown as WardMapJson;
export const MAP_VIEWBOX = { w: mistWard.viewBox.w, h: mistWard.viewBox.h };
export const WARD_CENTER_NODE = 'node_1';
export interface Placement { x: number; y: number; nodeId: string | null }
type EdgeData = { a: string; b: string; polyline: [number, number][] };

function buildAdjacency(json: WardMapJson): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of json.edges) { (m.get(e.a) ?? m.set(e.a, []).get(e.a)!).push(e.b); (m.get(e.b) ?? m.set(e.b, []).get(e.b)!).push(e.a); }
  return m;
}
function routeNodes(adj: Map<string, string[]>, startId: string, goalId: string): string[] {
  const prev: Record<string, string | null> = { [startId]: null }; const q = [startId];
  while (q.length) { const cur = q.shift()!; if (cur === goalId) break; for (const nx of adj.get(cur) ?? []) if (!(nx in prev)) { prev[nx] = cur; q.push(nx); } }
  if (!(goalId in prev)) return [];
  const path: string[] = []; let c: string | null = goalId; while (c) { path.unshift(c); c = prev[c]; } return path;
}
export function plotToPlacementIn(json: WardMapJson, plot: number, kind: 'plot' | 'apart' = 'plot'): Placement | null {
  const h = json.houses.find((x) => x.plot === plot && x.kind === kind); if (!h) return null;
  return { x: h.x * json.viewBox.w, y: h.y * json.viewBox.h, nodeId: h.node };
}
export function nodeToPointIn(json: WardMapJson, nodeId: string): { x: number; y: number } | null {
  const n = json.nodes.find((x) => x.id === nodeId); if (!n) return null;
  return { x: n.x * json.viewBox.w, y: n.y * json.viewBox.h };
}
export function buildRoutePathIn(json: WardMapJson, originNodeId: string, goalNodeId: string): string | null {
  const nodeById = new Map(json.nodes.map((n) => [n.id, n]));
  if (!nodeById.has(originNodeId) || !nodeById.has(goalNodeId)) return null;
  const w = json.viewBox.w, h = json.viewBox.h; const edges = json.edges as unknown as EdgeData[];
  const ids = routeNodes(buildAdjacency(json), originNodeId, goalNodeId); if (ids.length === 0) return null;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ids.length; i++) {
    const a = ids[i], b = ids[i + 1];
    const e = edges.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!e) { if (i === 0) { const aN = nodeById.get(a)!; pts.push([aN.x * w, aN.y * h]); } const bN = nodeById.get(b)!; pts.push([bN.x * w, bN.y * h]); continue; }
    const seg = e.a === a ? e.polyline : e.polyline.slice().reverse();
    const segPx = seg.map(([px, py]) => [px * w, py * h] as [number, number]);
    if (i === 0) pts.push(...segPx); else pts.push(...segPx.slice(1));
  }
  if (pts.length === 0) { const n = nodeById.get(goalNodeId)!; pts.push([n.x * w, n.y * h]); }
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}
export function plotToPlacement(plot: number, kind: 'plot' = 'plot'): Placement | null { return plotToPlacementIn(mistWard, plot, kind); }
export function nodeToPoint(nodeId: string): { x: number; y: number } | null { return nodeToPointIn(mistWard, nodeId); }
export function buildRoutePath(originNodeId: string, goalNodeId: string): string | null { return buildRoutePathIn(mistWard, originNodeId, goalNodeId); }
```

- [ ] **Step 4: 通過確認（新旧両方）** — `npx vitest run src/lib/housing/__tests__/wardRoute.test.ts` → PASS
- [ ] **Step 5: コミット** — `git commit -m "refactor(housing): wardRoute をワード JSON 引数の一般化版(*In)に・Mist export は委譲で後方互換"`

---

### Task 6: `useWardMapAsset` 非同期ワード地図ローダ hook

**Files:** Create `src/lib/housing/useWardMapAsset.ts` / Test `src/lib/housing/__tests__/useWardMapAsset.test.ts`

**Interfaces:** `WardMapAssetState = {status:'idle'}|{status:'loading'}|{status:'ready';json;svg}|{status:'error'}`、`useWardMapAsset(mapKey: string | null): WardMapAssetState`。（`WardMapPreview.tsx:42-59` のパターンを抽出。WardMapPreview 本体は非改変=scope discipline。）

- [ ] **Step 1: 失敗テスト**

```ts
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWardMapAsset } from '../useWardMapAsset';

describe('useWardMapAsset', () => {
  it('mapKey=null は idle', () => { const { result } = renderHook(() => useWardMapAsset(null)); expect(result.current.status).toBe('idle'); });
  it('既知 mapKey は最終的に ready で json/svg を持つ', async () => {
    const { result } = renderHook(() => useWardMapAsset('mist'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status === 'ready') { expect(result.current.json.viewBox.w).toBeGreaterThan(0); expect(typeof result.current.svg).toBe('string'); }
  });
});
```

- [ ] **Step 2: 失敗確認** — `npx vitest run src/lib/housing/__tests__/useWardMapAsset.test.ts` → FAIL
- [ ] **Step 3: 実装**

```ts
import { useEffect, useState } from 'react';
import { WARD_MAP_LOADERS, type WardMapJson } from '../../data/housing/wardMapManifest';

export type WardMapAssetState =
  | { status: 'idle' } | { status: 'loading' }
  | { status: 'ready'; json: WardMapJson; svg: string } | { status: 'error' };

/** mapKey → WARD_MAP_LOADERS で該当ワード地図(json+inline svg)だけ遅延ロード。mapKey=null は idle。 */
export function useWardMapAsset(mapKey: string | null): WardMapAssetState {
  const [state, setState] = useState<WardMapAssetState>({ status: 'idle' });
  useEffect(() => {
    if (!mapKey) { setState({ status: 'idle' }); return; }
    const loader = WARD_MAP_LOADERS[mapKey];
    if (!loader) { setState({ status: 'error' }); return; }
    let cancelled = false; setState({ status: 'loading' });
    loader().then(({ json, svg }) => { if (!cancelled) setState({ status: 'ready', json, svg }); })
            .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [mapKey]);
  return state;
}
```

- [ ] **Step 4: 通過確認** — `npx vitest run src/lib/housing/__tests__/useWardMapAsset.test.ts` → PASS
- [ ] **Step 5: コミット** — `git commit -m "feat(housing): useWardMapAsset (mapKey→ワード地図遅延ロード hook)"`

---

### Task 7: `isTourPlaceable` ＋ `buildTourMapPlacements`（実エーテライト起点で毎回経路）

**Files:** Modify `src/lib/housing/tourNav.ts` + `__tests__/tourNav.test.ts` / Create `src/lib/housing/buildTourMapPlacements.ts` + `__tests__/buildTourMapPlacements.test.ts`

**Interfaces:**
- `isTourPlaceable(listing): boolean`（tourNav に追加・`isMistPlaceable` は Task 9 まで残す）。
- `TourMapPlacement { index; x; y; status }` / `TourMapModel { target; placed; routePath; origin }`（`origin` は `{ x; y } | null` = エーテライトシャード座標マーカー）。
- `buildTourMapPlacements(json, mapKey, ref, currentListing, steps, currentIndex): TourMapModel`。

- [ ] **Step 1: `isTourPlaceable` 失敗テスト**（tourNav.test.ts に追記）

```ts
import { isTourPlaceable } from '../tourNav';
import type { MockListing } from '../../../data/housing/mockListings';
const placeable = (over: Partial<MockListing>): MockListing => ({ id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP', area: 'LavenderBeds', ward: 1, buildingType: 'house', plot: 6, size: 'M', addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, ...over });

describe('isTourPlaceable (全5エリア対応)', () => {
  it('全5エリアの house(1-60)/apartment は配置可能', () => {
    for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum'] as const) {
      expect(isTourPlaceable(placeable({ area, plot: 6 }))).toBe(true);
      expect(isTourPlaceable(placeable({ area, plot: 45 }))).toBe(true);
    }
    expect(isTourPlaceable(placeable({ buildingType: 'apartment', plot: undefined, apartmentBuilding: 2, roomNumber: 3 }))).toBe(true);
  });
  it('plot 無し house / 未知エリア / null は不可', () => {
    expect(isTourPlaceable(placeable({ buildingType: 'house', plot: undefined }))).toBe(false);
    expect(isTourPlaceable(placeable({ area: 'Nowhere' as MockListing['area'] }))).toBe(false);
    expect(isTourPlaceable(null)).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認 → 実装** — tourNav.ts に追加:

```ts
import { resolveWardMapRef } from './resolveWardMapRef';
/** P2: 全5エリア対応。ワード地図に解決できる listing(house 1-60 / apartment)が配置対象。 */
export function isTourPlaceable(listing: MockListing | null): boolean {
  if (!listing) return false;
  return resolveWardMapRef(listing.area, listing.plot ?? null, listing.apartmentBuilding ?? null, listing.buildingType) !== null;
}
```
`npx vitest run src/lib/housing/__tests__/tourNav.test.ts` → PASS

- [ ] **Step 3: `buildTourMapPlacements` 失敗テスト** — `src/lib/housing/__tests__/buildTourMapPlacements.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import mistWardRaw from '../../../data/housing/mistWard.generated.json';
import { resolveWardMapRef } from '../resolveWardMapRef';
import type { TourStep } from '../tourNav';
import { buildTourMapPlacements } from '../buildTourMapPlacements';
const mistWard = mistWardRaw as unknown as WardMapJson;
const L = (over: Partial<MockListing>): MockListing => ({ id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP', area: 'Mist', ward: 1, buildingType: 'house', plot: 6, size: 'M', addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, ...over });
const step = (l: MockListing | null): TourStep => ({ id: l?.id ?? 'none', listing: l });
const mistRef = (plot: number) => resolveWardMapRef('Mist', plot, null, 'house')!;

describe('buildTourMapPlacements', () => {
  it('現在の目的地 plot の target 座標を返す', () => {
    const cur = L({ id: 'a', plot: 6 }); const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    expect(m.target).not.toBeNull(); expect(m.target!.x).toBeGreaterThan(0);
  });
  it('実エーテライト起点から家までの経路を毎回返す (起点マーカーも)', () => {
    const cur = L({ id: 'a', plot: 6 }); const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    expect(m.routePath).toMatch(/^M/);   // 直前の家に依存せず常に経路がある
    expect(m.origin).not.toBeNull();     // エーテライトシャード座標マーカー
  });
  it('同一ワード地図の他ステップだけ placed に含める (拡張街は別 mapKey で除外)', () => {
    const steps = [ step(L({ id: 'a', plot: 6 })), step(L({ id: 'b', plot: 40 })), step(L({ id: 'c', plot: 12 })) ];
    const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, steps[0].listing, steps, 0);
    expect(m.placed.map((p) => p.index).sort()).toEqual([0, 2]);
  });
});
```

- [ ] **Step 4: 失敗確認 → 実装** — `src/lib/housing/buildTourMapPlacements.ts`

```ts
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { MockListing } from '../../data/housing/mockListings';
import { resolveWardMapRef } from './resolveWardMapRef';
import { plotToPlacementIn, buildRoutePathIn } from './wardRoute';
import { getPlotOriginNode } from './plotOrigin';
import { stepStatus, type StepStatus, type TourStep } from './tourNav';

export interface TourMapPlacement { index: number; x: number; y: number; status: StepStatus }
export interface TourMapModel {
  target: { x: number; y: number } | null;   // 現在の目的地(家)ハイライト中心
  placed: TourMapPlacement[];                  // 同一ワード地図の全ステップ番号ノード
  routePath: string | null;                    // 起点(エーテライト)→家 の道なり (毎回)
  origin: { x: number; y: number } | null;     // エーテライトシャード座標マーカー
}

function refOf(listing: TourStep['listing']) {
  if (!listing) return null;
  return resolveWardMapRef(listing.area, listing.plot ?? null, listing.apartmentBuilding ?? null, listing.buildingType);
}

/**
 * 「現在の目的地の家」に対する地図配置モデル。起点は必ずその家の最寄りエーテネットシャード(getPlotOriginNode)。
 * 起点ノード → 家の玄関ノード の道なり経路を毎回描く(直前の家に依存しない)。
 */
export function buildTourMapPlacements(
  json: WardMapJson,
  mapKey: string,
  ref: { highlightPlot: number; highlightKind: 'plot' | 'apart' },
  currentListing: MockListing | null,
  steps: TourStep[],
  currentIndex: number,
): TourMapModel {
  const targetPlacement = plotToPlacementIn(json, ref.highlightPlot, ref.highlightKind);
  const target = targetPlacement ? { x: targetPlacement.x, y: targetPlacement.y } : null;

  const placed: TourMapPlacement[] = [];
  for (let i = 0; i < steps.length; i++) {
    const r = refOf(steps[i].listing);
    if (!r || r.mapKey !== mapKey) continue;
    const p = plotToPlacementIn(json, r.highlightPlot, r.highlightKind);
    if (!p) continue;
    placed.push({ index: i, x: p.x, y: p.y, status: stepStatus(i, currentIndex) });
  }

  // 起点 = 現在の家の最寄りエーテネットシャード。ノード→玄関ノードの道なり + 玄関座標へ最後の1ホップ。
  let routePath: string | null = null;
  let origin: { x: number; y: number } | null = null;
  const originInfo = currentListing ? getPlotOriginNode(currentListing.area, currentListing.plot) : null;
  if (originInfo && targetPlacement && targetPlacement.nodeId) {
    const base = buildRoutePathIn(json, originInfo.node, targetPlacement.nodeId);
    if (base) routePath = `${base} L${targetPlacement.x.toFixed(1)} ${targetPlacement.y.toFixed(1)}`;
    origin = { x: originInfo.x * json.viewBox.w, y: originInfo.y * json.viewBox.h };
  }

  return { target, placed, routePath, origin };
}
```

- [ ] **Step 5: 通過確認** — `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts src/lib/housing/__tests__/tourNav.test.ts` → PASS
- [ ] **Step 6: コミット** — `git commit -m "feat(housing): buildTourMapPlacements(実エーテライト起点→家の経路を毎回・isTourPlaceable 追加)"`

---

### Task 8: `TourNavMap` ゴージャス経路書き換え ＋ `TourNavPage` 再配線

**Files:** Modify `TourNavMap.tsx`(全面) + `__tests__/TourNavMap.test.tsx` / `TourNavPage.tsx` + `__tests__/TourNavPage.test.tsx` / `src/locales/{ja,en,zh,ko}.json` / `src/styles/housing.css`

**Interfaces:** TourNavMap 新 props `{ status:'none'|'loading'|'ready'|'error'; svg; viewBox; roadPath; model: TourMapModel | null }`。TourNavPage は `resolveWardMapRef` + `useWardMapAsset` + `buildTourMapPlacements` で解決。

> **ゴージャス経路の視覚（ユーザー厳命「しっかりゴージャス・今の見えづらい線を廃止」）**。実装後、実機(1489×2.58)スクショでユーザー承認を得る。レイヤー構成（全て `--housing-*` token）:
> - **道の下地グロー**: 太い(≈12px相当)・低不透明・大 blur の honey パス（経路の下）。
> - **コア光線**: 明るい candle/白の細い上パス。
> - **流れる光**: `stroke-dasharray` を家方向へ流す animate（マーチングライト）。
> - **コメット**: 明るいオーブ＋残光が起点→家をループ走行（`animateMotion`）。
> - **起点エーテライト**: シャード座標に aether 青の脈動マーカー（`model.origin`）。
> - **目的地ビーコン**: 既存の波紋リング＋脈打ち矩形を維持・強調（`model.target`）。

- [ ] **Step 1: `TourNavMap.test.tsx` を新 props で書き換え（失敗させる）**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '../../../../i18n';
import type { WardMapJson } from '../../../../data/housing/wardMapManifest';
import mistWardRaw from '../../../../data/housing/mistWard.generated.json';
import type { TourMapModel } from '../../../../lib/housing/buildTourMapPlacements';
import { TourNavMap } from '../TourNavMap';
const mistWard = mistWardRaw as unknown as WardMapJson;
const model: TourMapModel = { target: { x: 100, y: 100 }, placed: [ { index: 0, x: 100, y: 100, status: 'current' }, { index: 1, x: 200, y: 150, status: 'upcoming' } ], routePath: 'M10 10 L100 100', origin: { x: 10, y: 10 } };

describe('TourNavMap', () => {
  it('ready で host/番号ノード/ゴージャス経路/起点マーカーを描く', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><rect/></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} roadPath={mistWard.roadPath} model={model} />);
    expect(container.querySelector('.housing-map-svg-host')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="tour-map-node"]').length).toBe(2);
    expect(container.querySelector('[data-testid="tour-map-route"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-origin"]')).toBeTruthy();
  });
  it('none はプレースホルダ・loading はスケルトン', () => {
    const none = render(<TourNavMap status="none" svg={null} viewBox={null} roadPath={null} model={null} />);
    expect(none.container.querySelector('[data-testid="tour-map-none"]')).toBeTruthy();
    const load = render(<TourNavMap status="loading" svg={null} viewBox={null} roadPath={null} model={null} />);
    expect(load.container.querySelector('[data-testid="tour-map-skeleton"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 失敗確認** — `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx` → FAIL
- [ ] **Step 3: `TourNavMap.tsx` 全面書き換え**（下記構造。経路はゴージャス多層。`--housing-*` token 経由。`housing-map-svg-host` 固定）

```tsx
import { useTranslation } from 'react-i18next';
import type { TourMapModel } from '../../../lib/housing/buildTourMapPlacements';

export interface TourNavMapProps {
  status: 'none' | 'loading' | 'ready' | 'error';
  svg: string | null;
  viewBox: { w: number; h: number } | null;
  roadPath: string | null;
  model: TourMapModel | null;
}
const LEGEND_ITEMS = ['here', 'next', 'arrived', 'upcoming', 'route'] as const;

/** ツアー中(Nav) 中央: 表示専用の LIVE 地図(全5エリア)。現在の家のワード地図を描き、実エーテライト起点→家の経路をゴージャスにアニメ。host は必ず .housing-map-svg-host。 */
export const TourNavMap: React.FC<TourNavMapProps> = ({ status, svg, viewBox, roadPath, model }) => {
  const { t } = useTranslation();
  const target = model?.target ?? null;
  const route = model?.routePath ?? null;
  const origin = model?.origin ?? null;
  return (
    <div className="housing-tour-map" data-region="tour-map">
      <div className="housing-tour-map-stage">
        <div className="housing-tour-map-wrap">
          {status === 'loading' && <div className="housing-tour-map-skeleton" data-testid="tour-map-skeleton" aria-hidden="true" />}
          {(status === 'none' || status === 'error') && (
            <div className="housing-tour-map-none" data-testid="tour-map-none">
              <p className="housing-tour-map-none-text">{t(status === 'error' ? 'housing.tour.nav.map_error' : 'housing.tour.nav.map_none')}</p>
            </div>
          )}
          {status === 'ready' && svg && viewBox && (
            <>
              <div className="housing-map-svg-host" role="img" aria-label={t('housing.workspace.center.map_alt')} dangerouslySetInnerHTML={{ __html: svg }} />
              <svg className="housing-map-overlay" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                {roadPath && (
                  <path d={roadPath} fill="none" stroke="var(--housing-candle)" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" strokeDasharray="14 28">
                    <animate attributeName="stroke-dashoffset" from="0" to="-42" dur="2.4s" repeatCount="indefinite" />
                  </path>
                )}
                {route && (
                  <>
                    {/* 下地グロー */}
                    <path className="housing-tour-route-glow" d={route} fill="none" />
                    {/* コア光線 + 流れ */}
                    <path data-testid="tour-map-route" className="housing-tour-route-core" d={route} fill="none">
                      <animate attributeName="stroke-dashoffset" from="0" to="-64" dur="1.1s" repeatCount="indefinite" />
                    </path>
                    {/* コメット */}
                    <circle className="housing-tour-route-comet" r="10">
                      <animateMotion dur="2.2s" repeatCount="indefinite" path={route} rotate="auto" />
                    </circle>
                  </>
                )}
                {origin && (
                  <g data-testid="tour-map-origin" className="housing-tour-map-origin-mark">
                    <circle className="housing-tour-map-origin-pulse" cx={origin.x} cy={origin.y} r="14">
                      <animate attributeName="r" from="14" to="30" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.9" to="0" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle className="housing-tour-map-origin-core" cx={origin.x} cy={origin.y} r="7" />
                  </g>
                )}
                {target && (
                  <g aria-hidden="true">
                    {[0, 0.9].map((begin) => (
                      <circle key={begin} cx={target.x} cy={target.y} r="60" fill="none" stroke="var(--housing-candle)" strokeWidth="6" style={{ filter: 'drop-shadow(0 0 10px var(--housing-honey))' }}>
                        <animate attributeName="r" from="60" to="170" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" from="0.95" to="0" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
                      </circle>
                    ))}
                    <rect x={target.x - 75} y={target.y - 55} width="150" height="110" rx="10" fill="var(--housing-honey)" fillOpacity="0.22" stroke="var(--housing-honey)" strokeWidth="6" style={{ filter: 'drop-shadow(0 0 16px var(--housing-honey))' }}>
                      <animate attributeName="stroke-opacity" values="1;0.45;1" dur="1.4s" repeatCount="indefinite" />
                    </rect>
                  </g>
                )}
              </svg>
              {model?.placed.map((node) => (
                <div key={node.index} data-testid="tour-map-node" data-status={node.status} className={`housing-tour-map-node housing-tour-map-node--${node.status}`} style={{ left: `${((node.x / viewBox.w) * 100).toFixed(3)}%`, top: `${((node.y / viewBox.h) * 100).toFixed(3)}%` }}>
                  {node.status === 'arrived' ? '✓' : node.index + 1}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="housing-hud is-top"><div className="pill housing-tour-map-live"><span className="housing-tour-map-live-dot" aria-hidden="true" />{t('housing.tour.nav.live')}</div></div>
      </div>
      <ul className="housing-tour-map-legend">
        {LEGEND_ITEMS.map((key) => (<li key={key} className="housing-tour-map-legend-item"><span className={`housing-tour-map-legend-swatch housing-tour-map-legend-swatch--${key}`} aria-hidden="true" />{t(`housing.tour.nav.legend.${key}`)}</li>))}
      </ul>
    </div>
  );
};
```

- [ ] **Step 4: ゴージャス経路の CSS を housing.css に追加**（token 経由・ハードコード禁止。既存 `--housing-honey/candle/aether` を使用。新規寸法 token が要れば housing.css 上部に定義）

```css
.housing-tour-route-glow { stroke: var(--housing-honey); stroke-width: 12; stroke-opacity: 0.28; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 0 14px var(--housing-honey)); }
.housing-tour-route-core { stroke: var(--housing-candle); stroke-width: 4.5; stroke-opacity: 0.95; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 18 20; filter: drop-shadow(0 0 6px var(--housing-honey)); }
.housing-tour-route-comet { fill: var(--housing-map-light); filter: drop-shadow(0 0 12px var(--housing-candle)); }
.housing-tour-map-origin-pulse { fill: none; stroke: var(--housing-aether); stroke-width: 4; }
.housing-tour-map-origin-core { fill: var(--housing-aether); filter: drop-shadow(0 0 10px var(--housing-aether)); }
.housing-tour-map-skeleton { position: absolute; inset: 0; border-radius: var(--housing-radius-lg, 16px); background: var(--housing-panel-bg); }
.housing-tour-map-none { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: var(--housing-gap-lg, 24px); text-align: center; }
.housing-tour-map-none-text { color: var(--housing-text-mute); }
```
> 実装時: `--housing-radius-lg`/`--housing-gap-lg`/`--housing-map-light` が housing.css に存在するか grep 確認。無ければ既存等価 token に置換（新規ハードコード値を作らない）。

- [ ] **Step 5: `TourNavPage.tsx` を差し替え**（`isMistPlaceable`/`plotToPlacement`/`WARD_CENTER_NODE`/`PlacedStep` の import 撤去、`placed`/`currentPlot`/`originNodeId` の3 useMemo を削除して下記へ）

```ts
import { resolveTourSteps, computeTourProgress } from '../../../lib/housing/tourNav';
import { resolveWardMapRef } from '../../../lib/housing/resolveWardMapRef';
import { useWardMapAsset } from '../../../lib/housing/useWardMapAsset';
import { buildTourMapPlacements } from '../../../lib/housing/buildTourMapPlacements';
import { TourNavMap } from '../tour/TourNavMap';
// ...
  const currentListing = progress.currentStep?.listing ?? null;
  const mapRef = useMemo(() => currentListing ? resolveWardMapRef(currentListing.area, currentListing.plot ?? null, currentListing.apartmentBuilding ?? null, currentListing.buildingType) : null, [currentListing]);
  const asset = useWardMapAsset(mapRef?.mapKey ?? null);
  const mapModel = useMemo(() => (asset.status === 'ready' && mapRef) ? buildTourMapPlacements(asset.json, mapRef.mapKey, mapRef, currentListing, steps, currentIndex) : null, [asset, mapRef, currentListing, steps, currentIndex]);
  const mapStatus: 'none' | 'loading' | 'ready' | 'error' = !mapRef ? 'none' : asset.status === 'ready' ? 'ready' : asset.status === 'error' ? 'error' : 'loading';
```
中央カラムの `<TourNavMap .../>`:
```tsx
          <TourNavMap status={mapStatus} svg={asset.status === 'ready' ? asset.svg : null} viewBox={asset.status === 'ready' ? asset.json.viewBox : null} roadPath={asset.status === 'ready' ? asset.json.roadPath : null} model={mapModel} />
```

- [ ] **Step 6: i18n `map_none`/`map_error` を4言語追加**（`housing.tour.nav` 配下、`live` の近く）
- ja: `"map_none": "この目的地は地図データがありません"`, `"map_error": "地図の読み込みに失敗しました"`
- en: `"map_none": "No map data for this destination"`, `"map_error": "Failed to load the map"`
- zh: `"map_none": "该目的地暂无地图数据"`, `"map_error": "地图加载失败"`
- ko: `"map_none": "이 목적지의 지도 데이터가 없습니다"`, `"map_error": "지도를 불러오지 못했습니다"`

- [ ] **Step 7: `TourNavPage.test.tsx` を更新**（旧 `placed`/`isMistPlaceable` 前提の assertion があれば `waitFor` で ready を待つ / 「地図領域が出る」レベルに緩和。左右パネル/完了/空状態の検証は維持）→ PASS
- [ ] **Step 8: ビルド + TourNavMap テスト** — `npm run build`(EXIT0) / `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx`(PASS)
- [ ] **Step 9: 実機スクショ（ユーザー承認ゲート）** — 1489×2.58・store 注入で全5エリア×本街/拡張の経路ゴージャスさを目視。ユーザー承認後に次へ。
- [ ] **Step 10: コミット** — `git commit -m "feat(housing): 中央地図を全5エリア対応+実エーテライト起点のゴージャス経路アニメ(Mistハードコード撤去)"`

---

### Task 9: `map_pending` を全エリア対応へ ＋ `isMistPlaceable` 撤去

**Files:** `TourRouteSteps.tsx:2,27` / `tourNav.ts` / `__tests__/tourNav.test.ts` / `__tests__/TourNextDestinationPanel.test.tsx:198-215` / `src/locales/{ja,en,zh,ko}.json`

- [ ] **Step 1: `TourRouteSteps.tsx`** — import を `isTourPlaceable` に、`:27` を `const mapPending = !missing && !isTourPlaceable(step.listing);`
- [ ] **Step 2: `map_pending` 文言を4言語更新**（「全エリアは近日」は嘘になる）
- ja(`:2776`): `"map_pending": "地図データなし（区画情報なし）"` / en(`:2755`): `"No map (plot info missing)"` / zh(`:2720`): `"无地图（缺少地块信息）"` / ko(`:2720`): `"지도 없음 (구획 정보 없음)"`
- [ ] **Step 3: `TourNextDestinationPanel.test.tsx:198-215`** — 「非ミスト→map_pending」を「plot無しhouse→map_pending / plotあり(全エリア)→出ない」に書き換え（i18n 実表示文字列で assert）。
- [ ] **Step 4: `isMistPlaceable` 削除** — tourNav.ts から関数削除、tourNav.test.ts の該当 describe 削除。
- [ ] **Step 5: 確認** — `npx vitest run src/lib/housing/__tests__/tourNav.test.ts src/components/housing/tour/__tests__/TourNextDestinationPanel.test.tsx src/components/housing/tour/__tests__/i18nParity.test.ts`(PASS) / `npm run build`(EXIT0)
- [ ] **Step 6: コミット** — `git commit -m "feat(housing): map_pending を地図解決不可判定へ・isMistPlaceable 撤去・文言4言語更新"`

---

### Task 10: 対応表レポート ＋ 最終ゲート ＋ TODO 更新

**Files:** `docs/TODO.md`（＋ レポートは実行ログとして提示）

- [ ] **Step 1: 全300区画の対応表を出力**（ユーザー検算用・FF14 の正はユーザー）。`scripts/parse-ward-aetherytes.mjs` に `--report` で `area/plot → 最寄りエーテライト → node` を列挙する出力を足す（または別 diag スクリプト）。ユーザーに提示し、明らかな取り違え（例: 南の家が北のシャード起点）がないか目視確認を依頼。
- [ ] **Step 2: 全ビルド** — `npm run build` → EXIT 0
- [ ] **Step 3: 全テスト** — `npx vitest run` → 既知 legacy fail（`TopBar` 4件 + `HousingWorkspace` 1件）のみ・新規 fail ゼロ・i18n parity 緑。
- [ ] **Step 4: `docs/TODO.md` 更新** — P2＋P4(経路)完了を記録・次=節目の移動ナビ(P3: 区/エリア/ワールド/DC の transitionBetween 画面)。100 行以内維持。実機ゲート前なら merge 保留を明記。
- [ ] **Step 5: コミット** — `git commit -m "docs(todo): 本物のナビ化 P2+P4(並べ替え/全エリア地図/実エーテライト起点ゴージャス経路)完了を記録"`

---

## 実機検証（各タスク後 & 完了時・Playwright 1489×2.58・store 注入）

共有 DOM/座標基準を変える改修のため実行時挙動の総点検が必須（memory `feedback_structural_refactor_runtime_audit`）:
1. **並べ替え**: 複数エリア/ワールド混在トレイで開始 → 右「ルートのステップ」が region→DC→server→area→ward→plot・同住所隣接。
2. **全エリア地図**: Mist/Lavender/Goblet/Shirogane/Empyreum の本街・拡張街それぞれで正しいワード地図＋家ハイライト。
3. **赤丸ノード隠蔽**: 全エリアで赤線/赤丸が `.housing-map-svg-host` の CSS で消えている（回帰確認）。
4. **実エーテライト起点のゴージャス経路**: どの家でも、右パネルの最寄りエーテライト名と一致する位置（起点マーカー）から家まで、太く光る流れる経路＋コメットが出る。「今の見えづらい線」ではないこと。
5. **本街/拡張の起点が正しい**: 拡張街の家が拡張のシャードから、本街の家が本街のシャードから始まる（対応表と一致）。
6. **前後移動 / ロード**: 「前へ/次へ」で地図と経路が家ごとに切替、loading→ready のスケルトン遷移。
7. **地図なし / 英語**: plot 無し等で `map_none`＋`map_pending` が静かに出る。英語表示で崩れない。

## Self-Review（spec 突合）

- orderTourStops（region→DC→server→area→ward→plot・同住所隣接）→ Task 1/2 ✅（region 先頭=ユーザー承認）
- TourNavMap を resolveWardMapRef + WARD_MAP_LOADERS 駆動（Mist 撤去）→ Task 5/6/8 ✅
- 現在の家のワード地図＋ハイライト → Task 7/8 ✅
- **実エーテライト起点（SVGエーテライト名パース）→ 家の経路**（spec P4）→ Task 3/4/7/8 ✅（全300区画・本街/拡張クロス0をテスト保証）
- **ゴージャス化**（道主役・灯り）→ Task 8（ユーザー承認ゲート）✅
- map_pending 撤廃（plot なしのみ注記）→ Task 9 ✅
- 純関数 vitest（実データ裏取り）→ Task 1/3/4/5/6/7 ✅
- build EXIT0 + vitest 緑を各タスクゲート → 各タスク + Task 10 ✅
- **スコープ外（P3 節目の移動ナビ transitionBetween / Polish b-e）** → 本プラン外（次フェーズ）✅

**型整合**: `plotToPlacementIn`/`nodeToPointIn`/`buildRoutePathIn`(Task5) → `buildTourMapPlacements`(Task7)。`getPlotOriginNode`(Task4) → buildTourMapPlacements の起点。`getMapAetherytes`(Task3) → plotOrigin。`TourMapModel`(Task7) → TourNavMap props(Task8)。`WardMapAssetState`(Task6) → TourNavPage の ready narrowing。`isTourPlaceable`(Task7 追加 → Task9 で唯一の判定)。✅
