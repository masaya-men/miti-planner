import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { WARD_MAP_LOADERS } from '../../../data/housing/wardMapManifest';
import { useWardMapAsset } from '../../../lib/housing/useWardMapAsset';
import { PREVIEW_MAPS, buildAllAddressListings } from '../../../lib/housing/devTourPreview';
import { resolveWardMapRef } from '../../../lib/housing/resolveWardMapRef';
import { getPlotOriginNode } from '../../../lib/housing/plotOrigin';
import { getApartmentOrigin } from '../../../lib/housing/apartmentOrigin';
import { getPlotEntrance } from '../../../lib/housing/plotEntrance';
import { computePlotDoor } from '../../../lib/housing/plotDoor';
import { nearestPointOnPolylines, type PolylineEdge } from '../../../lib/housing/mapGeometry';
import { routeToPaths, pointsToSegments, segmentsToPoints, migrateLegacyOverride, type RoutePoint, type RouteSegment } from '../../../lib/housing/routePaths';
import existingRoutesRaw from '../../../data/housing/wardRouteOverrides.generated.json';

type Pt = [number, number];
type RawEntry = { road?: Pt[]; jump?: Pt[] | null; segments?: RouteSegment[] };
const EXISTING = existingRoutesRaw as unknown as Record<string, Record<string, RawEntry>>;
const SNAP_PX = 22;

/**
 * DEV専用: 経路お絵かきツール(/housing/dev/routes)。
 * 実マップの道の上を点でなぞって経路(道/ジャンプ)を描き、wardRouteOverrides.generated.json に保存する。
 * 本番 build 非露出(App.tsx 側 import.meta.env.DEV gate)。地図参照データは読み取りのみ。
 */
