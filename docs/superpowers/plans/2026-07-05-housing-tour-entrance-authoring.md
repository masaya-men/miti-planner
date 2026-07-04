# 家の入口 手動補正ツール + 経路終点の入口優先化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツアー中地図の経路終点を「収録済みの家は手動指定の入口へ、未収録は従来の幾何(箱縁)へ」優先解決し、開発者が実マップ上でドラッグ補正して入口データを作れるツールを追加する（spec 改善2 の精度化）。

**Architecture:** 入口は別ファイルの静的JSON(`wardEntrances.generated.json`・補正した家だけの疎データ)。純関数 `getPlotEntrance`(データ引き) と `computePlotDoor`(幾何・既存インラインを切り出し) を新設し、`buildTourMapPlacements` の終点決定を「入口→幾何→箱中心」の優先順に置換。開発専用ページ(`import.meta.env.DEV` gate)が全区画に幾何のマーカーを出し、ドラッグ補正→JSON書き出し。保全済みの地図参照データ(座標/node/edges/roadPath/outline)は不変。

**Tech Stack:** TypeScript / React / Vitest(happy-dom) / SVG(getScreenCTM) / housing.css design tokens / react-router。

## Global Constraints

- 座標系は **0..1 正規化 × viewBox**。純関数の幾何は px-in/px-out(`mapGeometry`)、入口データ/outline は 0..1。
- `npm run build`(tsc -b 厳密・Vercel と同条件)EXIT0。既知 legacy 5 fail(TopBar4 + HousingWorkspace1)以外の**新規 fail ゼロ**。
- 保全済み地図データ(`*.generated.json` の nodes/edges/roadPath/houses x/y/node/outline)は**一切変更しない**。入口データは別ファイルの追加レイヤー。
- `/housing` は独自トンマナ(`housing.css` トークン経由・色/寸法/影のハードコード禁止・literal は housing.css 内のみ)。
- オーサリングページは**本番ビルドに露出しない**(`import.meta.env.DEV` gate)。
- mapKey は `resolveWardMapRef` の値(`mist`/`mist-sub`/`goblet`/…全10)。入口JSON は mapKey と highlightPlot(SVG空間 1-30)/`apart` でキーする。
- ブランチ `feat/housing-tour-nav-m1` の続き。legacy(MapView 等)非破壊。

---

### Task 1: 入口データファイル + `getPlotEntrance` 純関数

入口データの器(空JSON)と、住所→入口点を引く純関数。データ空 = 全 null = 従来挙動(回帰なし)。

**Files:**
- Create: `src/data/housing/wardEntrances.generated.json`
- Create: `src/lib/housing/plotEntrance.ts`
- Test: `src/lib/housing/__tests__/plotEntrance.test.ts`

**Interfaces:**
- Consumes: `resolveWardMapRef(area, plot, apartmentBuilding, buildingType)`(既存 `src/lib/housing/resolveWardMapRef.ts`。返り値 `{ mapKey, highlightPlot, highlightKind, elementId } | null`)。
- Produces:
  - `function getPlotEntrance(area: string, plot: number | null | undefined, buildingType: 'house' | 'apartment' | undefined, apartmentBuilding: 1 | 2 | null | undefined): [number, number] | null`
  - 入口JSON 型: `Record<string, Record<string, [number, number]>>`(mapKey → (plot文字列|'apart') → [x,y] 0..1)。

- [ ] **Step 1: 空データファイルを作る**

`src/data/housing/wardEntrances.generated.json`:
```json
{}
```

- [ ] **Step 2: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/plotEntrance.test.ts
import { describe, it, expect, vi } from 'vitest';

// wardEntrances.generated.json をテスト用にモック(実データは空のため)
vi.mock('../../../data/housing/wardEntrances.generated.json', () => ({
  default: { mist: { '6': [0.42, 0.58], apart: [0.5, 0.6] }, 'goblet-sub': { '3': [0.31, 0.44] } },
}));

import { getPlotEntrance } from '../plotEntrance';

