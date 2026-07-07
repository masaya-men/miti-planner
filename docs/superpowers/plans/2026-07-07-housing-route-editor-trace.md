# 本番風・なぞって直す経路エディタ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DEV ページ `/housing/dev/routes` を、本番ツアーの見た目そのままで経路をなぞって直すエディタに作り替え、全 ~310 住所を高速に流して変な家だけ修正・一括保存できるようにする。

**Architecture:** 表示は本番 `buildTourMapPlacements` を読み取り再利用（本番と 1px 一致・本番コンポーネント無改変＝安全）。編集は既存オーバーレイ SVG 上にドラッグでなぞる操作を薄く載せる。なぞり線は Douglas–Peucker で間引く。

**Tech Stack:** React 18 + TypeScript, Vite, SVG overlay, Vitest, Playwright（実機検証）。

## Global Constraints

- 本番コンポーネント（`TourNavMap` / `TourNavPage`）と reroute アルゴリズム（`verbalRoute`）は**無改変**。読み取り再利用のみ。
- 対象ファイルは `src/components/housing/**` 配下＝**ハウジング独自トンマナ**（白黒のみ/Inter 禁止 等は非適用）。ただしこれは DEV ツールなので色は既存デバッグ色＋本番トークン流用で可。
- push 前に `npm run build`（`tsc -b` 厳密・未使用変数で落ちる）+ 全 `vitest run` を緑にする（memory `feedback_vercel_tsc_strict`）。
- 座標は 0..1 正規化で保持。px 変換は `w = json.viewBox.w` / `h = json.viewBox.h`。
- 保存先は `/__save-routes`（`vite.config.ts` の `routeSaverPlugin`）→ `src/data/housing/wardRouteOverrides.generated.json`。dev 再起動は plugin 変更時のみ必要（今回 plugin は不変＝再起動不要、HMR で反映）。

---

### Task 1: `simplifyPolyline`（なぞり線の間引き・純関数）

**Files:**
- Modify: `src/lib/housing/routePaths.ts`（末尾に追加）
- Test: `src/lib/housing/__tests__/routePaths.test.ts`（ケース追加）

