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
import { computeTourProgress, type TourStep } from '../../../lib/housing/tourNav';
import { routeToPaths, pointsToSegments, segmentsToPoints, migrateLegacyOverride, type RoutePoint, type RouteSegment } from '../../../lib/housing/routePaths';
import { TourProgressPanel } from '../tour/TourProgressPanel';
import { TourNextDestinationPanel } from '../tour/TourNextDestinationPanel';
import existingRoutesRaw from '../../../data/housing/wardRouteOverrides.generated.json';

type Pt = [number, number];
type RawEntry = { road?: Pt[]; jump?: Pt[] | null; segments?: RouteSegment[] };
const EXISTING = existingRoutesRaw as unknown as Record<string, Record<string, RawEntry>>;
const SNAP_PX = 22;

/**
 * DEV専用: 本番風・クリックで点を置いて直す経路エディタ(/housing/dev/routes)。
 * 本番ツアーの3カラム(進捗/地図/住所・行き方カード)をそのまま再利用し、中央地図の上で
 * 経路をクリック配置で編集して wardRouteOverrides.generated.json に一括保存する。
 * 表示は本番 buildTourMapPlacements の読み取り再利用(本番と1px一致・本番無改変=安全)。
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

  // 全住所を仮ツアー steps に (本番パネル/番号ノードの配置文脈)。
  const steps = useMemo<TourStep[]>(() => (listings ?? []).map((l) => ({ id: l.id, listing: l })), [listings]);
  const progress = useMemo(() => computeTourProgress(steps, index), [steps, index]);
  const currentStep = steps[index] ?? null;

  // 本番と同一の地図モデル(経路/起点/箱ハイライト/番号ノード)。純関数・読むだけ=安全。
  const mapModel = useMemo(
    () => (json && ref ? buildTourMapPlacements(json, mapKey, ref, current, steps, index) : null),
    [json, ref, mapKey, current, steps, index],
  );

  // 入口(0..1): 収録入口 → 箱縁幾何 → なし。着地(ジャンプ終点)の目印(赤丸)。
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

  const edited = pointsByKey[key];               // undefined=未編集 / []=白紙化済み / 点列=編集中
  const points = edited ?? initialPoints;
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

  function clientToNorm(clientX: number, clientY: number, doSnap: boolean): [number, number] | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
    const tp = p.matrixTransform(ctm.inverse());
    let nx = tp.x / w, ny = tp.y / h;
    if (doSnap) { const near = nearestPointOnPolylines(tp.x, tp.y, edgesPx); if (near && near.dist < SNAP_PX) { nx = near.x / w; ny = near.y / h; } }
    return [nx, ny];
  }

  // クリックで点を置く(道モードのみ道スナップ。ジャンプは踏切/着地を自由に置く)。
  function onStageDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragIdx !== null) return;
    const n = clientToNorm(e.clientX, e.clientY, snap && mode === 'road');
    if (!n) return;
    setPointsFn((prev) => [...prev, { x: n[0], y: n[1], kind: mode }]);
  }
  function onStageMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragIdx === null) return;
    const kind = points[dragIdx]?.kind ?? 'road';
    const n = clientToNorm(e.clientX, e.clientY, snap && kind === 'road');
    if (!n) return;
    setPointsFn((prev) => { const next = prev.slice(); if (!next[dragIdx]) return prev; next[dragIdx] = { ...next[dragIdx], x: n[0], y: n[1] }; return next; });
  }
  const undo = () => setPointsFn((prev) => prev.slice(0, -1));
  const resetHouse = () => { setPointsByKey((prev) => ({ ...prev, [key]: [] })); markDirty(); }; // 真に白紙(空)にする

  // 表示: 編集点列があればそれ / 白紙化済み(edited===[])なら何も出さない / 未編集なら本番モデルの現在経路。
  const editPaths = useMemo(() => routeToPaths(pointsToSegments(points), w, h), [points, w, h]);
  const displayRoad = points.length ? editPaths.routePath : (edited !== undefined ? null : mapModel?.routePath ?? null);
  const displayJump = points.length ? editPaths.routeJumpPath : (edited !== undefined ? null : mapModel?.routeJumpPath ?? null);

  const total = listings?.length ?? 0;
  const goto = (i: number) => setIndex(Math.max(0, Math.min(total - 1, i)));

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

  if (!listings) {
    return (
      <div className="housing-dev-tourpreview">
        <div className="housing-dev-tourpreview-bar">全住所を読み込み中…</div>
      </div>
    );
  }
  const isOverridden = !!EXISTING[mapKey]?.[plotKey] || (pointsByKey[key]?.length ?? 0) > 0;

  return (
    <div className="housing-dev-tourpreview">
      <div className="housing-dev-tourpreview-bar">
        <span>{index + 1} / {total}</span>
        <strong>{current?.title ?? '-'}</strong>
        <span style={{ opacity: 0.7 }}>{isOverridden ? '上書き済み' : '自動経路'}</span>
        <button type="button" className="housing-dev-tourpreview-btn" onClick={() => goto(index - 1)} disabled={index === 0}>前へ</button>
        <button type="button" className="housing-dev-tourpreview-btn" onClick={() => goto(index + 1)} disabled={index >= total - 1}>次へ</button>
        <select className="housing-dev-tourpreview-btn" value={index} onChange={(e) => goto(Number(e.target.value))} aria-label="住所ジャンプ">
          {listings.map((l, i) => (<option key={l.id} value={i}>{l.title}</option>))}
        </select>
        <span style={{ marginLeft: 8 }}>置く点:</span>
        <button type="button" className="housing-dev-tourpreview-btn" onClick={() => setMode('road')} style={{ fontWeight: mode === 'road' ? 700 : 400 }}>道</button>
        <button type="button" className="housing-dev-tourpreview-btn" onClick={() => setMode('jump')} style={{ fontWeight: mode === 'jump' ? 700 : 400 }}>ジャンプ</button>
        <label><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> 道スナップ</label>
        <button type="button" className="housing-dev-tourpreview-btn" onClick={undo} disabled={points.length === 0}>1つ戻す</button>
        <button type="button" className="housing-dev-tourpreview-btn" onClick={resetHouse}>この家を白紙に</button>
        <button type="button" className="housing-dev-tourpreview-btn" onClick={save}>保存(全部まとめて)</button>
        <span style={{ opacity: 0.85 }}>{dirty.size > 0 ? `${dirty.size}件 未保存` : '保存済み'}</span>
        {saveMsg && <span style={{ opacity: 0.85 }}>{saveMsg}</span>}
      </div>

      <div className="housing-tour-page">
        <section className="housing-tour-page-panel" data-region="left">
          <div className="housing-tour-page-col">
            <TourProgressPanel progress={progress} onFinish={() => {}} />
          </div>
        </section>

        <section className="housing-tour-page-panel" data-region="center">
          <div className="housing-tour-page-col">
            <div className="housing-tour-map" data-region="tour-map">
              <div className="housing-tour-map-stage">
                <div className="housing-tour-map-wrap">
                  {asset.status === 'ready' && json ? (
                    <>
                      <div ref={hostRef} className="housing-map-svg-host" dangerouslySetInnerHTML={{ __html: asset.svg }} />
                      <svg
                        ref={svgRef}
                        className="housing-map-overlay"
                        viewBox={`0 0 ${w} ${h}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ pointerEvents: 'auto', cursor: 'crosshair', touchAction: 'none' }}
                        onPointerDown={onStageDown}
                        onPointerMove={onStageMove}
                        onPointerUp={() => setDragIdx(null)}
                        onPointerLeave={() => setDragIdx(null)}
                      >
                        {displayRoad && (
                          <>
                            <path className="housing-tour-route-glow" d={displayRoad} fill="none" />
                            <path data-testid="editor-route" className="housing-tour-route-core" d={displayRoad} fill="none">
                              <animate attributeName="stroke-dashoffset" from="0" to="-64" dur="1.1s" repeatCount="indefinite" />
                            </path>
                          </>
                        )}
                        {displayJump && <path data-testid="editor-jump" className="housing-tour-route-jump" d={displayJump} fill="none" />}
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
                      {/* 番号ノード(✓/1,2,3…)は経路に被って邪魔なので非表示(現在地は箱ハイライト+起点+右カードで分かる)。 */}
                    </>
                  ) : (
                    <div className="housing-tour-map-skeleton" aria-hidden="true" />
                  )}
                </div>
              </div>
              <p className="housing-tour-map-legend" style={{ opacity: 0.75, fontSize: 12 }}>
                道モード=道の上をクリックで点を置く(道に吸着) / ジャンプモード=踏切→着地の2点をクリック(弧が架かる) / 点ドラッグ=微調整 / ダブルクリック=削除 / 1つ戻す・白紙。青丸=起点・赤丸=入口。
              </p>
            </div>
          </div>
        </section>

        <section className="housing-tour-page-panel" data-region="right">
          <div className="housing-tour-page-col">
            <TourNextDestinationPanel
              currentStep={currentStep}
              steps={steps}
              currentIndex={index}
              isLast={index >= total - 1}
              onPrev={() => goto(index - 1)}
              onPrimary={() => goto(index + 1)}
              onOpenReport={() => {}}
            />
          </div>
        </section>
      </div>
    </div>
  );
};