describe('getPlotEntrance', () => {
  it('収録済みの区画はその点(0..1)を返す', () => {
    expect(getPlotEntrance('Mist', 6, 'house', null)).toEqual([0.42, 0.58]);
  });

  it('拡張街(plot 33 = sub の SVG plot 3)は -30 読み替えで解決', () => {
    expect(getPlotEntrance('Goblet', 33, 'house', null)).toEqual([0.31, 0.44]);
  });

  it('アパートは apart キーを引く', () => {
    expect(getPlotEntrance('Mist', null, 'apartment', 1)).toEqual([0.5, 0.6]);
  });

  it('未収録の区画は null', () => {
    expect(getPlotEntrance('Mist', 12, 'house', null)).toBeNull();
  });

  it('未知エリアは null', () => {
    expect(getPlotEntrance('Unknown', 1, 'house', null)).toBeNull();
  });
});
```

- [ ] **Step 3: テストが落ちることを確認**

Run: `npx vitest run src/lib/housing/__tests__/plotEntrance.test.ts`
Expected: FAIL(`getPlotEntrance` is not a function / module not found)

- [ ] **Step 4: 実装**

```ts
// src/lib/housing/plotEntrance.ts
import { resolveWardMapRef } from './resolveWardMapRef';
import data from '../../data/housing/wardEntrances.generated.json';

const TABLE = data as Record<string, Record<string, [number, number]>>;

/**
 * 家(area, plot / apartment)の手動指定入口を引く純関数。収録あり→[x,y](0..1)、なし→null。
 * mapKey/plot は resolveWardMapRef で解決(拡張街 -30 読み替え・アパート棟 → mapKey/'apart')。
 */
export function getPlotEntrance(
  area: string,
  plot: number | null | undefined,
  buildingType: 'house' | 'apartment' | undefined,
  apartmentBuilding: 1 | 2 | null | undefined,
): [number, number] | null {
  const ref = resolveWardMapRef(area, plot ?? null, apartmentBuilding ?? null, buildingType);
  if (!ref) return null;
  const key = ref.highlightKind === 'apart' ? 'apart' : String(ref.highlightPlot);
  return TABLE[ref.mapKey]?.[key] ?? null;
}
```

- [ ] **Step 5: テスト成功を確認**

Run: `npx vitest run src/lib/housing/__tests__/plotEntrance.test.ts`
Expected: PASS(5 tests)

- [ ] **Step 6: build**

Run: `npm run build`
Expected: EXIT0(JSON import は resolveJsonModule 有効前提。既存 wardAetherytes.generated.json と同じ import 形式なので通る)

- [ ] **Step 7: コミット**

```bash
rtk git add src/data/housing/wardEntrances.generated.json src/lib/housing/plotEntrance.ts src/lib/housing/__tests__/plotEntrance.test.ts
rtk git commit -m "feat(housing): 入口データ器+getPlotEntrance純関数(改善2・空データ=従来挙動)"
```

---

### Task 2: `computePlotDoor` 純関数(箱縁幾何の切り出し)

現在 `buildTourMapPlacements` にインラインの「最寄りノード→箱中心 線分 × outline 交点」を純関数化。経路とオーサリングツールが同じ計算を使う。

**Files:**
- Create: `src/lib/housing/plotDoor.ts`
- Test: `src/lib/housing/__tests__/plotDoor.test.ts`

**Interfaces:**
- Consumes: `plotToPlacementIn(json, plot, kind)` / `apartToPlacementIn(json)` / `nodeToPointIn(json, nodeId)`(既存 `wardRoute.ts`)、`segmentPolygonIntersection`(既存 `mapGeometry.ts`)、`WardMapJson`(既存 `wardMapManifest.ts`)。`Placement` は `{ x; y; nodeId; outline }`。
- Produces:
  - `function computePlotDoor(json: WardMapJson, plot: number, kind: 'plot' | 'apart'): { x: number; y: number } | null`
  - 箱縁の交点(px)を返す。placement 無し / nodeId 無し / outline < 3点 / 交点なし(凹型で重心が外)→ null。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/plotDoor.test.ts
import { describe, it, expect } from 'vitest';
import mist from '../../../data/housing/mistWard.generated.json';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { computePlotDoor } from '../plotDoor';
import { plotToPlacementIn } from '../wardRoute';

const json = mist as unknown as WardMapJson;

describe('computePlotDoor', () => {
  it('凸型の家は箱の縁(中心ではない)で交点を返す', () => {
    const door = computePlotDoor(json, 6, 'plot')!;
    expect(door).not.toBeNull();
    const p = plotToPlacementIn(json, 6, 'plot')!;
    // 交点は箱中心とは異なる(手前で止まる)
    expect(Math.hypot(door.x - p.x, door.y - p.y)).toBeGreaterThan(1);
  });

  it('存在しない区画は null', () => {
    expect(computePlotDoor(json, 999, 'plot')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/housing/__tests__/plotDoor.test.ts`