**Interfaces:**
- Produces: `export function simplifyPolyline(pts: Pt[], epsilon: number): Pt[]` — 折れ線 `pts` を許容誤差 `epsilon`（正規化座標）で間引く。端点は必ず保持。`Pt = [number, number]`（既存 export）。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/routePaths.test.ts` の既存 import 行に `simplifyPolyline` を足し（`import { ..., simplifyPolyline } from '../routePaths';`）、末尾に追記:

```ts
describe('simplifyPolyline', () => {
  it('2点以下はそのまま返す', () => {
    expect(simplifyPolyline([[0, 0]], 0.01)).toEqual([[0, 0]]);
    expect(simplifyPolyline([[0, 0], [1, 1]], 0.01)).toEqual([[0, 0], [1, 1]]);
  });

  it('ほぼ直線上の点は端点2つに畳む', () => {
    const line: [number, number][] = [[0, 0], [0.25, 0.001], [0.5, 0], [0.75, 0.001], [1, 0]];
    expect(simplifyPolyline(line, 0.01)).toEqual([[0, 0], [1, 0]]);
  });

  it('明確な頂点は保持する（L字）', () => {
    const bend: [number, number][] = [[0, 0], [0.5, 0], [0.5, 0.5]];
    const out = simplifyPolyline(bend, 0.01);
    expect(out).toContainEqual([0.5, 0]);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([0.5, 0.5]);
  });

  it('端点は常に残る', () => {
    const many: [number, number][] = Array.from({ length: 20 }, (_, i) => [i / 19, Math.sin(i) * 0.0005] as [number, number]);
    const out = simplifyPolyline(many, 0.01);
    expect(out[0]).toEqual(many[0]);
    expect(out[out.length - 1]).toEqual(many[many.length - 1]);
    expect(out.length).toBeLessThan(many.length);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/housing/__tests__/routePaths.test.ts`
Expected: FAIL（`simplifyPolyline is not a function` / not exported）

- [ ] **Step 3: 最小実装**

`src/lib/housing/routePaths.ts` の末尾に追加:

```ts
/** 線分 a→b への点 p の垂直距離。 */
function perpDist([px, py]: Pt, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const tRaw = ((px - ax) * dx + (py - ay) * dy) / len2;
  const tt = Math.max(0, Math.min(1, tRaw));
  const cx = ax + tt * dx, cy = ay + tt * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Ramer–Douglas–Peucker: 折れ線 pts を許容誤差 epsilon(正規化座標)で間引く純関数。
 * 端点は必ず保持。なぞり(ドラッグ)で増えた過剰な点を少数の折れ線に畳むのに使う。
 */
export function simplifyPolyline(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length <= 2) return pts.slice();
  let maxDist = 0;
  let idx = 0;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], ax, ay, bx, by);
    if (d > maxDist) { maxDist = d; idx = i; }
  }
  if (maxDist > epsilon) {
    const left = simplifyPolyline(pts.slice(0, idx + 1), epsilon);
    const right = simplifyPolyline(pts.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/housing/__tests__/routePaths.test.ts`
Expected: PASS（既存ケース + 新規4ケース）

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/routePaths.ts src/lib/housing/__tests__/routePaths.test.ts
rtk git commit -m "feat(housing): なぞり線の間引き simplifyPolyline(Douglas-Peucker)"
```

---

### Task 2: `RouteAuthoringPage` を本番風・なぞって直すエディタに作り替え

**Files:**
- Modify（全面差し替え）: `src/components/housing/dev/RouteAuthoringPage.tsx`

**Interfaces:**
- Consumes: `simplifyPolyline`（Task 1）/ `buildTourMapPlacements(json, mapKey, ref, currentListing, steps, currentIndex)`（既存・`TourMapModel { routePath, routeJumpPath, origin:{x,y}(px), targetElId, placed:[{index,x,y,status}] }` を返す）/ `TourStep = { id, listing }`（`tourNav.ts`）/ 既存 `routeToPaths` `pointsToSegments` `segmentsToPoints` `migrateLegacyOverride` `nearestPointOnPolylines`。
- Produces: なし（末端 UI・DEV gate）。

**設計メモ（この Task の要点）:**
- 表示経路 = 編集点列が非空ならそれ、空なら `mapModel` の経路。どちらも本番の金線クラスで描画＝常に「金色に光る1本の経路」。
- 初期点列 = **override がある家だけ**展開（つまみ調整可）。override 無い家は空（＝自動経路を金線表示、正しければ触らず次へ）。
- なぞる = pointerdown→move(サンプル間引き＋道スナップ)→up(ストロークを `simplifyPolyline`)。ストロークの kind は現モード。
- 未保存カウンタ = `dirty` Set（編集した家の key 数）。保存成功で 0。

- [ ] **Step 1: ファイルを全面差し替え**

`src/components/housing/dev/RouteAuthoringPage.tsx` を以下で置き換え:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { WARD_MAP_LOADERS } from '../../../data/housing/wardMapManifest';
import { useWardMapAsset } from '../../../lib/housing/useWardMapAsset';
import { PREVIEW_MAPS, buildAllAddressListings } from '../../../lib/housing/devTourPreview';
import { resolveWardMapRef } from '../../../lib/housing/resolveWardMapRef';
import { getPlotEntrance } from '../../../lib/housing/plotEntrance';
import { computePlotDoor } from '../../../lib/housing/plotDoor';
import { nearestPointOnPolylines, type PolylineEdge } from '../../../lib/housing/mapGeometry';
import { buildTourMapPlacements } from '../../../lib/housing/buildTourMapPlacements';
import type { TourStep } from '../../../lib/housing/tourNav';
import { routeToPaths, pointsToSegments, segmentsToPoints, migrateLegacyOverride, simplifyPolyline, type RoutePoint, type RouteSegment } from '../../../lib/housing/routePaths';
import existingRoutesRaw from '../../../data/housing/wardRouteOverrides.generated.json';

type Pt = [number, number];
type RawEntry = { road?: Pt[]; jump?: Pt[] | null; segments?: RouteSegment[] };
const EXISTING = existingRoutesRaw as unknown as Record<string, Record<string, RawEntry>>;
const SNAP_PX = 22;
const MIN_SAMPLE_DIST = 0.008; // なぞり中、この距離(正規化)未満の点は捨てる
const SIMPLIFY_EPS = 0.004;    // ストローク確定時の間引き許容誤差(正規化)

/**
 * DEV専用: 本番風・なぞって直す経路エディタ(/housing/dev/routes)。
 * 表示は本番 buildTourMapPlacements を読み取り再利用(本番と1px一致・本番無改変=安全)。
 * 道の上をドラッグでなぞって経路(道/ジャンプ)を描き wardRouteOverrides.generated.json に一括保存。
 * 本番 build 非露出(App.tsx 側 import.meta.env.DEV gate)。
 */
export const RouteAuthoringPage: React.FC = () => {
  const [listings, setListings] = useState<MockListing[] | null>(null);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<'road' | 'jump'>('road');
  const [snap, setSnap] = useState(true);
  const [pointsByKey, setPointsByKey] = useState<Record<string, RoutePoint[]>>({});
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const strokeStartRef = useRef<number | null>(null);
  const lastSampleRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(PREVIEW_MAPS.map((m) => WARD_MAP_LOADERS[m.mapKey]().then(({ json }) => ({ area: m.area, isSub: m.isSub, json }))))
      .then((loaded) => { if (!cancelled) setListings(buildAllAddressListings(loaded)); });
    return () => { cancelled = true; };
  }, []);

  const current = listings?.[index] ?? null;
  const ref = useMemo(
    () => (current ? resolveWardMapRef(current.area, current.plot ?? null, current.apartmentBuilding ?? null, current.buildingType) : null),
    [current],
  );
  const mapKey = ref?.mapKey ?? PREVIEW_MAPS[0].mapKey;
  const asset = useWardMapAsset(mapKey);
  const json = asset.status === 'ready' ? asset.json : null;
  const w = json?.viewBox.w ?? 0, h = json?.viewBox.h ?? 0;
  const plotKey = ref ? (ref.highlightKind === 'apart' ? 'apart' : String(ref.highlightPlot)) : '';
  const key = `${mapKey}|${plotKey}`;

  // 全住所を仮ツアー steps に (本番と同じ配置文脈で番号ノードも出す)。
  const steps = useMemo<TourStep[]>(() => (listings ?? []).map((l) => ({ id: l.id, listing: l })), [listings]);

  // 本番と同一の地図モデル(経路/起点/箱ハイライト/番号ノード)。純関数・読むだけ=安全。
  const mapModel = useMemo(
    () => (json && ref ? buildTourMapPlacements(json, mapKey, ref, current, steps, index) : null),
    [json, ref, mapKey, current, steps, index],
  );

  // 入口(0..1): 収録入口 → 箱縁幾何 → なし。なぞり終点の目印(赤丸)。
  const door = useMemo(() => {
    if (!current || !json || !ref) return null;
    const ent = getPlotEntrance(current.area, current.plot, current.buildingType, current.apartmentBuilding);
    if (ent) return { x: ent[0], y: ent[1] };
    const gd = computePlotDoor(json, ref.highlightPlot, ref.highlightKind);
    if (gd) return { x: gd.x / w, y: gd.y / h };
    return null;
  }, [current, json, ref, w, h]);

  // 初期点列: override がある家だけ展開。無ければ空(自動経路は表示レイヤーが金線で見せる)。
  const initialPoints = useMemo((): RoutePoint[] => {
    const ex = EXISTING[mapKey]?.[plotKey];
    return ex ? segmentsToPoints(migrateLegacyOverride(ex)) : [];
  }, [mapKey, plotKey]);

  const points = pointsByKey[key] ?? initialPoints;
  const edgesPx = useMemo((): PolylineEdge[] => (json ? json.edges.map((e) => ({ a: e.a, b: e.b, polyline: e.polyline.map(([x, y]) => [x * w, y * h] as Pt) })) : []), [json, w, h]);

  const markDirty = () => setDirty((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  const setPointsFn = (fn: (prev: RoutePoint[]) => RoutePoint[]) => {
    setPointsByKey((prevAll) => ({ ...prevAll, [key]: fn(prevAll[key] ?? initialPoints) }));
    markDirty();
  };

  // 目的地の箱ハイライト(本番 TourNavMap と同じ付け外し)。
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelectorAll('.housing-tour-target-box').forEach((el) => el.classList.remove('housing-tour-target-box'));
    const id = mapModel?.targetElId;
    if (!id) return;
    const el = host.querySelector(`[id="${id}"]`);
    if (el) el.classList.add('housing-tour-target-box');
  }, [asset.status, mapModel?.targetElId, index]);

  function clientToNorm(clientX: number, clientY: number): [number, number] | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
    const tp = p.matrixTransform(ctm.inverse());
    let nx = tp.x / w, ny = tp.y / h;
    if (snap) { const near = nearestPointOnPolylines(tp.x, tp.y, edgesPx); if (near && near.dist < SNAP_PX) { nx = near.x / w; ny = near.y / h; } }
    return [nx, ny];
  }

  function onStageDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragIdx !== null) return;
    const n = clientToNorm(e.clientX, e.clientY);
    if (!n) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    strokeStartRef.current = points.length;
    lastSampleRef.current = n;
    setPointsFn((prev) => [...prev, { x: n[0], y: n[1], kind: mode }]);
  }
  function onStageMove(e: ReactPointerEvent<SVGSVGElement>) {
    const n = clientToNorm(e.clientX, e.clientY);
    if (!n) return;
    if (dragIdx !== null) {
      setPointsFn((prev) => { const next = prev.slice(); next[dragIdx] = { ...next[dragIdx], x: n[0], y: n[1] }; return next; });
      return;
    }
    if (strokeStartRef.current === null) return;
    const last = lastSampleRef.current;
    if (last && Math.hypot(n[0] - last[0], n[1] - last[1]) < MIN_SAMPLE_DIST) return;
    lastSampleRef.current = n;
    setPointsFn((prev) => [...prev, { x: n[0], y: n[1], kind: mode }]);
  }
  function endStroke() {
    setDragIdx(null);
    const start = strokeStartRef.current;
    strokeStartRef.current = null;
    lastSampleRef.current = null;
    if (start === null) return;
    setPointsFn((prev) => {
      const stroke = prev.slice(start);
      if (stroke.length <= 2) return prev;
      const kind = stroke[0].kind;
      const simplified = simplifyPolyline(stroke.map((p) => [p.x, p.y] as Pt), SIMPLIFY_EPS).map(([x, y]) => ({ x, y, kind }));
      return [...prev.slice(0, start), ...simplified];
    });
  }

  // 編集点列があればそれを、無ければ本番モデルの経路を金線で描く(どちらも同じ見た目)。
  const editPaths = useMemo(() => routeToPaths(pointsToSegments(points), w, h), [points, w, h]);
  const displayRoad = points.length ? editPaths.routePath : mapModel?.routePath ?? null;
  const displayJump = points.length ? editPaths.routeJumpPath : mapModel?.routeJumpPath ?? null;

  const goto = (i: number) => setIndex(Math.max(0, Math.min((listings?.length ?? 1) - 1, i)));
  const resetHouse = () => { setPointsByKey((prev) => { const n = { ...prev }; delete n[key]; return n; }); markDirty(); };

  function buildExport(): Record<string, Record<string, { segments: RouteSegment[] }>> {
    const out: Record<string, Record<string, { segments: RouteSegment[] }>> = {};
    for (const [mk, plots] of Object.entries(EXISTING)) { out[mk] = {}; for (const [pk, v] of Object.entries(plots)) out[mk][pk] = { segments: migrateLegacyOverride(v) }; }
    for (const [k, pts] of Object.entries(pointsByKey)) {
      const [mk, pk] = k.split('|');
      const segs = pointsToSegments(pts);
      if (!out[mk]) out[mk] = {};
      if (segs.length) out[mk][pk] = { segments: segs }; else delete out[mk][pk];
    }
    return out;
  }
  async function save() {
    setSaveMsg('保存中…');
    try {
      const res = await fetch('/__save-routes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildExport(), null, 2) });
      const j = (await res.json()) as { ok: boolean; maps?: number; error?: string };
      if (j.ok) { setDirty(new Set()); setSaveMsg(`保存しました ✓ (${j.maps} マップ)`); }
      else setSaveMsg(`保存失敗: ${j.error}`);
    } catch (e) { setSaveMsg(`保存失敗: ${String(e)}`); }
  }

  if (!listings) return <div className="housing-workspace" data-theme="dark" style={{ padding: 16 }}>全住所を読み込み中…</div>;
  const total = listings.length;
  const isOverridden = !!EXISTING[mapKey]?.[plotKey] || (pointsByKey[key]?.length ?? 0) > 0;

  return (
    <div className="housing-workspace housing-workspace-flow" data-theme="dark" style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingBottom: 10 }}>
        <span>{index + 1} / {total}</span>
        <strong>{current?.title ?? '-'}</strong>
        <span style={{ opacity: 0.7 }}>{isOverridden ? '上書き済み' : '自動経路'}</span>
        <button type="button" onClick={() => goto(index - 1)} disabled={index === 0}>前へ</button>
        <button type="button" onClick={() => goto(index + 1)} disabled={index >= total - 1}>次へ</button>
        <select value={index} onChange={(e) => goto(Number(e.target.value))} aria-label="住所ジャンプ">
          {listings.map((l, i) => (<option key={l.id} value={i}>{l.title}</option>))}
        </select>
        <span style={{ marginLeft: 8 }}>モード:</span>
        <button type="button" onClick={() => setMode('road')} style={{ fontWeight: mode === 'road' ? 700 : 400 }}>道</button>
        <button type="button" onClick={() => setMode('jump')} style={{ fontWeight: mode === 'jump' ? 700 : 400 }}>ジャンプ</button>
        <label><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> 道スナップ</label>
        <button type="button" onClick={resetHouse}>この家を描き直す</button>
        <button type="button" onClick={save}>保存(全部まとめて)</button>
        <span style={{ opacity: 0.85 }}>{dirty.size > 0 ? `${dirty.size}件 未保存` : '保存済み'}</span>
        {saveMsg && <span style={{ opacity: 0.85 }}>{saveMsg}</span>}
      </div>
      {asset.status === 'ready' && json && (
        <div style={{ position: 'relative', aspectRatio: `${w} / ${h}`, maxWidth: `calc(80vh * ${w} / ${h})` }}>
          <div ref={hostRef} className="housing-map-svg-host" dangerouslySetInnerHTML={{ __html: asset.svg }} />
          <svg
            ref={svgRef}
            className="housing-map-overlay"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair', touchAction: 'none' }}
            onPointerDown={onStageDown}
            onPointerMove={onStageMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
          >
            {displayRoad && (
              <>
                <path className="housing-tour-route-glow" d={displayRoad} fill="none" />
                <path data-testid="editor-route" className="housing-tour-route-core" d={displayRoad} fill="none">
                  <animate attributeName="stroke-dashoffset" from="0" to="-64" dur="1.1s" repeatCount="indefinite" />
                </path>
              </>
            )}
            {displayJump && <path className="housing-tour-route-jump" d={displayJump} fill="none" />}
            {mapModel?.origin && (
              <g className="housing-tour-map-origin-mark">
                <circle className="housing-tour-map-origin-pulse" cx={mapModel.origin.x} cy={mapModel.origin.y} r={14}>
                  <animate attributeName="r" from="14" to="30" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.9" to="0" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle className="housing-tour-map-origin-core" cx={mapModel.origin.x} cy={mapModel.origin.y} r={7} />
              </g>
            )}
            {door && <circle cx={door.x * w} cy={door.y * h} r={7} fill="none" stroke="#ff5a5a" strokeWidth={2.5} />}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x * w}
                cy={p.y * h}
                r={7}
                fill={p.kind === 'jump' ? '#ff5df0' : '#00e0ff'}
                stroke="#fff"
                strokeWidth={1.5}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); setDragIdx(i); }}
                onDoubleClick={(e) => { e.stopPropagation(); setPointsFn((prev) => prev.filter((_, idx) => idx !== i)); }}
              />
            ))}
          </svg>
          {mapModel?.placed.map((node) => (
            <div
              key={node.index}
              className={`housing-tour-map-node housing-tour-map-node--${node.status}`}
              style={{ left: `${((node.x / w) * 100).toFixed(3)}%`, top: `${((node.y / h) * 100).toFixed(3)}%`, pointerEvents: 'none' }}
            >
              {node.status === 'arrived' ? '✓' : node.index + 1}
            </div>
          ))}
        </div>
      )}
      <p style={{ opacity: 0.7, marginTop: 8, fontSize: 13 }}>
        道の上をドラッグでなぞる=経路(現モードの色)。つまみドラッグ=移動 / つまみダブルクリック=削除 / 「この家を描き直す」=白紙。
        金線=本番の経路。青丸=起点 / 赤丸=入口。道スナップONで道に吸着。ジャンプ区間だけ「ジャンプ」に切替。
      </p>
    </div>
  );
};
```

- [ ] **Step 2: tsc とユニットテストが緑（回帰確認）**

Run: `npx tsc -b`
Expected: エラーなし（未使用 import なし・型整合）

Run: `npx vitest run src/lib/housing/__tests__ src/components/housing/dev/__tests__`
Expected: PASS（`routePaths` / `devTourPreview` / `TourPreviewPage` 等の既存 + Task1 が緑）

- [ ] **Step 3: dev で実機検証（Playwright・見た目＋なぞり＋保存）**

前提: dev が `http://localhost:5173`（`npm run dev`）で稼働。plugin 不変なので再起動不要（コンポーネント変更は HMR 反映）。