export const RouteAuthoringPage: React.FC = () => {
  const [listings, setListings] = useState<MockListing[] | null>(null);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<'road' | 'jump'>('road');
  const [snap, setSnap] = useState(true);
  const [pointsByKey, setPointsByKey] = useState<Record<string, RoutePoint[]>>({});
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(PREVIEW_MAPS.map((m) => WARD_MAP_LOADERS[m.mapKey]().then(({ json }) => ({ area: m.area, isSub: m.isSub, json }))))
      .then((loaded) => { if (!cancelled) setListings(buildAllAddressListings(loaded)); });
    return () => { cancelled = true; };
  }, []);

  const current = listings?.[index] ?? null;
  const ref = current ? resolveWardMapRef(current.area, current.plot ?? null, current.apartmentBuilding ?? null, current.buildingType) : null;
  const mapKey = ref?.mapKey ?? PREVIEW_MAPS[0].mapKey;
  const asset = useWardMapAsset(mapKey);
  const json = asset.status === 'ready' ? asset.json : null;
  const w = json?.viewBox.w ?? 0, h = json?.viewBox.h ?? 0;
  const plotKey = ref ? (ref.highlightKind === 'apart' ? 'apart' : String(ref.highlightPlot)) : '';
  const key = `${mapKey}|${plotKey}`;

  // 起点(0..1): 家=最寄りエーテライトシャード / アパート=幾何解決。
  const origin = useMemo(() => {
    if (!current || !json) return null;
    const oi = current.buildingType === 'apartment' ? getApartmentOrigin(json, mapKey) : getPlotOriginNode(current.area, current.plot);
    return oi ? { x: oi.x, y: oi.y } : null;
  }, [current, json, mapKey]);

  // 入口(0..1): 収録入口 → 箱縁幾何 → なし。
  const door = useMemo(() => {
    if (!current || !json || !ref) return null;
    const ent = getPlotEntrance(current.area, current.plot, current.buildingType, current.apartmentBuilding);
    if (ent) return { x: ent[0], y: ent[1] };
    const gd = computePlotDoor(json, ref.highlightPlot, ref.highlightKind);
    if (gd) return { x: gd.x / w, y: gd.y / h };
    return null;
  }, [current, json, ref, w, h]);

  // 初期点列: 既存 override があれば展開、なければ 起点→入口 の 2 点(road)。
  const initialPoints = useMemo((): RoutePoint[] => {
    const ex = EXISTING[mapKey]?.[plotKey];
    if (ex) return segmentsToPoints(migrateLegacyOverride(ex));
    if (origin && door) return [{ x: origin.x, y: origin.y, kind: 'road' }, { x: door.x, y: door.y, kind: 'road' }];
    return [];
  }, [mapKey, plotKey, origin, door]);

  const points = pointsByKey[key] ?? initialPoints;
  const edgesPx = useMemo((): PolylineEdge[] => (json ? json.edges.map((e) => ({ a: e.a, b: e.b, polyline: e.polyline.map(([x, y]) => [x * w, y * h] as Pt) })) : []), [json, w, h]);

  const setPoints = (next: RoutePoint[]) => setPointsByKey((prev) => ({ ...prev, [key]: next }));

  function clientToNorm(clientX: number, clientY: number): [number, number] | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
    const t = p.matrixTransform(ctm.inverse());
    let nx = t.x / w, ny = t.y / h;
    if (snap) { const near = nearestPointOnPolylines(t.x, t.y, edgesPx); if (near && near.dist < SNAP_PX) { nx = near.x / w; ny = near.y / h; } }
    return [nx, ny];
  }

  function onStageDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragIdx !== null) return;
    const n = clientToNorm(e.clientX, e.clientY);
    if (n) setPoints([...points, { x: n[0], y: n[1], kind: mode }]);
  }
  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragIdx === null) return;
    const n = clientToNorm(e.clientX, e.clientY);
    if (!n) return;
    const next = points.slice(); next[dragIdx] = { ...next[dragIdx], x: n[0], y: n[1] }; setPoints(next);
  }

  const preview = useMemo(() => routeToPaths(pointsToSegments(points), w, h), [points, w, h]);
  const goto = (i: number) => setIndex(Math.max(0, Math.min((listings?.length ?? 1) - 1, i)));

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
      setSaveMsg(j.ok ? `保存しました ✓ (${j.maps} マップ) — Claude に「経路を保存した」と伝えてください` : `保存失敗: ${j.error}`);
    } catch (e) { setSaveMsg(`保存失敗: ${String(e)}`); }
  }

  if (!listings) return <div className="housing-workspace" data-theme="dark" style={{ padding: 16 }}>全住所を読み込み中…</div>;
  const total = listings.length;

  return (
    <div className="housing-workspace housing-workspace-flow" data-theme="dark" style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingBottom: 10 }}>
        <span>{index + 1} / {total}</span>
        <strong>{current?.title ?? '-'}</strong>
        <button type="button" onClick={() => goto(index - 1)} disabled={index === 0}>前へ</button>
        <button type="button" onClick={() => goto(index + 1)} disabled={index >= total - 1}>次へ</button>
        <select value={index} onChange={(e) => goto(Number(e.target.value))} aria-label="住所ジャンプ">
          {listings.map((l, i) => (<option key={l.id} value={i}>{l.title}</option>))}
        </select>
        <span style={{ marginLeft: 8 }}>モード:</span>
        <button type="button" onClick={() => setMode('road')} style={{ fontWeight: mode === 'road' ? 700 : 400 }}>道</button>
        <button type="button" onClick={() => setMode('jump')} style={{ fontWeight: mode === 'jump' ? 700 : 400 }}>ジャンプ</button>
        <label><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> 道スナップ</label>
        <button type="button" onClick={() => setPointsByKey((prev) => { const n = { ...prev }; delete n[key]; return n; })}>この区画をリセット</button>
        <button type="button" onClick={save}>保存(ファイルへ直接)</button>
        {saveMsg && <span style={{ opacity: 0.85 }}>{saveMsg}</span>}
      </div>
      {asset.status === 'ready' && json && (
        <div style={{ position: 'relative', aspectRatio: `${w} / ${h}`, maxWidth: `calc(80vh * ${w} / ${h})` }}>
          <div className="housing-map-svg-host" dangerouslySetInnerHTML={{ __html: asset.svg }} />
          <svg
            ref={svgRef}
            className="housing-map-overlay"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}
            onPointerDown={onStageDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => setDragIdx(null)}
            onPointerLeave={() => setDragIdx(null)}
          >
            {preview.routePath && <path d={preview.routePath} fill="none" stroke="#00e0ff" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />}
            {preview.routeJumpPath && <path d={preview.routeJumpPath} fill="none" stroke="#ff5df0" strokeWidth={4} strokeDasharray="10 8" strokeLinecap="round" />}
            {origin && <circle cx={origin.x * w} cy={origin.y * h} r={11} fill="none" stroke="#7fff5a" strokeWidth={3} />}
            {door && <circle cx={door.x * w} cy={door.y * h} r={11} fill="none" stroke="#ff5a5a" strokeWidth={3} />}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x * w}
                cy={p.y * h}
                r={8}
                fill={p.kind === 'jump' ? '#ff5df0' : '#00e0ff'}
                stroke="#fff"
                strokeWidth={1.5}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); setDragIdx(i); }}
                onDoubleClick={(e) => { e.stopPropagation(); setPoints(points.filter((_, idx) => idx !== i)); }}
              />
            ))}
          </svg>
        </div>
      )}
      <p style={{ opacity: 0.7, marginTop: 8, fontSize: 13 }}>
        クリックで点追加(現モードの色)/点ドラッグで移動/点ダブルクリックで削除。
        緑リング=起点エーテライト・赤リング=入口。青線=道・桃破線=ジャンプ(弧)。道スナップONで道に吸着。
      </p>
    </div>
  );
};