Expected: FAIL(`computePlotDoor` is not a function)

- [ ] **Step 3: 実装**

```ts
// src/lib/housing/plotDoor.ts
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import { plotToPlacementIn, apartToPlacementIn, nodeToPointIn } from './wardRoute';
import { segmentPolygonIntersection } from './mapGeometry';

/**
 * 家の「玄関(箱の縁)」座標(px)を幾何で求める純関数。最寄りノード→箱中心 の線分が箱輪郭(outline)に
 * 触れた点を返す。placement/nodeId/outline が無い、または交点なし(凹型で重心が多角形外)→ null。
 * routePath とオーサリングツールが同じ計算を共有し「見たまま」を保証する。
 */
export function computePlotDoor(
  json: WardMapJson,
  plot: number,
  kind: 'plot' | 'apart',
): { x: number; y: number } | null {
  const p = kind === 'apart' ? apartToPlacementIn(json) : plotToPlacementIn(json, plot, 'plot');
  if (!p || !p.nodeId) return null;
  const w = json.viewBox.w, h = json.viewBox.h;
  const lastNode = nodeToPointIn(json, p.nodeId); // 既に px
  const outlinePx = (p.outline ?? []).map(([x, y]) => [x * w, y * h] as [number, number]);
  if (!lastNode || outlinePx.length < 3) return null;
  const hit = segmentPolygonIntersection(lastNode.x, lastNode.y, p.x, p.y, outlinePx);
  return hit ? { x: hit.x, y: hit.y } : null;
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `npx vitest run src/lib/housing/__tests__/plotDoor.test.ts`
Expected: PASS(2 tests)

- [ ] **Step 5: build + コミット**

Run: `npm run build`(EXIT0)
```bash
rtk git add src/lib/housing/plotDoor.ts src/lib/housing/__tests__/plotDoor.test.ts
rtk git commit -m "feat(housing): computePlotDoor 箱縁幾何を純関数に切り出し(改善2)"
```

---

### Task 3: `buildTourMapPlacements` を「入口→幾何→箱中心」優先に配線

終点決定を Task1/2 の関数で置換。入口データ空 = computePlotDoor(=従来インラインと同一計算)= 現行挙動維持で回帰なし。

**Files:**
- Modify: `src/lib/housing/buildTourMapPlacements.ts`(現 79-88 のインライン幾何を置換 + import 整理)
- Test: `src/lib/housing/__tests__/buildTourMapPlacements.test.ts`(既存に追記)

**Interfaces:**
- Consumes: `getPlotEntrance`(Task1)、`computePlotDoor`(Task2)。`ref.highlightPlot` / `ref.highlightKind`(既存)。
- 既存 `TourMapModel` の形は不変。

**現状(該当箇所)** — `buildTourMapPlacements.ts:79-88`(`// 改善2: 箱の中心ではなく…` の doorX/doorY 決定ブロック)と import(8行目 `segmentPolygonIntersection`, 4行目 `nodeToPointIn`)。

- [ ] **Step 1: 失敗するテストを書く(追記)**