検証スクリプトを scratchpad に作成（`pw-editor-verify.js`）:

```js
const { chromium } = require('playwright');
const BASE = 'http://localhost:5173/housing/dev/routes';
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1489, height: 820 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('svg.housing-map-overlay', { timeout: 15000 });

  // (1) override 家 = ミスト 13番地: 金線 + 箱ハイライト + つまみ が出る
  await page.selectOption('select[aria-label="住所ジャンプ"]', { label: 'ミスト 13番地' });
  await page.waitForTimeout(600);
  const route13 = await page.locator('[data-testid="editor-route"]').count();
  const box13 = await page.locator('.housing-map-svg-host svg .housing-tour-target-box').count();
  const handles13 = await page.locator('svg.housing-map-overlay circle[fill="#00e0ff"], svg.housing-map-overlay circle[fill="#ff5df0"]').count();
  console.log('ミスト13:', { route: route13, box: box13, handles: handles13 });

  // (2) 自動家 = ミスト 1番地: 金線は出る / override つまみは無い(0)
  await page.selectOption('select[aria-label="住所ジャンプ"]', { label: 'ミスト 1番地' });
  await page.waitForTimeout(600);
  const route1 = await page.locator('[data-testid="editor-route"]').count();
  const handles1 = await page.locator('svg.housing-map-overlay circle[fill="#00e0ff"], svg.housing-map-overlay circle[fill="#ff5df0"]').count();
  console.log('ミスト1(自動):', { route: route1, handles: handles1 });

  // (3) なぞる: ミスト拡張 43番地(=mist-sub 13) の地図上をドラッグ
  await page.selectOption('select[aria-label="住所ジャンプ"]', { label: 'ミスト拡張 43番地' });
  await page.waitForTimeout(600);
  await page.click('button:has-text("この家を描き直す")');
  const box = await page.locator('svg.housing-map-overlay').boundingBox();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.60);
  await page.mouse.down();
  for (let i = 0; i <= 10; i++) {
    await page.mouse.move(box.x + box.width * (0.45 + i * 0.012), box.y + box.height * (0.60 - i * 0.010));
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  const traced = await page.locator('svg.housing-map-overlay circle[fill="#00e0ff"]').count();
  console.log('なぞり後の点数(間引き済):', traced, '未保存:', await page.locator('text=未保存').first().textContent().catch(() => 'n/a'));

  await page.screenshot({ path: require('path').join(__dirname, 'editor-verify.png') });
  console.log('pageerrors:', errs);
  await browser.close();
})();
```

