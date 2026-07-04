# 中央地図 Phase 1(地図描画の純化)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツアー中地図の経路を「エーテライトの目の前の道から出て、家の手前で止まる」自然なナビにし、家の波紋を撤去し、地図の黒枠を世界観の色に変える(spec 改善 1・2・3・8)。

**Architecture:** 幾何は純関数(`mapGeometry.ts`)に集約して TDD。改善2 のため箱の輪郭頂点を生成時に json へ焼く。`buildTourMapPlacements` が「投影起点 + 箱縁終点」で経路を組む。波紋撤去は TourNavMap、枠線色は housing.css トークン + CSS 上書き。

**Tech Stack:** TypeScript / React / Vitest(happy-dom)/ Node 生成スクリプト / housing.css design tokens。

## Global Constraints

- ハウジング独自トンマナ(`.claude/rules/housing-design.md`)。色・寸法・影は **housing.css トークン経由**・ハードコード禁止。
- `npm run build`(tsc -b 厳密・Vercel と同条件)EXIT0。既知 legacy 5 fail(TopBar4 + HousingWorkspace1)以外の**新規 fail ゼロ**。
- 座標系は **0..1 正規化 × viewBox**(既存の全データ・純関数がこの規約)。
- 見た目変更(波紋撤去・枠線色・経路の見え方)は開発者実画面 **CSS1489 / DPR2.58** ゲートをユーザーが通すまで完了宣言しない。
- ブランチ `feat/housing-tour-nav-m1` @ `408770d1` の上に積む。legacy(MapView 等)は非破壊。

---

### Task 1: 幾何純関数 — 点 → 道(polyline)の最近点

改善1「エーテライトの目の前の道から経路を始める」の基盤。エーテライト座標から、全 edge の polyline セグメントへの最近点(垂線の足・端点クランプ)を求める。

**Files:**
- Create: `src/lib/housing/mapGeometry.ts`
- Test: `src/lib/housing/__tests__/mapGeometry.test.ts`

**Interfaces:**
- Produces:
  - `interface PolylineEdge { a: string; b: string; polyline: [number, number][] }`
  - `interface NearestPoint { x: number; y: number; edgeIndex: number; segIndex: number; t: number; dist: number }`
  - `function nearestPointOnPolylines(px: number, py: number, edges: PolylineEdge[]): NearestPoint | null`
  - 引数 `px,py` と `polyline` は **同一単位(px)**。呼び出し側で `× viewBox` して渡す。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/mapGeometry.test.ts
import { describe, it, expect } from 'vitest';
import { nearestPointOnPolylines } from '../mapGeometry';