```ts
// buildTourMapPlacements.test.ts に追記。既存の import / フィクスチャ(mist, ref, listing plot6, steps, idx)を流用。
// getPlotEntrance を「収録あり」にモックして終点=入口になることを検証する。
import { vi } from 'vitest';

it('入口データが収録済みの区画は経路終点が入口(0..1×viewBox)になる', () => {
  // plot6 の入口を 0.20,0.30 に収録したと仮定してモック
  vi.doMock('../plotEntrance', () => ({ getPlotEntrance: () => [0.2, 0.3] as [number, number] }));
  // モック反映のため動的 import
  return import('../buildTourMapPlacements').then(({ buildTourMapPlacements }) => {
    const model = buildTourMapPlacements(mist as unknown as WardMapJson, 'mist', ref, listing, steps, idx);
    const coords = [...model.routePath!.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)];
    const last = coords.at(-1)!;
    expect(Number(last[1])).toBeCloseTo(0.2 * mist.viewBox.w, 1);
    expect(Number(last[2])).toBeCloseTo(0.3 * mist.viewBox.h, 1);
    vi.doUnmock('../plotEntrance');
  });
});
```

> 注: 既存テスト(始点=エーテライト / 終点≠箱中心)は入口データ空(実 JSON)のままなので computePlotDoor フォールバックで**引き続き PASS** すること(Step 4 で確認)。

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts`
Expected: 新テスト FAIL(現状は入口データ未参照で終点=幾何交点)

- [ ] **Step 3: 実装(import 整理 + doorX/doorY 置換)**

`buildTourMapPlacements.ts` の import を修正:
```ts
// 4行目: nodeToPointIn を除去(plotDoor へ移動)。残す: plotToPlacementIn, apartToPlacementIn, buildRoutePathIn
import { plotToPlacementIn, apartToPlacementIn, buildRoutePathIn } from './wardRoute';
// 8行目: segmentPolygonIntersection を除去。残す: nearestPointOnPolylines(改善1 の proj で使用)
import { nearestPointOnPolylines } from './mapGeometry';
// 追加:
import { getPlotEntrance } from './plotEntrance';
import { computePlotDoor } from './plotDoor';
```

現 79-88 の doorX/doorY 決定ブロックを次に置換:
```ts
      // 改善2: 入口データ優先 → 幾何(箱縁) → 箱中心 の順で終点を決める。
      let doorX = targetPlacement.x, doorY = targetPlacement.y;
      const entrance = currentListing
        ? getPlotEntrance(currentListing.area, currentListing.plot, currentListing.buildingType, currentListing.apartmentBuilding)
        : null;
      if (entrance) {
        doorX = entrance[0] * w; doorY = entrance[1] * h;
      } else {
        const geoDoor = computePlotDoor(json, ref.highlightPlot, ref.highlightKind);
        if (geoDoor) { doorX = geoDoor.x; doorY = geoDoor.y; }
      }
```
(`routePath = ` の行は不変。)

- [ ] **Step 4: テスト成功 + 回帰なし + build**

Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts && npm run build`
Expected: 全 PASS(新 + 既存の始点/終点テストも緑)+ EXIT0。既存の「終点≠箱中心」は computePlotDoor フォールバックが同値を返すため維持。

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/buildTourMapPlacements.ts src/lib/housing/__tests__/buildTourMapPlacements.test.ts
rtk git commit -m "feat(housing): 経路終点を入口データ優先に(改善2・幾何/箱中心フォールバック維持)"
```

---

### Task 4: オーサリング用 純関数(正規化変換 + JSON書き出し整形)

ドラッグの座標変換の純部分と、上書き点→書き出しJSON整形。DOM 依存部(getScreenCTM)は Task5 で扱い、ここは純ロジックのみ。

**Files:**
- Create: `src/lib/housing/entranceAuthoring.ts`
- Test: `src/lib/housing/__tests__/entranceAuthoring.test.ts`

**Interfaces:**
- Produces:
  - `function normToPx(nx: number, ny: number, vb: { w: number; h: number }): { x: number; y: number }`
  - `function pxToNorm(px: number, py: number, vb: { w: number; h: number }): [number, number]`
  - `type EntranceOverrides = Record<string, [number, number]>`(key = plot文字列|'apart')
  - `function buildEntranceExport(existing: Record<string, EntranceOverrides>, mapKey: string, overrides: EntranceOverrides): Record<string, EntranceOverrides>`
    - existing(現JSON) に mapKey の overrides をマージした新オブジェクトを返す(該当 mapKey を差し替え、空 override はキー削除、他 mapKey は保持)。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/entranceAuthoring.test.ts
import { describe, it, expect } from 'vitest';
import { normToPx, pxToNorm, buildEntranceExport } from '../entranceAuthoring';

describe('entranceAuthoring', () => {
  const vb = { w: 100, h: 200 };

  it('normToPx は 0..1 を viewBox px に変換', () => {
    expect(normToPx(0.5, 0.25, vb)).toEqual({ x: 50, y: 50 });
  });

  it('pxToNorm は viewBox px を 0..1 に変換(往復整合)', () => {
    const [nx, ny] = pxToNorm(50, 50, vb);
    expect(nx).toBeCloseTo(0.5, 6);
    expect(ny).toBeCloseTo(0.25, 6);
  });

  it('buildEntranceExport は該当 mapKey を差し替え、他 mapKey を保持', () => {
    const existing = { mist: { '6': [0.4, 0.5] as [number, number] }, goblet: { '3': [0.1, 0.2] as [number, number] } };
    const out = buildEntranceExport(existing, 'mist', { '6': [0.42, 0.58], '12': [0.3, 0.3] });
    expect(out.mist).toEqual({ '6': [0.42, 0.58], '12': [0.3, 0.3] });
    expect(out.goblet).toEqual({ '3': [0.1, 0.2] });
  });

  it('overrides が空なら該当 mapKey を落とす', () => {
    const existing = { mist: { '6': [0.4, 0.5] as [number, number] }, goblet: { '3': [0.1, 0.2] as [number, number] } };
    const out = buildEntranceExport(existing, 'mist', {});
    expect(out.mist).toBeUndefined();
    expect(out.goblet).toEqual({ '3': [0.1, 0.2] });
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/housing/__tests__/entranceAuthoring.test.ts`
Expected: FAIL(module not found)