Run: `cd "C:\Users\masay\.claude\plugins\cache\playwright-skill\playwright-skill\4.1.0\skills\playwright-skill" && node run.js "<scratchpad>\pw-editor-verify.js"`

Expected（合格基準）:
- ミスト13: `route≥1, box=1, handles≥2`（override が金線＋箱＋つまみで出る）
- ミスト1(自動): `route≥1, handles=0`（自動経路が金線で出る・override つまみ無し）
- なぞり後: `traced` が 3〜15 程度（間引きが効いて過剰でない・かつ 2 超）/ 「◯件 未保存」表示
- `pageerrors: []`
- スクショが本番ツアーの見た目（金線/脈打つ起点/箱ハイライト）と一致

不合格なら superpowers:systematic-debugging へ（合成再現の"正常"で判断しない・実機 computed/DOM を取る）。

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/housing/dev/RouteAuthoringPage.tsx
rtk git commit -m "feat(dev): 経路エディタを本番風・なぞって直す方式に(表示は buildTourMapPlacements 再利用/なぞり+間引き/未保存カウンタ)"
```

---

### Task 3: 全体ゲート（段階2 実機 + build + 全 vitest）

**Files:** なし（検証のみ）

- [ ] **Step 1: mist-sub 13 を本番風画面でなぞり直し → 保存（ユーザー主導の段階2ゲート）**

ユーザーが `http://localhost:5173/housing/dev/routes` で「ミスト拡張 43番地」をなぞって保存 → Claude が確認:

