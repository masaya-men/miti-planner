# ツアー経路「道なり追従」実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** override(手描き経路)の road 区間の表示を、点と点の間を道グラフに沿って曲げて描く(保存データ不変・表示時追従)。

**Architecture:** 純関数 `followRoadSegments(segments, json)` を新設。隣り合う「道上2点」の間だけ、既存の安全な道追従 `buildSnappedRoutePoints` を使って道なり点列に展開する。本番表示([buildTourMapPlacements.ts](../../../src/lib/housing/buildTourMapPlacements.ts))とエディタのライブ表示([RouteAuthoringPage.tsx](../../../src/components/housing/dev/RouteAuthoringPage.tsx))の2箇所から呼ぶ。本番ツアーコンポーネントは無改変。

**Tech Stack:** TypeScript / React / Vite / Vitest。既存 `src/lib/housing/` の純関数群(mapGeometry / wardRoute / routePaths)。

## Global Constraints

- 言語: コード内コメント・ドキュメントは日本語(CLAUDE.md)。
- 保存形式(`wardRouteOverrides.generated.json` の `segments: {kind, points}`)は変更しない。追従は表示時のみ。
- reroute アルゴリズム(`shouldReroute`/`directionalWalk`)・本番ツアーコンポーネント(`TourNavMap`/`TourNavPage`)は一切触らない。
- jump 区間・経路の出だし(エーテライト側)/終わり(ドア側)は追従対象外(直線のまま)。
- push 前は `npm run build`(tsc -b + vite build)+ `npm run test`(vitest run 全緑)必須(memory `feedback_vercel_tsc_strict`)。未使用 import/変数を残さない(tsc -b が厳密)。
- 設計根拠: [docs/superpowers/specs/2026-07-07-housing-route-road-follow-design.md](../specs/2026-07-07-housing-route-road-follow-design.md)。

---

### Task 1: 純関数 `followRoadSegments` + 単体テスト

**Files:**
- Create: `src/lib/housing/followRoad.ts`
- Test: `src/lib/housing/__tests__/followRoad.test.ts`

**Interfaces:**
- Consumes:
  - `buildSnappedRoutePoints(json: WardMapJson, startPt: {x:number;y:number}, endPt: {x:number;y:number}): [number,number][] | null` from `../wardRoute`(任意2点を道に投影し道グラフを辿る px 点列。到達不能/edges空で null)。
  - `nearestPointOnPolylines(px:number, py:number, edges: PolylineEdge[]): {x:number;y:number;edgeIndex:number;segIndex:number;t:number;dist:number} | null` と `type PolylineEdge` from `../mapGeometry`。
  - `type Pt = [number,number]`, `type RouteSegment = { kind:'road'|'jump'; points: Pt[] }` from `../routePaths`。
  - `type WardMapJson` from `../../data/housing/wardMapManifest`(使うのは `viewBox.{w,h}` / `edges` / `nodes`)。
- Produces:
  - `followRoadSegments(segments: RouteSegment[], json: WardMapJson): RouteSegment[]`(road 区間を道なりに展開・jump 素通し。0..1 正規化座標 in/out)。Task 2・Task 3 が呼ぶ。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/followRoad.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { followRoadSegments } from '../followRoad';
import type { RouteSegment } from '../routePaths';