- [ ] **Step 3: 実装**

```ts
// src/lib/housing/entranceAuthoring.ts
export type EntranceOverrides = Record<string, [number, number]>;

/** 0..1 正規化 → viewBox px。 */
export function normToPx(nx: number, ny: number, vb: { w: number; h: number }): { x: number; y: number } {
  return { x: nx * vb.w, y: ny * vb.h };
}

/** viewBox px → 0..1 正規化。 */
export function pxToNorm(px: number, py: number, vb: { w: number; h: number }): [number, number] {
  return [px / vb.w, py / vb.h];
}

/** 現JSON に mapKey の上書きをマージした新オブジェクトを返す。空 override は該当 mapKey を削除、他 mapKey は保持。 */
export function buildEntranceExport(
  existing: Record<string, EntranceOverrides>,
  mapKey: string,
  overrides: EntranceOverrides,
): Record<string, EntranceOverrides> {
  const next: Record<string, EntranceOverrides> = { ...existing };
  if (Object.keys(overrides).length === 0) {
    delete next[mapKey];
  } else {
    next[mapKey] = { ...overrides };
  }
  return next;
}
```

- [ ] **Step 4: テスト成功 + build + コミット**

Run: `npx vitest run src/lib/housing/__tests__/entranceAuthoring.test.ts && npm run build`
Expected: PASS(4 tests) + EXIT0
```bash
rtk git add src/lib/housing/entranceAuthoring.ts src/lib/housing/__tests__/entranceAuthoring.test.ts
rtk git commit -m "feat(housing): 入口オーサリングの正規化変換+JSON整形 純関数"
```

---

### Task 5: 入口オーサリングページ(開発専用コンポーネント)

実マップに全区画の入口マーカー(初期=幾何 or 既存override)を出し、ドラッグ補正→色分け→JSON書き出し。ドラッグは SVG `getScreenCTM()` で letterbox 補正。

**Files:**
- Create: `src/components/housing/dev/EntranceAuthoringPage.tsx`
- Modify: `src/styles/housing.css`(マーカー用トークン + クラス。tour ブロック付近に追記)
- Test: `src/components/housing/dev/__tests__/EntranceAuthoringPage.test.tsx`

**Interfaces:**
- Consumes: `useWardMapAsset(mapKey)`(既存 `src/lib/housing/useWardMapAsset.ts` → `{ status, svg, json }`)、`WARD_MAP_LOADERS`(既存 `wardMapManifest.ts`・マップ選択肢の mapKey 一覧)、`computePlotDoor`(Task2)、`normToPx`/`buildEntranceExport`(Task4)、既存入口JSON(`wardEntrances.generated.json`)。
- 各区画は `json.houses`(`{ kind, plot, x, y, node, outline }`)を反復。マーカー初期位置 = 既存override(あれば) or `computePlotDoor(json, house.plot, house.kind)`(px) or 箱中心(house.x×w, house.y×h)。