Run: `rtk git diff -- src/data/housing/wardRouteOverrides.generated.json`
Expected: `mist-sub` の `13` の `segments` が新しい点列に更新されている（旧暫定3点 `[[0.50096,0.66264],...]` から変化）。

- [ ] **Step 2: フルビルド + 全テスト（push 前必須）**

Run: `npm run build`
Expected: `tsc -b` + `vite build` 成功（未使用変数・型不足なし）

Run: `npx vitest run`
Expected: 全 PASS（既知の legacy 失敗5件=TopBar4+HousingWorkspace1 は撤去予定・非アクション。それ以外緑）

- [ ] **Step 3: 段階3 = 全310巡回（ユーザー主導）**

ユーザーが前へ/次へで流し、44 候補中心に変な家をなぞり直し→随時保存。完了後に build+vitest 再確認 → superpowers:finishing-a-development-branch でユーザー承認 → main。

## Self-Review

**1. Spec coverage:**
- 本番風表示 → Task 2（buildTourMapPlacements + 金線 CSS + 箱ハイライト + 番号ノード）✓
- 現在経路プリロードで飛ばせる → Task 2（override 展開 / 自動は金線表示）✓
- なぞる操作 → Task 2（onStageDown/Move/endStroke + スナップ + 間引き）✓
- 点間引き → Task 1（simplifyPolyline）✓
- 一括保存 + 未保存カウンタ → Task 2（save/dirty）✓
- 本番無改変 → 全 Task（TourNavMap/TourNavPage/verbalRoute 不変）✓
- build + 全 vitest → Task 3 ✓

**2. Placeholder scan:** TODO/TBD なし。全 Step に実コード・実コマンド・期待値あり。✓

**3. Type consistency:** `simplifyPolyline(pts: Pt[], epsilon)` は Task1 定義=Task2 使用一致。`RoutePoint {x,y,kind}` / `RouteSegment` / `TourStep {id,listing}` / `buildTourMapPlacements(...)→TourMapModel{routePath,routeJumpPath,origin,targetElId,placed}` は既存実装（`routePaths.ts` / `tourNav.ts` / `buildTourMapPlacements.ts`）と一致。`setPointsFn` は関数更新版で stale closure 回避。✓
