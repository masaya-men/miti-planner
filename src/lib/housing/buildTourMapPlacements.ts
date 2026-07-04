import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { MockListing } from '../../data/housing/mockListings';
import { resolveWardMapRef } from './resolveWardMapRef';
import { plotToPlacementIn, apartToPlacementIn, buildRoutePathIn, nodeToPointIn } from './wardRoute';
import { getPlotOriginNode } from './plotOrigin';
import { getApartmentOrigin } from './apartmentOrigin';
import { stepStatus, type StepStatus, type TourStep } from './tourNav';
import { nearestPointOnPolylines, segmentPolygonIntersection } from './mapGeometry';

export interface TourMapPlacement { index: number; x: number; y: number; status: StepStatus }
export interface TourMapModel {
  target: { x: number; y: number } | null;   // 現在の目的地(家)ハイライト中心 (リング用)
  placed: TourMapPlacement[];                  // 同一ワード地図の全ステップ番号ノード
  routePath: string | null;                    // 起点(エーテライト)→家 の道なり (毎回)
  origin: { x: number; y: number } | null;     // エーテライトシャード座標マーカー
  targetElId: string | null;                   // 実箱ハイライト対象の SVG 要素 id (plot_N / apart_1|2)
}

function refOf(listing: TourStep['listing']) {
  if (!listing) return null;
  return resolveWardMapRef(listing.area, listing.plot ?? null, listing.apartmentBuilding ?? null, listing.buildingType);
}

/** ワード地図 ref → 配置。apart は番号非依存で唯一の apart を、plot は plot 番号で解決。 */
function placementForRef(json: WardMapJson, r: { highlightPlot: number; highlightKind: 'plot' | 'apart' }) {
  return r.highlightKind === 'apart'
    ? apartToPlacementIn(json)
    : plotToPlacementIn(json, r.highlightPlot, 'plot');
}

/**
 * 「現在の目的地の家」に対する地図配置モデル。起点は必ずその家の最寄りエーテネットシャード(getPlotOriginNode)。
 * 起点ノード → 家の玄関ノード の道なり経路を毎回描く(直前の家に依存しない)。
 */
export function buildTourMapPlacements(
  json: WardMapJson,
  mapKey: string,
  ref: { highlightPlot: number; highlightKind: 'plot' | 'apart'; elementId: string },
  currentListing: MockListing | null,
  steps: TourStep[],
  currentIndex: number,
): TourMapModel {
  const targetPlacement = placementForRef(json, ref);
  const target = targetPlacement ? { x: targetPlacement.x, y: targetPlacement.y } : null;

  const placed: TourMapPlacement[] = [];
  for (let i = 0; i < steps.length; i++) {
    const r = refOf(steps[i].listing);
    if (!r || r.mapKey !== mapKey) continue;
    const p = placementForRef(json, r);
    if (!p) continue;
    placed.push({ index: i, x: p.x, y: p.y, status: stepStatus(i, currentIndex) });
  }

  // 起点 = 現在の家の最寄りエーテネットシャード(家)/最寄りシャード幾何解決(アパート)。ノード→玄関ノードの道なり + 玄関座標へ最後の1ホップ。
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
        // lastNode は nodeToPointIn の時点で既に px 座標(0..1正規化ではない)。× w/h の再スケールは不要。
        const hit = segmentPolygonIntersection(lastNode.x, lastNode.y, targetPlacement.x, targetPlacement.y, outlinePx);
        if (hit) { doorX = hit.x; doorY = hit.y; }
      }
      routePath = `${lead}${body} L${doorX.toFixed(1)} ${doorY.toFixed(1)}`;
    }
  }

  return { target, placed, routePath, origin, targetElId: target ? ref.elementId : null };
}