**ドラッグ実装方針(happy-dom テストでは getScreenCTM 不在のためガード):**
オーバーレイ `<svg viewBox=... preserveAspectRatio="xMidYMid meet">` 内にマーカーを SVG `<circle>` で置き、pointer 移動時 `svg.getScreenCTM()?.inverse()` で client→viewBox 変換(letterbox/meet を正しく処理)。CTM 取得不可(テスト環境)なら no-op。

- [ ] **Step 1: 失敗するテスト(非視覚の骨組みのみ)を書く**

```tsx
// src/components/housing/dev/__tests__/EntranceAuthoringPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EntranceAuthoringPage } from '../EntranceAuthoringPage';

// useWardMapAsset を ready(mist の houses 2件)でモック
vi.mock('../../../../lib/housing/useWardMapAsset', () => ({
  useWardMapAsset: () => ({
    status: 'ready',
    svg: '<svg viewBox="0 0 100 100"></svg>',
    json: {
      viewBox: { w: 100, h: 100 },
      nodes: [{ id: 'n1', x: 0.5, y: 0.5 }],
      edges: [],
      houses: [
        { kind: 'plot', plot: 6, x: 0.4, y: 0.4, node: 'n1', outline: [[0.35,0.35],[0.45,0.35],[0.45,0.45],[0.35,0.45]] },
        { kind: 'plot', plot: 7, x: 0.6, y: 0.6, node: 'n1', outline: [[0.55,0.55],[0.65,0.55],[0.65,0.65],[0.55,0.65]] },
      ],
    },
  }),
}));
vi.mock('../../../../data/housing/wardEntrances.generated.json', () => ({ default: {} }));

describe('EntranceAuthoringPage', () => {
  it('選択マップの全区画分の入口マーカーを描画する', () => {
    const { container } = render(<EntranceAuthoringPage />);
    const markers = container.querySelectorAll('[data-testid="entrance-marker"]');
    expect(markers.length).toBe(2);
  });

  it('初期は全マーカーが未補正(uncorrected)クラス', () => {
    const { container } = render(<EntranceAuthoringPage />);
    const corrected = container.querySelectorAll('.housing-entrance-marker--corrected');
    expect(corrected.length).toBe(0);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/components/housing/dev/__tests__/EntranceAuthoringPage.test.tsx`
Expected: FAIL(module not found)

- [ ] **Step 3: housing.css にマーカー用トークン + クラスを追記**

`.housing-workspace, …` トークンブロック(既存 `--housing-*`)に:
```css
  --housing-entrance-marker: var(--housing-text-mute);      /* 未補正(幾何のまま) */
  --housing-entrance-marker-corrected: var(--housing-honey); /* 補正済(ドラッグした) */
  --housing-entrance-marker-size: 14px;
```
スタイル(tour 地図 CSS 付近に追記):
```css
.housing-entrance-authoring { position: relative; width: 100%; height: 100%; }
.housing-entrance-overlay { position: absolute; inset: 0; }
.housing-entrance-marker { fill: var(--housing-entrance-marker); cursor: grab; }
.housing-entrance-marker--corrected { fill: var(--housing-entrance-marker-corrected); }
.housing-entrance-marker-label { fill: var(--housing-map-light); font-size: 10px; pointer-events: none; }
```

- [ ] **Step 4: ページコンポーネントを実装**

