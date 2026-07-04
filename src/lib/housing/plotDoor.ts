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
