import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { MockListing } from '../../data/housing/mockListings';
import { resolveWardMapRef } from './resolveWardMapRef';
import { plotToPlacementIn, buildRoutePathIn } from './wardRoute';
import { getPlotOriginNode } from './plotOrigin';
import { stepStatus, type StepStatus, type TourStep } from './tourNav';

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

  return { target, placed, routePath, origin, targetElId: target ? ref.elementId : null };
}