```tsx
// src/components/housing/dev/EntranceAuthoringPage.tsx
import { useMemo, useRef, useState } from 'react';
import { useWardMapAsset } from '../../../lib/housing/useWardMapAsset';
import { WARD_MAP_LOADERS } from '../../../data/housing/wardMapManifest';
import { computePlotDoor } from '../../../lib/housing/plotDoor';
import { pxToNorm, buildEntranceExport, type EntranceOverrides } from '../../../lib/housing/entranceAuthoring';
import existingData from '../../../data/housing/wardEntrances.generated.json';

const EXISTING = existingData as Record<string, EntranceOverrides>;
const MAP_KEYS = Object.keys(WARD_MAP_LOADERS);

/** 家1件のキー(plot番号 or 'apart')。 */
function houseKey(h: { kind: string; plot: number }): string {
  return h.kind === 'apart' ? 'apart' : String(h.plot);
}

export function EntranceAuthoringPage() {
  const [mapKey, setMapKey] = useState(MAP_KEYS[0]);
  const asset = useWardMapAsset(mapKey);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  // 各マップの上書き点(0..1)。初期は既存JSON。
  const [overrides, setOverrides] = useState<Record<string, EntranceOverrides>>(() => ({ ...EXISTING }));

  const json = asset.status === 'ready' ? asset.json : null;
  const vb = json?.viewBox ?? { w: 0, h: 0 };
  const mapOverrides = overrides[mapKey] ?? {};

  // 各家の表示座標(px)。上書きあればそれ、なければ幾何、なければ箱中心。
  const markers = useMemo(() => {
    if (!json) return [];
    return json.houses.map((h) => {
      const key = houseKey(h);
      const ov = mapOverrides[key];
      let px: number, py: number;
      if (ov) { px = ov[0] * vb.w; py = ov[1] * vb.h; }
      else {
        const geo = computePlotDoor(json, h.plot, h.kind);
        if (geo) { px = geo.x; py = geo.y; } else { px = h.x * vb.w; py = h.y * vb.h; }
      }
      return { key, plot: h.plot, kind: h.kind, px, py, corrected: !!ov };
    });
  }, [json, vb.w, vb.h, mapOverrides]);

  function clientToViewBox(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!svg || !ctm) return null; // テスト環境 no-op
    const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragKey || !json) return;
    const vbp = clientToViewBox(e.clientX, e.clientY);
    if (!vbp) return;
    const [nx, ny] = pxToNorm(vbp.x, vbp.y, vb);
    setOverrides((prev) => ({ ...prev, [mapKey]: { ...(prev[mapKey] ?? {}), [dragKey]: [nx, ny] } }));
  }

  const exportJson = JSON.stringify(buildEntranceExport(EXISTING, mapKey, mapOverrides), null, 2);

  return (
    <div className="housing-workspace housing-shell-root" data-theme="dark">
      <div style={{ padding: 16 }}>
        <label>マップ:{' '}
          <select value={mapKey} onChange={(e) => setMapKey(e.target.value)}>
            {MAP_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => navigator.clipboard?.writeText(exportJson)}>JSON書き出し(クリップボード)</button>
      </div>
      <div className="housing-tour-map" style={{ height: '70vh' }}>
        <div className="housing-tour-map-stage"><div className="housing-tour-map-wrap">
          {asset.status === 'ready' && (
            <>
              <div className="housing-map-svg-host" dangerouslySetInnerHTML={{ __html: asset.svg }} />
              <svg
                ref={svgRef}
                className="housing-map-overlay housing-entrance-overlay"
                viewBox={`0 0 ${vb.w} ${vb.h}`}
                preserveAspectRatio="xMidYMid meet"
                onPointerMove={onPointerMove}
                onPointerUp={() => setDragKey(null)}
                onPointerLeave={() => setDragKey(null)}
              >
                {markers.map((m) => (
                  <g key={m.key}>
                    <circle
                      data-testid="entrance-marker"
                      className={`housing-entrance-marker${m.corrected ? ' housing-entrance-marker--corrected' : ''}`}
                      cx={m.px} cy={m.py} r={7}
                      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDragKey(m.key); }}
                    />
                    <text className="housing-entrance-marker-label" x={m.px + 8} y={m.py}>{m.kind === 'apart' ? 'A' : m.plot}</text>
                  </g>
                ))}
              </svg>
            </>
          )}
        </div></div>
      </div>
      <pre style={{ maxHeight: 160, overflow: 'auto', padding: 12 }}>{exportJson}</pre>
    </div>
  );
}
```

- [ ] **Step 5: テスト成功を確認**

