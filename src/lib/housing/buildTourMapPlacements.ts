import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { MockListing } from '../../data/housing/mockListings';
import { resolveWardMapRef } from './resolveWardMapRef';
import { plotToPlacementIn, apartToPlacementIn } from './wardRoute';
import { getPlotOriginNode } from './plotOrigin';
import { getApartmentOrigin } from './apartmentOrigin';
import { stepStatus, type StepStatus, type TourStep } from './tourNav';
import { getPlotEntrance } from './plotEntrance';
import { computePlotDoor } from './plotDoor';
import { getPlotBearing } from './plotBearing';
import { buildVerbalRoute } from './verbalRoute';
import { getRouteOverride } from './wardRouteOverrides';

export interface TourMapPlacement { index: number; x: number; y: number; status: StepStatus }
export interface TourMapModel {
  target: { x: number; y: number } | null;   // 現在の目的地(家)ハイライト中心 (リング用)
  placed: TourMapPlacement[];                  // 同一ワード地図の全ステップ番号ノード
  routePath: string | null;                    // 実線: 起点→(道追従 or 角まで)
  routeJumpPath: string | null;                // 破線: 角→入口(道に無い区間/階段ジャンプ)。無ければ null
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
  let routeJumpPath: string | null = null;
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
  }

  return { target, placed, routePath, routeJumpPath, origin, targetElId: target ? ref.elementId : null };
}
