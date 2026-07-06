# 行き方テキストに沿ったナビ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツアー地図の経路を「行き方テキストの方角語」に沿わせる。出だしが方角と逆向きの区画だけ「方角へ道→曲がり角→入口へ破線ジャンプ」にリルートし、良い区画は不変に保つ。

**Architecture:** 純関数を 3 つ新設（方角パース `plotBearing` / 方角ナビ `verbalRoute` / 手動上書き `wardRouteOverrides`）し、既存 `buildTourMapPlacements` の経路生成部だけを差し替える。描画は実線(道)＋破線(ジャンプ)の 2 パスに拡張。既存の `wardRoute.ts`（`buildSnappedRoutePoints`）は不変で再利用。

**Tech Stack:** TypeScript / React / vitest（pool=vmThreads）/ SVG。座標は viewBox px（0..1 × viewBox）。

## Global Constraints

- **角度・方角計算はすべて px 空間**（正規化 0..1 では `w≠h` で角度が歪む）。方角ベクトル: 北=(0,−1) 南=(0,+1) 東=(+1,0) 西=(−1,0) 斜=±√½。
- **ハウジング配下は独自トンマナ**（白黒のみ/Inter禁止/honey禁止ルールは非適用）。色・寸法・影は `src/styles/housing.css` の `--housing-*` トークン経由（ハードコード禁止）。
- **リルートは保守的**: 「出だしが方角の反対半平面(dot<0)」の区画のみ。良い ~270 区画は agree で既存挙動を一切変えない。
- push 前に `npm run build`（tsc -b strict）EXIT0 + `npx vitest run` 新規 fail 0（既知 legacy 5 のみ）必須。**勝手に push/merge しない**。
- テストは vitest（`pool='vmThreads'` 既定）。純関数テストは default env、コンポーネントは `// @vitest-environment happy-dom`。

## File Structure

- Create `src/lib/housing/plotBearing.ts` — 方角語パース + 方角ベクトル決定（純関数）
- Create `src/lib/housing/__tests__/plotBearing.test.ts`
- Create `src/lib/housing/verbalRoute.ts` — agree/reroute 判定・方角グリーディ歩き・曲がり角・合成（純関数）
- Create `src/lib/housing/__tests__/verbalRoute.test.ts`
- Create `src/data/housing/wardRouteOverrides.generated.json` — 手動上書き（初期値 `{}`）
- Create `src/lib/housing/wardRouteOverrides.ts` — 上書きルックアップ（純関数）
- Create `src/lib/housing/__tests__/wardRouteOverrides.test.ts`
- Modify `src/lib/housing/buildTourMapPlacements.ts` — 経路生成部の配線 + `TourMapModel.routeJumpPath`
- Modify `src/lib/housing/__tests__/buildTourMapPlacements.test.ts` — 終点検証を reroute 対応化
- Modify `src/components/housing/tour/TourNavMap.tsx` — 破線ジャンプ描画
- Modify `src/components/housing/tour/__tests__/TourNavMap.test.tsx` — model リテラルに `routeJumpPath` 追加 + 破線描画テスト
- Modify `src/styles/housing.css` — `.housing-tour-route-jump`

---

### Task 1: plotBearing（方角パース + 方角ベクトル）

**Files:**
- Create: `src/lib/housing/plotBearing.ts`
- Test: `src/lib/housing/__tests__/plotBearing.test.ts`

**Interfaces:**
- Consumes: `getPlotDirections(area, plot)` from `./wardDirections`（既存: `{ aetheryte, directions } | null` を返す）
- Produces: `type Vec = { x: number; y: number }`; `parseCompassBearing(text: string | null | undefined): Vec | null`; `getPlotBearing(area: string, plot: number | null | undefined, originPx: Vec, doorPx: Vec): Vec`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/plotBearing.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../wardDirections', () => ({ getPlotDirections: vi.fn() }));
import { getPlotDirections } from '../wardDirections';
import { parseCompassBearing, getPlotBearing } from '../plotBearing';

describe('parseCompassBearing', () => {
  it('西 → (-1,0)', () => { expect(parseCompassBearing('西の階段を降りて一つ目の踊り場からジャンプ')).toEqual({ x: -1, y: 0 }); });
  it('北西 → 左上', () => { const v = parseCompassBearing('北西目の前のＳハウス')!; expect(v.x).toBeCloseTo(-Math.SQRT1_2); expect(v.y).toBeCloseTo(-Math.SQRT1_2); });
  it('南東 → 右下', () => { const v = parseCompassBearing('南東ひとつめのＳハウス')!; expect(v.x).toBeCloseTo(Math.SQRT1_2); expect(v.y).toBeCloseTo(Math.SQRT1_2); });
  it('北東 → 右上', () => { const v = parseCompassBearing('北東カーブの坂の途中左のＭハウス')!; expect(v.x).toBeCloseTo(Math.SQRT1_2); expect(v.y).toBeCloseTo(-Math.SQRT1_2); });
  it('修飾付きは先頭語のみ: 北左側 → 北(0,-1)', () => { expect(parseCompassBearing('北左側のＭハウス')).toEqual({ x: 0, y: -1 }); });
  it('空/null → null', () => { expect(parseCompassBearing('')).toBeNull(); expect(parseCompassBearing(null)).toBeNull(); });
});