describe('nearestPointOnPolylines', () => {
  const edges = [{ a: 'n1', b: 'n2', polyline: [[0, 0], [10, 0]] as [number, number][] }];

  it('水平線分の真上の点は垂線の足へ落ちる', () => {
    const r = nearestPointOnPolylines(5, 4, edges)!;
    expect(r.x).toBeCloseTo(5, 5);
    expect(r.y).toBeCloseTo(0, 5);
    expect(r.dist).toBeCloseTo(4, 5);
  });

  it('線分の外側の点は端点にクランプされる', () => {
    const r = nearestPointOnPolylines(-3, 0, edges)!;
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.t).toBeCloseTo(0, 5);
  });

  it('複数 edge から最も近いセグメントを選ぶ', () => {
    const two = [
      { a: 'n1', b: 'n2', polyline: [[0, 0], [10, 0]] as [number, number][] },
      { a: 'n3', b: 'n4', polyline: [[0, 100], [10, 100]] as [number, number][] },
    ];
    const r = nearestPointOnPolylines(5, 90, two)!;
    expect(r.edgeIndex).toBe(1);
    expect(r.y).toBeCloseTo(100, 5);
  });

  it('edge が無ければ null', () => {
    expect(nearestPointOnPolylines(0, 0, [])).toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/housing/__tests__/mapGeometry.test.ts`
Expected: FAIL(`nearestPointOnPolylines` is not a function / module not found)

- [ ] **Step 3: 最小実装**

```ts
// src/lib/housing/mapGeometry.ts
export interface PolylineEdge { a: string; b: string; polyline: [number, number][] }
export interface NearestPoint { x: number; y: number; edgeIndex: number; segIndex: number; t: number; dist: number }

/** 点(px)から edges の全セグメントへの最近点。polyline は px 単位(0..1 × viewBox 済み)。edges 空なら null。 */
export function nearestPointOnPolylines(px: number, py: number, edges: PolylineEdge[]): NearestPoint | null {
  let best: NearestPoint | null = null;
  for (let ei = 0; ei < edges.length; ei++) {
    const pl = edges[ei].polyline;
    for (let si = 0; si + 1 < pl.length; si++) {
      const [x1, y1] = pl[si];
      const [x2, y2] = pl[si + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = x1 + t * dx, cy = y1 + t * dy;
      const d = Math.hypot(px - cx, py - cy);
      if (!best || d < best.dist) best = { x: cx, y: cy, edgeIndex: ei, segIndex: si, t, dist: d };
    }
  }
  return best;
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `npx vitest run src/lib/housing/__tests__/mapGeometry.test.ts`
Expected: PASS(4 tests)

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/mapGeometry.ts src/lib/housing/__tests__/mapGeometry.test.ts
rtk git commit -m "feat(housing): mapGeometry 点->道の最近点(改善1基盤)"
```

---

### Task 2: 幾何純関数 — 線分 × 箱輪郭 の交点

改善2「家の手前で止める」の基盤。経路の最後のセグメント(家に近づく向き)が箱の輪郭多角形に入る点を返す。

**Files:**
- Modify: `src/lib/housing/mapGeometry.ts`(追記)
- Test: `src/lib/housing/__tests__/mapGeometry.test.ts`(追記)

**Interfaces:**
- Produces:
  - `function segmentPolygonIntersection(ax: number, ay: number, bx: number, by: number, poly: [number, number][]): { x: number; y: number } | null`
  - 線分 `a->b` と閉多角形 `poly` の、**a に最も近い側**の交点。交差なしは null。`poly` は px 単位・頂点列(閉じは内部で先頭に戻す)。

- [ ] **Step 1: 失敗するテストを書く(追記)**

```ts
// __tests__/mapGeometry.test.ts に追記
import { segmentPolygonIntersection } from '../mapGeometry';

describe('segmentPolygonIntersection', () => {
  const box: [number, number][] = [[40, 40], [60, 40], [60, 60], [40, 60]]; // 中心(50,50)

  it('外(左)から中心へ向かう線分は左辺 x=40 で交わる', () => {
    const r = segmentPolygonIntersection(0, 50, 50, 50, box)!;
    expect(r.x).toBeCloseTo(40, 5);
    expect(r.y).toBeCloseTo(50, 5);
  });

  it('a に近い側の交点を返す(貫通しても入口で止める)', () => {
    const r = segmentPolygonIntersection(0, 50, 100, 50, box)!;
    expect(r.x).toBeCloseTo(40, 5); // 入口(左辺)。出口 x=60 ではない
  });

  it('多角形に触れない線分は null', () => {
    expect(segmentPolygonIntersection(0, 0, 10, 0, box)).toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/housing/__tests__/mapGeometry.test.ts`
Expected: FAIL(`segmentPolygonIntersection` is not a function)

- [ ] **Step 3: 最小実装(mapGeometry.ts に追記)**

```ts
/** 線分 a->b と閉多角形 poly の、a に最も近い側の交点。交差なしは null。poly は px 頂点列。 */
export function segmentPolygonIntersection(
  ax: number, ay: number, bx: number, by: number, poly: [number, number][],
): { x: number; y: number } | null {
  let bestT = Infinity;
  let res: { x: number; y: number } | null = null;
  const rx = bx - ax, ry = by - ay;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const sx = x2 - x1, sy = y2 - y1;
    const denom = rx * sy - ry * sx;
    if (denom === 0) continue; // 平行
    const t = ((x1 - ax) * sy - (y1 - ay) * sx) / denom; // a->b 上のパラメータ
    const u = ((x1 - ax) * ry - (y1 - ay) * rx) / denom; // 辺上のパラメータ
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < bestT) {
      bestT = t;
      res = { x: ax + t * rx, y: ay + t * ry };
    }
  }
  return res;
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `npx vitest run src/lib/housing/__tests__/mapGeometry.test.ts`
Expected: PASS(全 7 tests)

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/mapGeometry.ts src/lib/housing/__tests__/mapGeometry.test.ts
rtk git commit -m "feat(housing): mapGeometry 線分x箱輪郭の交点(改善2基盤)"
```

---

### Task 3: 箱の輪郭頂点を json に焼き込む

改善2 で箱縁を求めるため、各 house に輪郭頂点 `outline`(0..1 正規化)を持たせる。生成スクリプトを拡張し全 10 マップ再生成。

**Files:**
- Modify: `scripts/svg-path-center.mjs`(輪郭取得ヘルパ追加)
- Modify: `scripts/parse-ward-svg.mjs`(`houses[].outline` 追加)
- Modify: `src/data/housing/wardMapManifest.ts`(型に `outline` 追加)
- Regenerate: `src/data/housing/*.generated.json`(全 10 マップ)
- Test: `src/lib/housing/__tests__/wardHouseCoords.test.ts`(既存に outline 検証を追記)

**Interfaces:**
- Consumes: `pathPoints(d)` / `applyTransform(cx,cy,open)` / `attrNum`(既存 `svg-path-center.mjs`)
- Produces:
  - `export function elementOutlinePx(open: string, tag: string): [number, number][] | null`(svg-path-center.mjs)
  - `WardMapJson.houses[].outline: number[][] | null`(wardMapManifest.ts)

- [ ] **Step 1: 失敗するテストを書く(追記)**

```ts
// src/lib/housing/__tests__/wardHouseCoords.test.ts に追記
import mist from '../../../data/housing/mistWard.generated.json';

it('各 house に outline(3 点以上・0..1 範囲)が付き、重心が中心と概ね一致', () => {
  for (const h of (mist as any).houses) {
    expect(Array.isArray(h.outline)).toBe(true);
    expect(h.outline.length).toBeGreaterThanOrEqual(3);
    for (const [x, y] of h.outline) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(1);
    }
    const cx = h.outline.reduce((s: number, p: number[]) => s + p[0], 0) / h.outline.length;
    const cy = h.outline.reduce((s: number, p: number[]) => s + p[1], 0) / h.outline.length;
    expect(Math.hypot(cx - h.x, cy - h.y)).toBeLessThan(0.05); // 重心≒登録中心
  }
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/housing/__tests__/wardHouseCoords.test.ts`
Expected: FAIL(`h.outline` is undefined / not an array)

- [ ] **Step 3: svg-path-center.mjs に輪郭ヘルパを追加(末尾に)**

```js
/** 要素の輪郭頂点(px)。rect=4隅 / path=on-curve 点 / circle=bbox 4隅。rotate transform 適用。 */
export function elementOutlinePx(open, tag) {
  let pts = [];
  if (tag === 'rect') {
    const x = attrNum(open, 'x') ?? 0, y = attrNum(open, 'y') ?? 0;
    const w = attrNum(open, 'width') ?? 0, h = attrNum(open, 'height') ?? 0;
    pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  } else if (tag === 'circle' || tag === 'ellipse') {
    const cx = attrNum(open, 'cx') ?? 0, cy = attrNum(open, 'cy') ?? 0;
    const rx = attrNum(open, 'rx') ?? attrNum(open, 'r') ?? 0;
    const ry = attrNum(open, 'ry') ?? attrNum(open, 'r') ?? 0;
    pts = [[cx - rx, cy - ry], [cx + rx, cy - ry], [cx + rx, cy + ry], [cx - rx, cy + ry]];
  } else {
    const dm = open.match(/\sd="([^"]+)"/);
    if (!dm) return null;
    pts = pathPoints(dm[1]);
  }
  if (pts.length < 3) return null;
  return pts.map(([x, y]) => { const p = applyTransform(x, y, open); return [p.x, p.y]; });
}
```

- [ ] **Step 4: parse-ward-svg.mjs で houses に outline を付与**

import 行に追加 → houses ループ(現 31-34 行)→ 出力 map(現 137 行)を差し替え:

```js
import { elementCenterPx, elementOutlinePx } from './svg-path-center.mjs';

// houses ループ
for (const m of svg.matchAll(/<(path|rect|circle|ellipse) id="(plot|apart)_(\d+)"([^>]*)>/g)) {
  const c = elementCenter(m[1], m[4]);
  const outlinePx = elementOutlinePx(m[4], m[1]);
  const outline = outlinePx ? outlinePx.map(([x, y]) => [nx(x), ny(y)]) : null;
  houses.push({ kind: m[2], plot: Number(m[3]), x: nx(c.x), y: ny(c.y), outline, _px: c });
}

// 出力 map(houses)
houses: houses.map(({ kind, plot, x, y, node, outline }) => ({ kind, plot, x, y, node, outline })),
```

- [ ] **Step 5: 型に outline を追加(wardMapManifest.ts:6)**

```ts
houses: Array<{ kind: 'plot' | 'apart'; plot: number; x: number; y: number; node: string | null; outline: number[][] | null }>;
```

- [ ] **Step 6: 全 10 マップ再生成**

元 SVG は `docs/housing-maps-src/`。実ファイル名を確認し、既存の生成手順(package.json scripts か直接 node)で **10 マップ全て**再生成する。例:

```bash
node scripts/parse-ward-svg.mjs docs/housing-maps-src/<mist の実ファイル> Mist src/data/housing/mistWard.generated.json
# mist-sub / goblet / goblet-sub / lavender(±sub) / shirogane(±sub) / empyreum(±sub) も同様
```

- [ ] **Step 7: テスト成功 + 座標回帰なしを確認**

Run: `npx vitest run src/lib/housing/__tests__/wardHouseCoords.test.ts`
Expected: PASS。加えて `rtk git diff src/data/housing/*.generated.json` で **既存 `x/y/node` が不変・追加は `outline` のみ**を確認。

- [ ] **Step 8: コミット**

```bash
rtk git add scripts/svg-path-center.mjs scripts/parse-ward-svg.mjs src/data/housing/wardMapManifest.ts src/data/housing/*.generated.json src/lib/housing/__tests__/wardHouseCoords.test.ts
rtk git commit -m "feat(housing): 家の輪郭頂点を json に焼く(改善2用・全10マップ再生成)"
```

---

### Task 4: buildTourMapPlacements を「投影起点 + 箱縁終点」に配線

改善1 + 改善2 を実データ経路に適用。エーテライト実座標 → 最寄りの道の投影点 → 道なり → **箱の縁で停止**。

**Files:**
- Modify: `src/lib/housing/buildTourMapPlacements.ts`
- Modify: `src/lib/housing/wardRoute.ts`(`Placement` に `outline` 追加)
- Test: `src/lib/housing/__tests__/buildTourMapPlacements.test.ts`(既存に追記。無ければ作成)

**Interfaces:**
- Consumes: `nearestPointOnPolylines` / `segmentPolygonIntersection`(Task 1/2)、`buildRoutePathIn` / `nodeToPointIn`(既存 wardRoute.ts)、`json.houses[].outline`(Task 3)
- 既存 `TourMapModel`(`routePath` / `origin`)の形は不変(消費側 TourNavMap 無改変)。

**現状(408770d1)** — `buildTourMapPlacements.ts:55-66`(`buildRoutePathIn(originInfo.node, targetPlacement.nodeId)` → `L 箱中心`)。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// buildTourMapPlacements.test.ts(mist 実データ。既存フィクスチャ生成を流用)
import mist from '../../../data/housing/mistWard.generated.json';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { buildTourMapPlacements } from '../buildTourMapPlacements';

it('経路の終点は箱の中心ちょうどではない(手前で止まる)', () => {
  const model = buildTourMapPlacements(mist as unknown as WardMapJson, 'mist', ref, listing, steps, idx);
  const coords = [...model.routePath!.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)];
  const last = coords.at(-1)!;
  const [lx, ly] = [Number(last[1]), Number(last[2])];
  const house = (mist as any).houses.find((h: any) => h.plot === listing.plot && h.kind === 'plot');
  const cx = house.x * mist.viewBox.w, cy = house.y * mist.viewBox.h;
  expect(Math.hypot(lx - cx, ly - cy)).toBeGreaterThan(1);
});

it('経路の始点(M)はエーテライト実座標', () => {
  const model = buildTourMapPlacements(mist as unknown as WardMapJson, 'mist', ref, listing, steps, idx);
  const m = model.routePath!.match(/^M(-?[\d.]+) (-?[\d.]+)/)!;
  expect(Number(m[1])).toBeCloseTo(model.origin!.x, 0);
  expect(Number(m[2])).toBeCloseTo(model.origin!.y, 0);
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts`
Expected: FAIL(現状終点=箱中心で距離 0)

- [ ] **Step 3: Placement に outline を足す(wardRoute.ts)**

`Placement` interface に `outline: number[][] | null` を追加。`plotToPlacementIn` / `apartToPlacementIn` の return に `outline: h.outline ?? null` を含める(house から pass-through)。

- [ ] **Step 4: buildTourMapPlacements.ts:55-66 を差し替え**

```ts
import { nearestPointOnPolylines, segmentPolygonIntersection } from './mapGeometry';
import { nodeToPointIn } from './wardRoute'; // 既存 export

// … target / placed は現状のまま …
let routePath: string | null = null;
let origin: { x: number; y: number } | null = null;
const originInfo = currentListing
  ? (currentListing.buildingType === 'apartment'
      ? getApartmentOrigin(json, mapKey)
      : getPlotOriginNode(currentListing.area, currentListing.plot))
  : null;

if (originInfo && targetPlacement && targetPlacement.nodeId) {
  const w = json.viewBox.w, h = json.viewBox.h;
  const oxPx = originInfo.x * w, oyPx = originInfo.y * h;
  origin = { x: oxPx, y: oyPx };

  const base = buildRoutePathIn(json, originInfo.node, targetPlacement.nodeId);
  if (base) {
    // 改善1: エーテライト実座標 → 最寄りの道の投影点 を頭に足す。
    const edgesPx = json.edges.map((e) => ({
      a: e.a, b: e.b,
      polyline: e.polyline.map(([x, y]) => [x * w, y * h] as [number, number]),
    }));
    const proj = nearestPointOnPolylines(oxPx, oyPx, edgesPx);
    const lead = proj ? `M${oxPx.toFixed(1)} ${oyPx.toFixed(1)} L${proj.x.toFixed(1)} ${proj.y.toFixed(1)} ` : '';
    const body = proj ? base.replace(/^M/, 'L') : base;

    // 改善2: 箱の中心ではなく輪郭に触れた点で止める。
    let doorX = targetPlacement.x, doorY = targetPlacement.y;
    const lastNode = nodeToPointIn(json, targetPlacement.nodeId);
    const outlinePx = (targetPlacement.outline ?? []).map(([x, y]) => [x * w, y * h] as [number, number]);
    if (lastNode && outlinePx.length >= 3) {
      const hit = segmentPolygonIntersection(lastNode.x * w, lastNode.y * h, targetPlacement.x, targetPlacement.y, outlinePx);
      if (hit) { doorX = hit.x; doorY = hit.y; }
    }
    routePath = `${lead}${body} L${doorX.toFixed(1)} ${doorY.toFixed(1)}`;
  }
}
```

- [ ] **Step 5: テスト + build**

Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts && npm run build`
Expected: PASS + EXIT0

- [ ] **Step 6: コミット**

```bash
rtk git add src/lib/housing/buildTourMapPlacements.ts src/lib/housing/wardRoute.ts src/lib/housing/__tests__/buildTourMapPlacements.test.ts
rtk git commit -m "feat(housing): 経路を投影起点+箱縁終点に(改善1+2)"
```

---

### Task 5: TourNavMap 波紋撤去(改善3)

目的地の放射リング波紋を削除。エーテライトの脈動・箱ハイライトは維持。

**Files:**
- Modify: `src/components/housing/tour/TourNavMap.tsx`
- Test: `src/components/housing/tour/__tests__/TourNavMap.test.tsx`

**現状**: `TourNavMap.tsx:72-82` の `{/* 目的地の放射リング … */}{target && (<g aria-hidden>…circle×2…</g>)}` ブロック。

- [ ] **Step 1: 失敗するテストを書く**

```tsx
it('目的地の放射リング(r アニメ circle)は描画されない', () => {
  const { container } = render(<TourNavMap status="ready" svg={SVG} viewBox={VB} model={MODEL_WITH_TARGET} />);
  const animatedRings = container.querySelectorAll('circle > animate[attributeName="r"]');
  // origin pulse も r アニメを持つため、放射リング固有の begin="0.9s" を数える
  const rings = [...container.querySelectorAll('animate[attributeName="r"]')].filter(a => a.getAttribute('begin') === '0.9s');
  expect(rings.length).toBe(0);
});

it('エーテライト脈動(origin)は残る', () => {
  const { container } = render(<TourNavMap status="ready" svg={SVG} viewBox={VB} model={MODEL_WITH_TARGET} />);
  expect(container.querySelector('[data-testid="tour-map-origin"]')).not.toBeNull();
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx`
Expected: FAIL(1 件目 = 現状 begin="0.9s" の波紋 circle が存在)

- [ ] **Step 3: 波紋ブロックを削除**

`TourNavMap.tsx:72-82` の `{/* 目的地の放射リング … */}` コメントから `{target && ( … )}` 閉じまでを削除。`target` 変数が未使用になれば併せて削除(lint 追従)。箱ハイライト useEffect(25-32)と origin(63-71)は不変。

- [ ] **Step 4: テスト成功 + build**

Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx && npm run build`
Expected: PASS + EXIT0

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/tour/TourNavMap.tsx src/components/housing/tour/__tests__/TourNavMap.test.tsx
rtk git commit -m "feat(housing): 家の波紋を撤去・脈動と箱ハイライトは維持(改善3)"
```

---

### Task 6: 地図の枠線色をトークン化(改善8)

道・区画の純黒 stroke を CSS で世界観の色へ上書き。SVG は書き換えず `.housing-map-svg-host` 配下にセレクタ限定。**色の最終決定は実画面ゲート**。

**Files:**
- Modify: `src/styles/housing.css`

- [ ] **Step 1: トークンとセレクタを追加**

housing tour トークン集約ブロック(`--housing-tour-*` 付近)にトークン定義:

```css
--housing-map-stroke: rgba(255, 226, 179, 0.30);       /* 初期案A: キャンドル系の淡線 */
--housing-map-stroke-road: rgba(255, 226, 179, 0.42);  /* 道は少し強く */
```

`.housing-map-svg-host` 配下の道・区画へ上書き(装飾ポリゴンに波及しないよう限定):

```css
.housing-map-svg-host path[id^="plot_"],
.housing-map-svg-host path[id^="apart_"] { stroke: var(--housing-map-stroke); }
.housing-map-svg-host > svg > g:first-of-type path[mask] { stroke: var(--housing-map-stroke-road); }
```

> 実装者は mist.generated.svg 冒頭の `<g id="…(Stroke)">`(道本体は `mask="url(...)"` 付き path)を見て、道本体に当たりエーテライト装飾(`#F0FEFF` / `#00BFFF`)に当たらないセレクタを確定する。presentation attribute の `stroke="black"` は CSS が勝つ(!important 不要)。

- [ ] **Step 2: 実画面ゲート(ユーザー)**

`npm run dev` → `/housing/tour` を CSS1489 / DPR2.58 で目視。**A案(キャンドル淡線)/ B案(白半透明 `rgba(255,255,255,0.28)`)を切り替えて 2〜3 色比較**、昼/夜背景の両方で沈まない色に確定。確定値をトークンへ。

- [ ] **Step 3: コミット**

```bash
rtk git add src/styles/housing.css
rtk git commit -m "feat(housing): 地図の枠線色を世界観トークンへ(改善8・実画面確定)"
```

---

## Self-Review(この plan)

- **spec coverage**: 改善1=Task1+4 / 改善2=Task2+3+4 / 改善3=Task5 / 改善8=Task6。Phase 1 の 4 改善すべてタスクあり。
- **placeholder scan**: Task3 Step6(元 SVG 実ファイル名)・Task6(色)は環境依存/実画面確定の**意図的な確認指示**で spec と一致。純粋な穴埋め placeholder は無し。
- **type consistency**: `nearestPointOnPolylines` / `segmentPolygonIntersection` / `elementOutlinePx` / `Placement.outline` / `houses[].outline` は Task 間で名称・型一致。`PolylineEdge` は Task4 で `json.edges` を map して渡す。
- **依存順**: Task1→2(同ファイル)→3(データ)→4(1・2・3 を使用)→5・6(独立)。4 は 3 の outline に依存 = 順序で担保。

## 次フェーズ予告

Phase 1 実機ゲート OK → Phase 2(改善 4・6 撤去 + 改善 5・7 パン&ズーム/デフォルト表示)。以降 Phase 3(レイアウト)→ 4(進行モデル)→ 5(生きたカード)。
