import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { MockListing } from '../../data/housing/mockListings';
import { resolveWardMapRef } from './resolveWardMapRef';
import { plotToPlacementIn, apartToPlacementIn, buildRoutePointsIn } from './wardRoute';
import { getPlotOriginNode } from './plotOrigin';
import { getApartmentOrigin } from './apartmentOrigin';
import { stepStatus, type StepStatus, type TourStep } from './tourNav';
import { trimRouteToEndpoints } from './mapGeometry';
import { getPlotEntrance } from './plotEntrance';
import { computePlotDoor } from './plotDoor';

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

    const routePts = buildRoutePointsIn(json, originInfo.node, targetPlacement.nodeId);
    if (routePts && routePts.length) {
      // 玄関(終点): 入口データ優先 → 幾何(箱縁) → 箱中心 の順で決める。
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
      // カーナビ方式(改善1+2): 道なり本体を、エーテライトと玄関を「経路上」に投影した点の間だけに
      // 切り詰め、始点の戻りスパー・終点の行き過ぎオーバーシュートを除去する。
      // 最終 = エーテライト実座標 → (道への合流点) → …道なり… → (玄関前で道を離れる点) → 玄関。
      // 退化ケース(起点ノード==家ノード=エーテライト隣接)は道が寄与しない → エーテライト→玄関を直接
      // (単一ノードへ寄り道するカクつきを避ける)。
      const trimmed = routePts.length < 2
        ? []
        : trimRouteToEndpoints(routePts, { x: oxPx, y: oyPx }, { x: doorX, y: doorY });
      const pts: [number, number][] = [[oxPx, oyPx], ...trimmed, [doorX, doorY]];
      routePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    }
  }

  return { target, placed, routePath, origin, targetElId: target ? ref.elementId : null };
}