// 山形カーブの道: e0 n1-n2 は途中(0.3,0.3)へ跳ねる曲線 / e1 n2-n3 は直線。viewBox 100x100。
const CURVE: WardMapJson = {
  area: 'Test',
  viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'n1', x: 0.1, y: 0.5 },
    { id: 'n2', x: 0.5, y: 0.5 },
    { id: 'n3', x: 0.9, y: 0.5 },
  ],
  edges: [
    { a: 'n1', b: 'n2', polyline: [[0.1, 0.5], [0.3, 0.3], [0.5, 0.5]] },
    { a: 'n2', b: 'n3', polyline: [[0.5, 0.5], [0.9, 0.5]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
} as unknown as WardMapJson;

// П字の道(左が開いている): 上 e0 / 右 e1 / 下 e2。左端の2点は直線は近いが道は大回り。
const U: WardMapJson = {
  area: 'Test', viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'm1', x: 0.1, y: 0.1 }, { id: 'm2', x: 0.9, y: 0.1 },
    { id: 'm3', x: 0.9, y: 0.9 }, { id: 'm4', x: 0.1, y: 0.9 },
  ],
  edges: [
    { a: 'm1', b: 'm2', polyline: [[0.1, 0.1], [0.9, 0.1]] },
    { a: 'm2', b: 'm3', polyline: [[0.9, 0.1], [0.9, 0.9]] },
    { a: 'm3', b: 'm4', polyline: [[0.9, 0.9], [0.1, 0.9]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
} as unknown as WardMapJson;

// 連結の無い2本の道(到達不能テスト用)。
const SPLIT: WardMapJson = {
  area: 'Test', viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'a1', x: 0.1, y: 0.1 }, { id: 'a2', x: 0.3, y: 0.1 },
    { id: 'b1', x: 0.7, y: 0.9 }, { id: 'b2', x: 0.9, y: 0.9 },
  ],
  edges: [
    { a: 'a1', b: 'a2', polyline: [[0.1, 0.1], [0.3, 0.1]] },
    { a: 'b1', b: 'b2', polyline: [[0.7, 0.9], [0.9, 0.9]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
} as unknown as WardMapJson;

const road = (points: [number, number][]): RouteSegment => ({ kind: 'road', points });
const minY = (pts: [number, number][]) => Math.min(...pts.map((p) => p[1]));

describe('followRoadSegments', () => {
  it('同一 edge 上の2点は そのカーブ頂点を含む点列に展開する', () => {
    const out = followRoadSegments([road([[0.15, 0.5], [0.45, 0.5]])], CURVE);
    const pts = out[0].points;
    expect(pts.length).toBeGreaterThan(2);       // 直線(2点)から増える
    expect(minY(pts)).toBeLessThan(0.4);         // 跳ね(0.3付近)を通る
  });

  it('別 edge をまたぐ2点も 分岐点とカーブを辿って展開する', () => {
    const out = followRoadSegments([road([[0.15, 0.5], [0.85, 0.5]])], CURVE);
    const pts = out[0].points;
    expect(pts.length).toBeGreaterThan(2);
    expect(minY(pts)).toBeLessThan(0.4);         // e0 の跳ねを通る
    expect(pts.some((p) => Math.abs(p[0] - 0.5) < 0.02 && Math.abs(p[1] - 0.5) < 0.02)).toBe(true); // 分岐点 n2 を通る
  });

  it('片端が道の外(出だし/終わり相当)なら 直線のまま', () => {
    const out = followRoadSegments([road([[0.5, 0.9], [0.85, 0.5]])], CURVE); // (0.5,0.9)は道から遠い
    expect(out[0].points.length).toBe(2);
    expect(out[0].points[0]).toEqual([0.5, 0.9]);   // 道外端は原位置維持
  });

  it('道なりが直線の MAX_RATIO 倍を超える大回りは 直線に戻す(暴走ガード)', () => {
    const out = followRoadSegments([road([[0.15, 0.1], [0.15, 0.9]])], U); // 直線80px vs 道230px
    expect(out[0].points.length).toBe(2);
  });

  it('到達不能(連結の無い道)なら 直線に戻す', () => {
    const out = followRoadSegments([road([[0.2, 0.1], [0.8, 0.9]])], SPLIT);
    expect(out[0].points.length).toBe(2);
  });

  it('jump 区間は素通し(不変)', () => {
    const jump: RouteSegment = { kind: 'jump', points: [[0.1, 0.1], [0.5, 0.5]] };
    const out = followRoadSegments([jump], CURVE);
    expect(out[0]).toEqual(jump);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/housing/__tests__/followRoad.test.ts`
Expected: FAIL(`followRoad.ts` が無い → import 解決不能)

- [ ] **Step 3: `followRoadSegments` を実装**

`src/lib/housing/followRoad.ts`:

```ts
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import { nearestPointOnPolylines, type PolylineEdge } from './mapGeometry';
import { buildSnappedRoutePoints } from './wardRoute';
import type { Pt, RouteSegment } from './routePaths';

/** 点をこの px 未満で道に投影できるとき「道の上」とみなす(出だし/終わりの道外連結はこれを超えるので直線を保つ)。 */
const ONROAD_PX = 12;
/** 道なりの全長が直線距離のこの倍を超えたら遠回り誤選択とみなし直線に戻す(暴走ガード)。 */
const MAX_RATIO = 2.5;

function lengthPx(pts: Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return d;
}

/**
 * override の road 区間を「道グラフに沿って曲げた」密な点列に展開する純関数(表示専用・保存しない)。
 * 隣接する道上2点の間だけ buildSnappedRoutePoints で道追従。片端が道外/到達不能/遠回りは直線のまま。
 * jump 区間は素通し。0..1 正規化座標 in / out。
 */
export function followRoadSegments(segments: RouteSegment[], json: WardMapJson): RouteSegment[] {
  const w = json.viewBox.w, h = json.viewBox.h;
  const edgesPx: PolylineEdge[] = json.edges.map((e) => ({ a: e.a, b: e.b, polyline: e.polyline.map(([x, y]) => [x * w, y * h] as Pt) }));
  const project = (p: Pt): Pt | null => {
    const n = nearestPointOnPolylines(p[0] * w, p[1] * h, edgesPx);
    return n && n.dist < ONROAD_PX ? ([n.x / w, n.y / h] as Pt) : null;
  };

  return segments.map((s) => {
    if (s.kind !== 'road' || s.points.length < 2) return s;
    // 各点: 道の上なら投影位置に寄せる(境界一致のため確定) / 道外なら原位置維持(出だし・終わりを保つ)。
    const proj = s.points.map(project);
    const anchored: Pt[] = s.points.map((p, i) => proj[i] ?? p);
    const onRoad = proj.map((p) => p !== null);
    const out: Pt[] = [];
    const push = (p: Pt) => { const last = out[out.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p); };

    for (let i = 0; i + 1 < anchored.length; i++) {
      const a = anchored[i], b = anchored[i + 1];
      let seg: Pt[] = [a, b];
      if (onRoad[i] && onRoad[i + 1]) {
        const aPx = { x: a[0] * w, y: a[1] * h }, bPx = { x: b[0] * w, y: b[1] * h };
        const routed = buildSnappedRoutePoints(json, aPx, bPx);
        if (routed && routed.length >= 2) {
          const straight = Math.hypot(bPx.x - aPx.x, bPx.y - aPx.y);
          if (lengthPx(routed) <= straight * MAX_RATIO) seg = routed.map(([x, y]) => [x / w, y / h] as Pt);
        }
      }
      for (const p of seg) push(p);
    }
    return { kind: 'road', points: out };
  });
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/housing/__tests__/followRoad.test.ts`
Expected: PASS(6 件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/housing/followRoad.ts src/lib/housing/__tests__/followRoad.test.ts
git commit -m "feat(housing): 道なり追従の純関数 followRoadSegments + 単体テスト"
```

---

### Task 2: 本番表示(`buildTourMapPlacements`)に配線 + 統合テスト

**Files:**
- Modify: `src/lib/housing/buildTourMapPlacements.ts`(13 行目付近の import、88-93 行の override 分岐)
- Test: `src/lib/housing/__tests__/buildTourMapPlacements.test.ts`(末尾に 1 ケース追加)

**Interfaces:**
- Consumes: `followRoadSegments(segments, json)` from Task 1。
- Produces: なし(既存 `buildTourMapPlacements` の返り値 `routePath` が追従済みになるだけ。シグネチャ不変)。

- [ ] **Step 1: 失敗するテストを追加**

`src/lib/housing/__tests__/buildTourMapPlacements.test.ts` の import 群に追加:

```ts
import lavenderWardRaw from '../../../data/housing/lavenderWard.generated.json';
```

`buildTourMapPlacements` の `describe` 内(既存 `it` 群の後)に追加:

```ts
  it('override の road 区間は道なりに追従して展開される(生の点数より増える)', () => {
    // lavender plot 26 は override 済み(road 1区間・9点)で別 edge をまたぐカーブを含む(実データ)。
    const lavenderWard = lavenderWardRaw as unknown as WardMapJson;
    const cur = L({ id: 'lv26', area: 'LavenderBeds', plot: 26 });
    const ref = resolveWardMapRef('LavenderBeds', 26, null, 'house')!;
    const m = buildTourMapPlacements(lavenderWard, ref.mapKey, ref, cur, [step(cur)], 0);
    const coords = [...(m.routePath ?? '').matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
    expect(coords.length).toBeGreaterThan(9); // 追従で中間のカーブ頂点が増える(生 road 点=9)
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts`
Expected: FAIL(追従未配線なので routePath は生の9点=`coords.length === 9`)

- [ ] **Step 3: `buildTourMapPlacements` に追従を配線**

`src/lib/housing/buildTourMapPlacements.ts` の import に追加(13 行目 `routePaths` import の次あたり):

```ts
import { followRoadSegments } from './followRoad';
```

override 分岐(現状 88-93 行)を次に変更:

```ts
    const segs = getRouteOverride(mapKey, plotKey);
    if (segs) {
      // 手動上書き(segments): road 区間を道なりに追従展開してから 実線=road/破線=jump(弧)へ。
      const paths = routeToPaths(followRoadSegments(segs, json), w, h);
      routePath = paths.routePath;
      routeJumpPath = paths.routeJumpPath;
    } else {
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts`
Expected: PASS(既存 + 新規)

- [ ] **Step 5: コミット**

```bash
git add src/lib/housing/buildTourMapPlacements.ts src/lib/housing/__tests__/buildTourMapPlacements.test.ts
git commit -m "feat(housing): override 表示に道なり追従を配線(本番/tour-preview 共通)"
```

---

### Task 3: エディタのライブ表示(`RouteAuthoringPage`)に配線

**Files:**
- Modify: `src/components/housing/dev/RouteAuthoringPage.tsx`(13 行目の import 追加、138 行の `editPaths`)

**Interfaces:**
- Consumes: `followRoadSegments(segments, json)` from Task 1。
- Produces: なし(DEV 専用画面。クリック配置中の金線が道なりに出るようになる)。

> DEV 専用コンポーネント(自動テスト無し)。検証は tsc + 実機目視(Task 4)。

- [ ] **Step 1: import を追加**

`src/components/housing/dev/RouteAuthoringPage.tsx` の 13 行目 `routePaths` からの import に `followRoadSegments` を足す…ではなく別モジュールなので新規行を追加(13 行目の直後):

```ts
import { followRoadSegments } from '../../../lib/housing/followRoad';
```

- [ ] **Step 2: `editPaths` に追従を適用**

138 行目:

```ts
  const editPaths = useMemo(() => routeToPaths(pointsToSegments(points), w, h), [points, w, h]);
```

を次に変更(json 未ロード時は生のまま):

```ts
  const editPaths = useMemo(
    () => routeToPaths(json ? followRoadSegments(pointsToSegments(points), json) : pointsToSegments(points), w, h),
    [points, w, h, json],
  );
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc -b`
Expected: エラー無し(未使用 import 無し)

- [ ] **Step 4: コミット**

```bash
git add src/components/housing/dev/RouteAuthoringPage.tsx
git commit -m "feat(dev): 経路エディタのライブ金線に道なり追従を適用"
```

---

### Task 4: フル build + 全テスト緑 + 代表区画の実機 QA(機能ゲート)

**Files:** なし(検証のみ)

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: `tsc -b` + `tsc -p tsconfig.api.json` + `vite build` すべて成功(エラー0)

- [ ] **Step 2: 全テスト**

Run: `npm run test`
Expected: 全 vitest 緑(followRoad 6 + buildTourMapPlacements 追加分 含む)。出力をパイプしない(memory `reference_vitest_appcheck_teardown`)。

- [ ] **Step 3: dev で代表カーブを目視**

Run(バックグラウンド): `npm run dev` → `http://localhost:5173/housing/dev/routes`
確認(住所ジャンプで移動):
- ラベンダー 26 / ラベンダー拡張 22(= lavender-sub 22)/ エンピレアム 8〜10 を開く。
- 金線が赤い道のカーブに沿って曲がっていること(直線ショートカットが消えている)。
- 経路の出だし(起点エーテライト側)/終わり(ドア側)は従来通り直線であること。
- 適当な家で道の上に点を数個クリック → 金線がその場で道なりに出ること(暴走・変な遠回りが出たら点を足せば直る)。
- `ONROAD_PX`(初期12)/ `MAX_RATIO`(初期2.5)が体感で不適切なら `followRoad.ts` 定数を調整し Task 1 のテストを再確認 → 追いコミット。

- [ ] **Step 4: 機能完了の記録**

`docs/TODO.md` の「次の作業順」を更新(①道なり追従=完了、次=②最終ゲート)。`git add docs/TODO.md && git commit -m "docs: 道なり追従 実装完了→次=最終ゲート"`。

> **本計画のスコープ外(次の別タスク=最終ゲート)**: 全310実機確認 → `finishing-a-development-branch` → 未コミット16ファイルと合わせて整理 → ユーザー承認で main。push/merge はユーザー承認まで禁止。

---

## Self-Review

- **Spec coverage**: 事実3-A(カーブ突っ切り)= Task1 追従 + Task2/3 配線で解消 ✓ / 事実3-B(出だし・終わり道外)= 直線維持(Task1 off-road分岐 + テスト)✓ / 事実4(別edgeまたぎ27件)= buildSnappedRoutePoints のグラフ追従で対応(cross-edge テスト)✓ / 暴走ガード ✓ / jump 素通し ✓ / 到達不能 fallback ✓ / 保存形式不変(表示時のみ)✓ / 91件遡及(buildTourMapPlacements 経由=本番+エディタ非編集表示)✓ / エディタ編集中ライブ(Task3)✓ / 本番コンポーネント無改変 ✓。
- **Placeholder scan**: TBD/TODO 無し。全 Step に実コード/実コマンド/期待値あり。
- **Type consistency**: `followRoadSegments(segments: RouteSegment[], json: WardMapJson): RouteSegment[]` を Task1 で定義、Task2/3 で同名同シグネチャ使用 ✓。`buildSnappedRoutePoints` の px 座標 in/out、`nearestPointOnPolylines` の `.dist` 使用、`Pt=[number,number]` 一貫 ✓。