Run: `npx vitest run src/components/housing/dev/__tests__/EntranceAuthoringPage.test.tsx`
Expected: PASS(2 tests・マーカー2件・corrected 0件)

- [ ] **Step 6: build**

Run: `npm run build`
Expected: EXIT0(未使用 import/変数に注意。`navigator.clipboard?.` の optional 呼び出しは tsc OK)

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/housing/dev/EntranceAuthoringPage.tsx src/components/housing/dev/__tests__/EntranceAuthoringPage.test.tsx src/styles/housing.css
rtk git commit -m "feat(housing): 入口オーサリングページ(開発専用・全区画マーカー/ドラッグ/JSON書き出し)"
```

---

### Task 6: 開発専用ルートを配線(`import.meta.env.DEV` gate)

オーサリングページを本番非露出でルーティング。

**Files:**
- Modify: `src/App.tsx`(route 追加・DEV gate)

**Interfaces:**
- Consumes: `EntranceAuthoringPage`(Task5)。既存 `/housing` ルート群の隣に追加。

- [ ] **Step 1: App.tsx にルートを追加**

`src/App.tsx` の import 群に追加:
```ts
import { EntranceAuthoringPage } from './components/housing/dev/EntranceAuthoringPage';
```
`<Routes>` 内(既存 `/housing/legacy` などの並び)に、**DEV ビルドのみ**登録:
```tsx
{import.meta.env.DEV && (
  <Route path="/housing/dev/entrances" element={<EntranceAuthoringPage />} />
)}
```

- [ ] **Step 2: build で本番非露出を確認**

Run: `npm run build`
Expected: EXIT0。`import.meta.env.DEV` は本番ビルドで `false` 畳み込み → route はツリーから除去(dead-code 除去)。tsc は import を保持するが未使用エラーにはならない(JSX で参照済み)。

- [ ] **Step 3: dev 手動確認(実画面ゲート・ユーザー)**

`npm run dev` → `http://localhost:5173/housing/dev/entrances` を CSS1489/DPR2.58 で開く。マップ選択 → 全区画マーカー表示 → ドラッグで移動(色がハニーに)→「JSON書き出し」でクリップボード/画面にJSON。**ミストで一通り補正 → 出力JSON を私(実装者)に渡す → `wardEntrances.generated.json` へ反映(別コミット)→ ツアーで経路終点が入口に来るか確認**。

- [ ] **Step 4: コミット**

```bash
rtk git add src/App.tsx
rtk git commit -m "feat(housing): 入口オーサリングを開発専用ルートに配線(本番非露出)"
```

---

## Self-Review(この plan)

- **spec coverage**: 入口データ=Task1 / getPlotEntrance=Task1 / computePlotDoor=Task2 / 経路配線(入口→幾何→箱中心)=Task3 / 変換・書き出し純関数=Task4 / オーサリングページ(マーカー/ドラッグ/色分け/書き出し/実SVG流用)=Task5 / DEV-only ルート=Task6。段階運用(データ空→ツール→ミスト採取→横展開)は Task 順 + Task6 Step3 に対応。spec 全節にタスクあり。
- **placeholder scan**: Task6 Step3(ユーザーがミストで採取→JSON反映)は spec の段階運用に一致する意図的な手動ゲート。純粋な穴埋め placeholder なし。
- **type consistency**: `getPlotEntrance(area,plot,buildingType,apartmentBuilding)` / `computePlotDoor(json,plot,kind)` / `EntranceOverrides` / `buildEntranceExport(existing,mapKey,overrides)` / `pxToNorm`/`normToPx` は Task 間で名称・型一致。mapKey は resolveWardMapRef 値(全10)で統一。入口JSON キー=plot文字列|'apart'。
- **依存順**: Task1(データ+引き)→2(幾何切り出し)→3(1・2 を配線)→4(変換純関数)→5(2・4・既存hook で UI)→6(5 をルート)。Task3 は Task1/2 に依存 = 順序で担保。Task5 は Task2/4 に依存。

## 次フェーズ予告

本 plan 完了(データ空=回帰なし + ツール完成)→ ユーザーがミストで入口採取→JSON反映→実機で経路確認→他マップ横展開。以降 Phase 2(改善4・6撤去 + 改善5・7 パン&ズーム)へ。