describe('getPlotBearing', () => {
  it('テキスト方角を優先', () => {
    (getPlotDirections as ReturnType<typeof vi.fn>).mockReturnValue({ aetheryte: 'x', directions: '西の階段' });
    expect(getPlotBearing('Mist', 8, { x: 100, y: 100 }, { x: 50, y: 120 })).toEqual({ x: -1, y: 0 });
  });
  it('テキスト無し → origin→door の単位ベクトル', () => {
    (getPlotDirections as ReturnType<typeof vi.fn>).mockReturnValue({ aetheryte: 'x', directions: '' });
    expect(getPlotBearing('Goblet', 40, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 1, y: 0 });
  });
  it('directions=null(データ欠落) → フォールバック', () => {
    (getPlotDirections as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const v = getPlotBearing('Mist', 99, { x: 0, y: 0 }, { x: 0, y: 5 });
    expect(v).toEqual({ x: 0, y: 1 });
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run src/lib/housing/__tests__/plotBearing.test.ts`
Expected: FAIL（`plotBearing` が存在しない）

- [ ] **Step 3: 最小実装**

`src/lib/housing/plotBearing.ts`:

```ts
import { getPlotDirections } from './wardDirections';

export type Vec = { x: number; y: number };

const D = Math.SQRT1_2;
const COMPASS: Record<string, Vec> = {
  '北東': { x: D, y: -D },
  '北西': { x: -D, y: -D },
  '南東': { x: D, y: D },
  '南西': { x: -D, y: D },
  '北': { x: 0, y: -1 },
  '南': { x: 0, y: 1 },
  '東': { x: 1, y: 0 },
  '西': { x: -1, y: 0 },
};

/** 行き方テキスト先頭の方角語 → 単位ベクトル(px空間・y下向き)。先頭が方角語でなければ null。 */
export function parseCompassBearing(text: string | null | undefined): Vec | null {
  if (!text) return null;
  const m = text.match(/^(北東|北西|南東|南西|北|南|東|西)/);
  return m ? COMPASS[m[1]] : null;
}

function normalize(v: Vec): Vec {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

/** plot の方角ベクトル。テキスト先頭語を優先、無ければ origin→door の向き。 */
export function getPlotBearing(area: string, plot: number | null | undefined, originPx: Vec, doorPx: Vec): Vec {
  const dir = getPlotDirections(area, plot);
  const parsed = parseCompassBearing(dir?.directions);
  return parsed ?? normalize({ x: doorPx.x - originPx.x, y: doorPx.y - originPx.y });
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npx vitest run src/lib/housing/__tests__/plotBearing.test.ts`
Expected: PASS（9 tests）

- [ ] **Step 5: commit**

```bash
rtk git add src/lib/housing/plotBearing.ts src/lib/housing/__tests__/plotBearing.test.ts
rtk git commit -m "feat(housing): 方角パーサ plotBearing(テキスト先頭語→ベクトル/フォールバック)"
```

---

### Task 2: verbalRoute ヘルパー（判定・グリーディ歩き・曲がり角）

**Files:**
- Create: `src/lib/housing/verbalRoute.ts`
- Test: `src/lib/housing/__tests__/verbalRoute.test.ts`

**Interfaces:**
- Consumes: `nearestPointOnPolylines(px, py, edges)` / `type PolylineEdge` from `./mapGeometry`; `type WardMapJson` from `../../data/housing/wardMapManifest`; `type Vec` from `./plotBearing`
- Produces: `shouldReroute(withStartPts: [number,number][], dirVec: Vec): boolean`; `directionalWalk(json: WardMapJson, startPt: Vec, dirVec: Vec, maxNodes?: number): [number,number][] | null`; `findCornerOnWalk(pts: [number,number][], door: [number,number]): { point: [number,number]; segIndex: number }`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/verbalRoute.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { shouldReroute, directionalWalk, findCornerOnWalk } from '../verbalRoute';

// 合成マップ: O(50,20)から西へ Cn(20,20)→SW(20,70)、東へ ER(70,20)。viewBox 100×100。
const hook: WardMapJson = {
  area: 'Test', viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'O', x: 0.5, y: 0.2 }, { id: 'Cn', x: 0.2, y: 0.2 }, { id: 'SW', x: 0.2, y: 0.7 }, { id: 'ER', x: 0.7, y: 0.2 },
  ],
  edges: [
    { a: 'O', b: 'Cn', polyline: [[0.5, 0.2], [0.2, 0.2]] },
    { a: 'Cn', b: 'SW', polyline: [[0.2, 0.2], [0.2, 0.7]] },
    { a: 'O', b: 'ER', polyline: [[0.5, 0.2], [0.7, 0.2]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
};

describe('shouldReroute', () => {
  it('出だしが方角と同じ半平面 → false(agree)', () => {
    expect(shouldReroute([[0, 0], [30, 0], [30, 10]], { x: 1, y: 0 })).toBe(false);
  });
  it('出だしが方角の反対半平面 → true(reroute)', () => {
    expect(shouldReroute([[0, 0], [30, 0], [30, 10]], { x: -1, y: 0 })).toBe(true);
  });
  it('点が1つ以下 → false', () => {
    expect(shouldReroute([[5, 5]], { x: 1, y: 0 })).toBe(false);
  });
});

describe('directionalWalk', () => {
  it('西へ歩く(2点目は開始より左)', () => {
    const w = directionalWalk(hook, { x: 50, y: 20 }, { x: -1, y: 0 })!;
    expect(w.length).toBeGreaterThanOrEqual(2);
    expect(w[1][0]).toBeLessThan(w[0][0]);            // 西=左へ
    expect(w.some(([x, y]) => x === 20 && y === 20)).toBe(true); // Cn を通る
  });
});

describe('findCornerOnWalk', () => {
  it('8-8実座標の歩きで(684,305)付近が入口最寄り=曲がり角', () => {
    const walk: [number, number][] = [[829, 277], [799, 268], [690, 277], [684, 305], [595, 311], [593, 405]];
    const c = findCornerOnWalk(walk, [725, 380]);
    expect(c.point[0]).toBeCloseTo(684, 0);
    expect(c.point[1]).toBeCloseTo(305, 0);
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run src/lib/housing/__tests__/verbalRoute.test.ts`
Expected: FAIL（`verbalRoute` が存在しない）

- [ ] **Step 3: 最小実装**

`src/lib/housing/verbalRoute.ts`:

```ts
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import { nearestPointOnPolylines, type PolylineEdge } from './mapGeometry';
import type { Vec } from './plotBearing';

type Pt = [number, number];

function unit(dx: number, dy: number): Pt {
  const l = Math.hypot(dx, dy);
  return l === 0 ? [0, 0] : [dx / l, dy / l];
}
function pointAtFraction(pts: Pt[], f: number): Pt {
  if (pts.length <= 1) return pts[0] ?? [0, 0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const target = total * f;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + seg >= target) {
      const t = seg === 0 ? 0 : (target - acc) / seg;
      return [pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])];
    }
    acc += seg;
  }
  return pts[pts.length - 1];
}

/** origin から経路 30% 地点への向きが dirVec の反対半平面(dot<0)なら reroute。 */
export function shouldReroute(withStartPts: Pt[], dirVec: Vec): boolean {
  if (withStartPts.length < 2) return false;
  const s = withStartPts[0];
  const p = pointAtFraction(withStartPts, 0.3);
  const [hx, hy] = unit(p[0] - s[0], p[1] - s[1]);
  return hx * dirVec.x + hy * dirVec.y < 0;
}

/** origin を道に投影 → その乗り口から dirVec 方向へノードを貪欲に辿った px 点列 [ramp, node1, ...]。道無しで null。 */
export function directionalWalk(json: WardMapJson, startPt: Vec, dirVec: Vec, maxNodes = 6): Pt[] | null {
  const w = json.viewBox.w, h = json.viewBox.h;
  const edgesPx: PolylineEdge[] = json.edges.map((e) => ({
    a: e.a, b: e.b, polyline: e.polyline.map(([x, y]) => [x * w, y * h] as Pt),
  }));
  const nodePx = new Map<string, Pt>(json.nodes.map((n) => [n.id, [n.x * w, n.y * h] as Pt]));
  const onRamp = nearestPointOnPolylines(startPt.x, startPt.y, edgesPx);
  if (!onRamp) return null;
  const ramp: Pt = [onRamp.x, onRamp.y];
  const edge = edgesPx[onRamp.edgeIndex];
  const aPt = nodePx.get(edge.a)!, bPt = nodePx.get(edge.b)!;
  const ua = unit(aPt[0] - ramp[0], aPt[1] - ramp[1]);
  const ub = unit(bPt[0] - ramp[0], bPt[1] - ramp[1]);
  const dA = ua[0] * dirVec.x + ua[1] * dirVec.y;
  const dB = ub[0] * dirVec.x + ub[1] * dirVec.y;
  let cur = dA >= dB ? edge.a : edge.b;
  let prev = dA >= dB ? edge.b : edge.a;

  // 隣接: node → [{to, poly(node起点に向き揃え済)}]
  const adj = new Map<string, { to: string; poly: Pt[] }[]>();
  for (const e of edgesPx) {
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push({ to: e.b, poly: e.polyline });
    adj.get(e.b)!.push({ to: e.a, poly: e.polyline.slice().reverse() });
  }

  const walk: Pt[] = [ramp, nodePx.get(cur)!];
  const visited = new Set<string>([cur]);
  for (let step = 0; step < maxNodes; step++) {
    const options = (adj.get(cur) ?? []).filter((o) => o.to !== prev && !visited.has(o.to));
    let best: { to: string; poly: Pt[] } | null = null;
    let bestDot = -Infinity;
    for (const o of options) {
      const p0 = o.poly[0], p1 = o.poly[1] ?? nodePx.get(o.to)!;
      const [hx, hy] = unit(p1[0] - p0[0], p1[1] - p0[1]);
      const d = hx * dirVec.x + hy * dirVec.y;
      if (d > bestDot) { bestDot = d; best = o; }
    }
    if (!best || bestDot < 0) break; // 方角に沿う前進辺なし
    walk.push(...best.poly.slice(1));
    visited.add(best.to);
    prev = cur; cur = best.to;
  }
  return walk;
}

/** 歩き点列 pts 上で door に最も近い点(セグメント投影込み)とそのセグメント番号。 */
export function findCornerOnWalk(pts: Pt[], door: Pt): { point: Pt; segIndex: number } {
  const near = nearestPointOnPolylines(door[0], door[1], [{ a: '', b: '', polyline: pts }]);
  if (!near) return { point: pts[pts.length - 1], segIndex: Math.max(0, pts.length - 2) };
  return { point: [near.x, near.y], segIndex: near.segIndex };
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npx vitest run src/lib/housing/__tests__/verbalRoute.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: commit**

```bash
rtk git add src/lib/housing/verbalRoute.ts src/lib/housing/__tests__/verbalRoute.test.ts
rtk git commit -m "feat(housing): verbalRoute ヘルパー(agree判定/方角グリーディ歩き/曲がり角)"
```

---

### Task 3: buildVerbalRoute（合成 = agree は道追従 / reroute は方角→角→ジャンプ）

**Files:**
- Modify: `src/lib/housing/verbalRoute.ts`（`buildVerbalRoute` を追記）
- Test: `src/lib/housing/__tests__/verbalRoute.test.ts`（reroute/agree ケースを追記）

**Interfaces:**
- Consumes: `buildSnappedRoutePoints(json, startPt, endPt)` from `./wardRoute`（既存: `[number,number][] | null`）; 同ファイルの `shouldReroute` / `directionalWalk` / `findCornerOnWalk`
- Produces: `interface VerbalRoute { road: [number,number][]; jump: [number,number][] | null }`; `buildVerbalRoute(json: WardMapJson, startPt: Vec, endPt: Vec, dirVec: Vec): VerbalRoute | null`

- [ ] **Step 1: 失敗するテストを追記**

`src/lib/housing/__tests__/verbalRoute.test.ts` の末尾に追記（先頭 import に `buildVerbalRoute` を追加）:

```ts
import { buildVerbalRoute } from '../verbalRoute';

// 水平道 w(10,50)-m(50,50)-e(90,50)。agree 用。
const straight: WardMapJson = {
  area: 'Test', viewBox: { w: 100, h: 100 },
  nodes: [{ id: 'w', x: 0.1, y: 0.5 }, { id: 'm', x: 0.5, y: 0.5 }, { id: 'e', x: 0.9, y: 0.5 }],
  edges: [
    { a: 'w', b: 'm', polyline: [[0.1, 0.5], [0.5, 0.5]] },
    { a: 'm', b: 'e', polyline: [[0.5, 0.5], [0.9, 0.5]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
};

// フック+東ショートカット: 最短路は東(ER-ES-DP)経由で入口へ、しかしテキスト方角は西。
const reroute: WardMapJson = {
  area: 'Test', viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'O', x: 0.5, y: 0.2 }, { id: 'Cn', x: 0.2, y: 0.2 }, { id: 'SW', x: 0.2, y: 0.7 },
    { id: 'ER', x: 0.7, y: 0.2 }, { id: 'ES', x: 0.7, y: 0.5 }, { id: 'DP', x: 0.35, y: 0.5 },
  ],
  edges: [
    { a: 'O', b: 'Cn', polyline: [[0.5, 0.2], [0.2, 0.2]] },
    { a: 'Cn', b: 'SW', polyline: [[0.2, 0.2], [0.2, 0.7]] },
    { a: 'O', b: 'ER', polyline: [[0.5, 0.2], [0.7, 0.2]] },
    { a: 'ER', b: 'ES', polyline: [[0.7, 0.2], [0.7, 0.5]] },
    { a: 'ES', b: 'DP', polyline: [[0.7, 0.5], [0.35, 0.5]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
};

describe('buildVerbalRoute', () => {
  it('agree: 方角と道が一致 → 道追従・jump=null', () => {
    const r = buildVerbalRoute(straight, { x: 15, y: 50 }, { x: 85, y: 50 }, { x: 1, y: 0 })!;
    expect(r.jump).toBeNull();
    expect(r.road[0]).toEqual([15, 50]);
    expect(r.road[r.road.length - 1]).toEqual([85, 50]);
    expect(r.road.some(([x]) => Math.abs(x - 50) < 1)).toBe(true); // 中央ノードを通る(直線でない)
  });
  it('reroute: 最短路は東だがテキスト西 → 西へ歩き曲がり角から破線ジャンプ', () => {
    const r = buildVerbalRoute(reroute, { x: 50, y: 20 }, { x: 35, y: 45 }, { x: -1, y: 0 })!;
    expect(r.jump).not.toBeNull();
    expect(r.jump![r.jump!.length - 1]).toEqual([35, 45]);        // ジャンプ終点=入口
    expect(r.jump![0]).toEqual([20, 45]);                          // 曲がり角(西の縦道上の投影)
    expect(r.road.some(([x, y]) => x === 20 && y === 20)).toBe(true); // 西(Cn)を経由
    expect(r.jump![0]).toEqual(r.road[r.road.length - 1]);         // road 終点 == jump 始点(連続)
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run src/lib/housing/__tests__/verbalRoute.test.ts`
Expected: FAIL（`buildVerbalRoute` が存在しない）

- [ ] **Step 3: 最小実装（`verbalRoute.ts` 末尾に追記 + 先頭 import 追加）**

先頭に追加:

```ts
import { buildSnappedRoutePoints } from './wardRoute';
```

末尾に追加:

```ts
export interface VerbalRoute { road: Pt[]; jump: Pt[] | null }

/**
 * 行き方テキストの方角に沿った経路。
 * - agree(出だしが方角と同半平面): 既存の道追従(buildSnappedRoutePoints)そのまま。road=[S..snapped..E], jump=null。
 * - reroute(出だしが逆半平面): 方角へ道を歩き、入口最寄りの曲がり角で入口へ破線ジャンプ。road=[S..角], jump=[角,E]。
 */
export function buildVerbalRoute(json: WardMapJson, startPt: Vec, endPt: Vec, dirVec: Vec): VerbalRoute | null {
  const S: Pt = [startPt.x, startPt.y];
  const E: Pt = [endPt.x, endPt.y];
  const snapped = buildSnappedRoutePoints(json, startPt, endPt);
  if (snapped && snapped.length) {
    const withStart: Pt[] = [S, ...snapped, E];
    if (!shouldReroute(withStart, dirVec)) {
      return { road: [S, ...snapped, E], jump: null };
    }
  }
  const walk = directionalWalk(json, startPt, dirVec);
  if (!walk || walk.length < 2) return { road: [S], jump: [S, E] };
  const { point: corner, segIndex } = findCornerOnWalk(walk, E);
  return { road: [S, ...walk.slice(0, segIndex + 1), corner], jump: [corner, E] };
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npx vitest run src/lib/housing/__tests__/verbalRoute.test.ts`
Expected: PASS（7 tests: 前 5 + 新 2）

- [ ] **Step 5: commit**

```bash
rtk git add src/lib/housing/verbalRoute.ts src/lib/housing/__tests__/verbalRoute.test.ts
rtk git commit -m "feat(housing): buildVerbalRoute(agree=道追従/reroute=方角→角→破線ジャンプ)"
```

---

### Task 4: 手動上書き機構（wardRouteOverrides）

**Files:**
- Create: `src/data/housing/wardRouteOverrides.generated.json`
- Create: `src/lib/housing/wardRouteOverrides.ts`
- Test: `src/lib/housing/__tests__/wardRouteOverrides.test.ts`

**Interfaces:**
- Produces: `interface RouteOverride { road: [number,number][]; jump: [number,number][] | null }`; `getRouteOverride(mapKey: string, plotKey: string): RouteOverride | null`（座標は正規化 0..1）

- [ ] **Step 1: 上書きデータファイルを作る（初期は空）**

`src/data/housing/wardRouteOverrides.generated.json`:

```json
{}
```

- [ ] **Step 2: 失敗するテストを書く**

`src/lib/housing/__tests__/wardRouteOverrides.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../data/housing/wardRouteOverrides.generated.json', () => ({
  default: { mist: { '8': { road: [[0.44, 0.18], [0.36, 0.22]], jump: [[0.36, 0.22], [0.385, 0.27]] } } },
}));
import { getRouteOverride } from '../wardRouteOverrides';

describe('getRouteOverride', () => {
  it('収録済み (mapKey,plot) を返す', () => {
    const o = getRouteOverride('mist', '8')!;
    expect(o.road[0]).toEqual([0.44, 0.18]);
    expect(o.jump![1]).toEqual([0.385, 0.27]);
  });
  it('未収録は null', () => {
    expect(getRouteOverride('mist', '9')).toBeNull();
    expect(getRouteOverride('goblet', '8')).toBeNull();
  });
});
```

- [ ] **Step 3: テストが失敗するのを確認**

Run: `npx vitest run src/lib/housing/__tests__/wardRouteOverrides.test.ts`
Expected: FAIL（`wardRouteOverrides` が存在しない）

- [ ] **Step 4: 最小実装**

`src/lib/housing/wardRouteOverrides.ts`:

```ts
import overridesRaw from '../../data/housing/wardRouteOverrides.generated.json';

export interface RouteOverride { road: [number, number][]; jump: [number, number][] | null }
type OverrideTable = Record<string, Record<string, RouteOverride>>;
const TABLE = overridesRaw as OverrideTable;

/** (mapKey, plotKey) の手動上書き経路(正規化 0..1)。plotKey は plot 番号文字列 or 'apart'。無ければ null。 */
export function getRouteOverride(mapKey: string, plotKey: string): RouteOverride | null {
  return TABLE[mapKey]?.[plotKey] ?? null;
}
```

- [ ] **Step 5: テストが通るのを確認**

Run: `npx vitest run src/lib/housing/__tests__/wardRouteOverrides.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 6: commit**

```bash
rtk git add src/data/housing/wardRouteOverrides.generated.json src/lib/housing/wardRouteOverrides.ts src/lib/housing/__tests__/wardRouteOverrides.test.ts
rtk git commit -m "feat(housing): 経路 plot 単位手動上書き機構 wardRouteOverrides(初期空)"
```

---

### Task 5: buildTourMapPlacements 配線 + TourMapModel.routeJumpPath

**Files:**
- Modify: `src/lib/housing/buildTourMapPlacements.ts`
- Modify: `src/lib/housing/__tests__/buildTourMapPlacements.test.ts`（終点検証を reroute 対応化）

**Interfaces:**
- Consumes: `getPlotBearing`（Task 1）; `buildVerbalRoute`（Task 3）; `getRouteOverride`（Task 4）
- Produces: `TourMapModel.routeJumpPath: string | null`（破線ジャンプの SVG path。agree/上書き無ジャンプ時 null）

- [ ] **Step 1: 既存テストを reroute 対応に更新（先に失敗させる意図で）**

`src/lib/housing/__tests__/buildTourMapPlacements.test.ts` の 2 箇所を修正する。

64-73 行「経路の終点は箱の中心ちょうどではない」を、経路全体の終点（jump があれば jump、無ければ road）で判定するよう変更:

```ts
  it('経路の終点(道 or ジャンプ)は箱の中心ちょうどではない (改善2: 箱の縁で止まる)', () => {
    const cur = L({ id: 'a', plot: 6 }); const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    const endPath = m.routeJumpPath ?? m.routePath!;
    const coords = [...endPath.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)];
    const last = coords.at(-1)!;
    const [lx, ly] = [Number(last[1]), Number(last[2])];
    const house = mistWard.houses.find((h) => h.plot === 6 && h.kind === 'plot')!;
    const cx = house.x * mistWard.viewBox.w, cy = house.y * mistWard.viewBox.h;
    expect(Math.hypot(lx - cx, ly - cy)).toBeGreaterThan(1);
  });
```

81-88 行「入口データが収録済みの区画は経路終点が入口」も終点を jump 優先に変更:

```ts
  it('入口データが収録済みの区画は経路の終点が入口(0..1×viewBox)になる (改善2: 入口優先)', () => {
    const cur = L({ id: 'a', plot: 21 }); const ref = mistRef(21);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    const endPath = m.routeJumpPath ?? m.routePath!;
    const coords = [...endPath.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)];
    const last = coords.at(-1)!;
    expect(Number(last[1])).toBeCloseTo(0.2 * mistWard.viewBox.w, 1);
    expect(Number(last[2])).toBeCloseTo(0.3 * mistWard.viewBox.h, 1);
  });
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts`
Expected: FAIL（`routeJumpPath` が `TourMapModel` に無い型エラー / 未定義）

- [ ] **Step 3: `TourMapModel` に routeJumpPath を追加**

`src/lib/housing/buildTourMapPlacements.ts` の interface（15 行付近）に 1 行追加:

```ts
export interface TourMapModel {
  target: { x: number; y: number } | null;
  placed: TourMapPlacement[];
  routePath: string | null;                    // 実線: 起点→(道追従 or 角まで)
  routeJumpPath: string | null;                // 破線: 角→入口(道に無い区間/階段ジャンプ)。無ければ null
  origin: { x: number; y: number } | null;
  targetElId: string | null;
}
```

- [ ] **Step 4: import と経路生成部を差し替え**

先頭の import を変更:

```ts
import { plotToPlacementIn, apartToPlacementIn } from './wardRoute';
import { getPlotOriginNode } from './plotOrigin';
import { getApartmentOrigin } from './apartmentOrigin';
import { stepStatus, type StepStatus, type TourStep } from './tourNav';
import { getPlotEntrance } from './plotEntrance';
import { computePlotDoor } from './plotDoor';
import { getPlotBearing } from './plotBearing';
import { buildVerbalRoute } from './verbalRoute';
import { getRouteOverride } from './wardRouteOverrides';
```

`let routePath: string | null = null;`（57 行付近）の直後に 1 行追加:

```ts
  let routeJumpPath: string | null = null;
```

80-87 行（`// カーナビ方式:` コメント〜`routePath = pts.map(...)` の塊）を次で置換:

```ts
    // 方角ベクトル: 行き方テキスト先頭語を優先、無ければ エーテライト→玄関 の向き。
    const dirVec = getPlotBearing(currentListing.area, currentListing.plot, { x: oxPx, y: oyPx }, { x: doorX, y: doorY });
    // 手動上書き(plot単位)があれば最優先。無ければ方角ナビ(agree=道追従 / reroute=方角→角→破線ジャンプ)。
    const plotKey = ref.highlightKind === 'apart' ? 'apart' : String(ref.highlightPlot);
    const override = getRouteOverride(mapKey, plotKey);
    let road: [number, number][] | null = null;
    let jump: [number, number][] | null = null;
    if (override) {
      road = override.road.map(([x, y]) => [x * w, y * h] as [number, number]);
      jump = override.jump ? override.jump.map(([x, y]) => [x * w, y * h] as [number, number]) : null;
    } else {
      const verbal = buildVerbalRoute(json, { x: oxPx, y: oyPx }, { x: doorX, y: doorY }, dirVec);
      if (verbal) { road = verbal.road; jump = verbal.jump; }
    }
    if (road && road.length) {
      routePath = road.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    }
    if (jump && jump.length >= 2) {
      routeJumpPath = jump.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    }
```

return 文（90 行付近）に `routeJumpPath` を追加:

```ts
  return { target, placed, routePath, routeJumpPath, origin, targetElId: target ? ref.elementId : null };
```

- [ ] **Step 5: テストが通るのを確認（回帰含む）**

Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts`
Expected: PASS（全 9 tests・reroute 対応の 2 件含む）

- [ ] **Step 6: commit**

```bash
rtk git add src/lib/housing/buildTourMapPlacements.ts src/lib/housing/__tests__/buildTourMapPlacements.test.ts
rtk git commit -m "feat(housing): ツアー経路を方角ナビ配線(routeJumpPath追加/上書き優先)"
```

---

### Task 6: TourNavMap 破線ジャンプ描画 + housing.css

**Files:**
- Modify: `src/components/housing/tour/TourNavMap.tsx`
- Modify: `src/components/housing/tour/__tests__/TourNavMap.test.tsx`
- Modify: `src/styles/housing.css`

**Interfaces:**
- Consumes: `TourMapModel.routeJumpPath`（Task 5）

- [ ] **Step 1: 失敗するテストを追記（先に model リテラルへ routeJumpPath を追加）**

`src/components/housing/tour/__tests__/TourNavMap.test.tsx` の 10 行 `model` リテラルに `routeJumpPath: null` を追加:

```ts
const model: TourMapModel = { target: { x: 100, y: 100 }, placed: [ { index: 0, x: 100, y: 100, status: 'current' }, { index: 1, x: 200, y: 150, status: 'upcoming' } ], routePath: 'M10 10 L100 100', routeJumpPath: null, origin: { x: 10, y: 10 }, targetElId: 'plot_6' };
```

その describe 内に破線ジャンプのテストを 2 件追記:

```ts
  it('routeJumpPath があれば破線ジャンプを描く', () => {
    const jm: TourMapModel = { ...model, routeJumpPath: 'M100 100 L140 160' };
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={jm} />);
    const jump = container.querySelector('[data-testid="tour-map-route-jump"]');
    expect(jump).toBeTruthy();
    expect(jump?.getAttribute('d')).toBe('M100 100 L140 160');
  });
  it('routeJumpPath が null なら破線ジャンプは描かない', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelector('[data-testid="tour-map-route-jump"]')).toBeNull();
  });
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx`
Expected: FAIL（`tour-map-route-jump` 要素が無い）

- [ ] **Step 3: TourNavMap に破線ジャンプ描画を追加**

`src/components/housing/tour/TourNavMap.tsx` の 20 行付近（`const route = ...` の並び）に追加:

```ts
  const routeJump = model?.routeJumpPath ?? null;
```

`{route && ( ... )}` ブロックの直後（62 行 `{origin && (` の直前）に追加:

```tsx
                {routeJump && (
                  <path data-testid="tour-map-route-jump" className="housing-tour-route-jump" d={routeJump} fill="none" />
                )}
```

- [ ] **Step 4: housing.css に破線ジャンプのスタイルを追加**

`src/styles/housing.css` の `.housing-tour-route-comet { ... }`（6059-6062 行）の直後に追加。既存 `route-core` の流れる破線(`18 20`)と区別できる細かい点線・低い不透明度にする（トークン経由）:

```css
.housing-tour-route-jump {
  stroke: var(--housing-candle);
  stroke-width: 3.5;
  stroke-opacity: 0.7;
  stroke-linecap: round;
  stroke-dasharray: 1.5 12;
  filter: drop-shadow(0 0 5px var(--housing-honey));
}
```

- [ ] **Step 5: テストが通るのを確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx`
Expected: PASS（前 6 + 新 2 = 8 tests）

- [ ] **Step 6: commit**

```bash
rtk git add src/components/housing/tour/TourNavMap.tsx src/components/housing/tour/__tests__/TourNavMap.test.tsx src/styles/housing.css
rtk git commit -m "feat(housing): ツアー地図に破線ジャンプ描画(道に無い区間の表現)"
```

---

### Task 7: 統合検証（build / vitest / dev preview 自己確認）

**Files:** なし（検証のみ）

- [ ] **Step 1: 型・ビルド確認**

Run: `npm run build`
Expected: EXIT 0（tsc -b strict。`routeJumpPath` 未設定の TourMapModel リテラルが他に無いことも tsc が保証）

- [ ] **Step 2: 全体テスト確認**

Run: `npx vitest run`
Expected: 新規 fail 0（既知 legacy: TopBar4 + HousingWorkspace1 のみ）。`devTourPreview.test.ts` が routePath 終点を検証していれば、reroute 対応（`routeJumpPath ?? routePath`）に同様修正が要る場合あり — fail したら同パターンで修正して再実行。

- [ ] **Step 3: dev preview で 8-8 と回帰を自己検証（Playwright）**

`npm run dev` → `http://localhost:5173/housing/dev/tour-preview`。
- ミスト 8-8: エーテライトから**西へ実線 → 曲がり角 → 入口へ破線**になっている（東回りが消えた）。
- 従来 OK だった区画（例 mist 1/6/13/19、goblet/shirogane/empyreum の代表）: 見た目が**変わっていない**（agree=実線のまま・破線なし）。
- Playwright で 8-8 と代表 agree 区画のスクショを撮り、Claude が目視確認。
- スクショ確認後、dev server 停止。

- [ ] **Step 4: 台帳・TODO 更新（コミット）**

`.superpowers/sdd/progress.md` 末尾に完了記録、`docs/TODO.md` の最優先タスク状態を更新（100 行以内維持）。

```bash
rtk git add .superpowers/sdd/progress.md docs/TODO.md
rtk git commit -m "docs(housing): 行き方テキストナビ実装完了・全310目視待ちに更新"
```

- [ ] **Step 5: ユーザーへ引き継ぎ**

ユーザーが `/housing/dev/tour-preview` で**全 310 を目視**。違和感区画は §7 の `wardRouteOverrides` で個別修正（ユーザーが指摘 → Claude が座標をエンコード）or 閾値調整。**勝手に push/merge しない**。

---

## Self-Review（計画↔spec 照合）

- **spec §4.1 方角決定** → Task 1（`getPlotBearing`・テキスト優先/フォールバック）✓
- **spec §4.2 agree/reroute 判定** → Task 2 `shouldReroute`（30%・dot<0）✓
- **spec §4.4 方角グリーディ歩き** → Task 2 `directionalWalk`（乗り口→dirVec 貪欲・maxNodes・visited）✓
- **spec §4.4 曲がり角** → Task 2 `findCornerOnWalk`（歩き上の入口最寄り点＝mockup と一致する堅牢版。spec の「次ステップが離れる点」を closest-point で実装＝mid-segment も拾える上位互換）✓
- **spec §4.3/§4.5 合成・退化** → Task 3 `buildVerbalRoute`（agree=道追従 / reroute / walk<2 で直ジャンプ）✓
- **spec §5 データ構造** → Task 5（`TourMapModel.routeJumpPath` / 配線）✓
- **spec §6 描画** → Task 6（破線パス + agree 不変）✓
- **spec §7 手動上書き** → Task 4（`wardRouteOverrides` データ+ルックアップ）+ Task 5（override 最優先配線）✓
- **spec §8 テスト** → 各 Task の TDD ✓
- **spec §9 検証** → Task 7（build/vitest/preview）✓
- **spec §10 スコープ外** → オーサリング UI は非対象（後続）。先頭方角語のみ。push/merge はユーザー判断 ✓

**型整合:** `Vec`（plotBearing 定義→verbalRoute/buildTourMapPlacements で使用）/ `VerbalRoute {road,jump}`（Task 3 定義→Task 5 消費）/ `RouteOverride {road,jump}`（Task 4→Task 5）/ `getRouteOverride(mapKey, plotKey:string)`（Task 4 定義→Task 5 で `plotKey='apart'|String(plot)`）/ `routeJumpPath`（Task 5 定義→Task 6 消費・TourNavMap.test リテラル更新）— 一貫。

**プレースホルダ:** なし（全ステップに実コード）。

## 実行方法

subagent-driven-development で Task 1→7 を順に。純関数 Task 1〜4 は互いに独立（Task 3 は Task 2 と同ファイル追記なので Task 2 の後）。並行化する場合は Task 1 と (Task 2→3) と Task 4 を別サブエージェントに割り当て可能。Task 5 は Task 1/3/4 完了後、Task 6 は Task 5 完了後。
