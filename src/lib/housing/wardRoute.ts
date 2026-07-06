import mistWardRaw from '../../data/housing/mistWard.generated.json';
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import { nearestPointOnPolylines, type PolylineEdge } from './mapGeometry';

const mistWard = mistWardRaw as unknown as WardMapJson;
export const MAP_VIEWBOX = { w: mistWard.viewBox.w, h: mistWard.viewBox.h };

/** 区中央エーテライト相当(仮置き・M1)。実データでの妥当性は実機で確認(spec §9)。 */
export const WARD_CENTER_NODE = 'node_1';
export interface Placement { x: number; y: number; nodeId: string | null; outline: number[][] | null }
type EdgeData = { a: string; b: string; polyline: [number, number][] };

function buildAdjacency(json: WardMapJson): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of json.edges) { (m.get(e.a) ?? m.set(e.a, []).get(e.a)!).push(e.b); (m.get(e.b) ?? m.set(e.b, []).get(e.b)!).push(e.a); }
  return m;
}
function routeNodes(adj: Map<string, string[]>, startId: string, goalId: string): string[] {
  const prev: Record<string, string | null> = { [startId]: null }; const q = [startId];
  while (q.length) { const cur = q.shift()!; if (cur === goalId) break; for (const nx of adj.get(cur) ?? []) if (!(nx in prev)) { prev[nx] = cur; q.push(nx); } }
  if (!(goalId in prev)) return [];
  const path: string[] = []; let c: string | null = goalId; while (c) { path.unshift(c); c = prev[c]; } return path;
}
/** plot 番号 → viewBox px 座標(json 引数版)。存在しなければ null。 */
export function plotToPlacementIn(json: WardMapJson, plot: number, kind: 'plot' | 'apart' = 'plot'): Placement | null {
  const h = json.houses.find((x) => x.plot === plot && x.kind === kind); if (!h) return null;
  return { x: h.x * json.viewBox.w, y: h.y * json.viewBox.h, nodeId: h.node, outline: h.outline ?? null };
}
/** 各マップに1つだけ存在する apart エントリ → viewBox px 座標(番号非依存)。無ければ null。 */
export function apartToPlacementIn(json: WardMapJson): Placement | null {
  const h = json.houses.find((x) => x.kind === 'apart'); if (!h) return null;
  return { x: h.x * json.viewBox.w, y: h.y * json.viewBox.h, nodeId: h.node, outline: h.outline ?? null };
}
/** ノード ID → viewBox px 座標(json 引数版)。未知ノードは null。 */
export function nodeToPointIn(json: WardMapJson, nodeId: string): { x: number; y: number } | null {
  const n = json.nodes.find((x) => x.id === nodeId); if (!n) return null;
  return { x: n.x * json.viewBox.w, y: n.y * json.viewBox.h };
}
/** origin ノード → goal ノード の道なり px 点列(json 引数版)。未知ノード/到達不能で null。 */
export function buildRoutePointsIn(json: WardMapJson, originNodeId: string, goalNodeId: string): [number, number][] | null {
  const nodeById = new Map(json.nodes.map((n) => [n.id, n]));
  if (!nodeById.has(originNodeId) || !nodeById.has(goalNodeId)) return null;
  const w = json.viewBox.w, h = json.viewBox.h; const edges = json.edges as unknown as EdgeData[];
  const ids = routeNodes(buildAdjacency(json), originNodeId, goalNodeId); if (ids.length === 0) return null;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ids.length; i++) {
    const a = ids[i], b = ids[i + 1];
    const e = edges.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!e) { if (i === 0) { const aN = nodeById.get(a)!; pts.push([aN.x * w, aN.y * h]); } const bN = nodeById.get(b)!; pts.push([bN.x * w, bN.y * h]); continue; }
    const seg = e.a === a ? e.polyline : e.polyline.slice().reverse();
    const segPx = seg.map(([px, py]) => [px * w, py * h] as [number, number]);
    if (i === 0) pts.push(...segPx); else pts.push(...segPx.slice(1));
  }
  if (pts.length === 0) { const n = nodeById.get(goalNodeId)!; pts.push([n.x * w, n.y * h]); }
  return pts;
}
/** origin ノード → goal ノード の道なり SVG path(json 引数版)。未知ノード/到達不能で null。 */
export function buildRoutePathIn(json: WardMapJson, originNodeId: string, goalNodeId: string): string | null {
  const pts = buildRoutePointsIn(json, originNodeId, goalNodeId);
  if (!pts) return null;
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}
/**
 * エーテライト(startPt) と 玄関(endPt) を道(edges)に投影し、投影点どうしを道なりに結ぶ px 点列。
 * ノード割当に依存せず必ず道を辿る(退化=起点/家が同ノードでも投影点間を道でつなぐ)。到達不能で null。
 * 実装: 2投影点を仮想ノードとしてグラフに差し込み(該当 edge を投影位置で分割)、既存 buildRoutePointsIn で BFS。
 */
export function buildSnappedRoutePoints(
  json: WardMapJson,
  startPt: { x: number; y: number },
  endPt: { x: number; y: number },
): [number, number][] | null {
  const w = json.viewBox.w, h = json.viewBox.h;
  const edgesPx: PolylineEdge[] = json.edges.map((e) => ({
    a: e.a, b: e.b, polyline: e.polyline.map(([x, y]) => [x * w, y * h] as [number, number]),
  }));
  const ps = nearestPointOnPolylines(startPt.x, startPt.y, edgesPx);
  const pe = nearestPointOnPolylines(endPt.x, endPt.y, edgesPx);
  if (!ps || !pe) return null;

  const VS = '__vs__', VE = '__ve__';
  const vs01: [number, number] = [ps.x / w, ps.y / h];
  const ve01: [number, number] = [pe.x / w, pe.y / h];
  const nodes = [...json.nodes, { id: VS, x: vs01[0], y: vs01[1] }, { id: VE, x: ve01[0], y: ve01[1] }];

  const edges: WardMapJson['edges'] = [];
  json.edges.forEach((e, ei) => {
    const poly = e.polyline as [number, number][];
    const onS = ei === ps.edgeIndex, onE = ei === pe.edgeIndex;
    if (onS && onE) {
      // 同一 edge に両投影 → 位置(seg+t)順で a—X—Y—b の3分割
      const sPos = ps.segIndex + ps.t, ePos = pe.segIndex + pe.t;
      const A = sPos <= ePos ? { id: VS, seg: ps.segIndex, pt: vs01 } : { id: VE, seg: pe.segIndex, pt: ve01 };
      const B = sPos <= ePos ? { id: VE, seg: pe.segIndex, pt: ve01 } : { id: VS, seg: ps.segIndex, pt: vs01 };
      edges.push({ a: e.a, b: A.id, polyline: [...poly.slice(0, A.seg + 1), A.pt] });
      edges.push({ a: A.id, b: B.id, polyline: [A.pt, ...poly.slice(A.seg + 1, B.seg + 1), B.pt] });
      edges.push({ a: B.id, b: e.b, polyline: [B.pt, ...poly.slice(B.seg + 1)] });
    } else if (onS) {
      edges.push({ a: e.a, b: VS, polyline: [...poly.slice(0, ps.segIndex + 1), vs01] });
      edges.push({ a: VS, b: e.b, polyline: [vs01, ...poly.slice(ps.segIndex + 1)] });
    } else if (onE) {
      edges.push({ a: e.a, b: VE, polyline: [...poly.slice(0, pe.segIndex + 1), ve01] });
      edges.push({ a: VE, b: e.b, polyline: [ve01, ...poly.slice(pe.segIndex + 1)] });
    } else {
      edges.push(e);
    }
  });

  return buildRoutePointsIn({ ...json, nodes, edges }, VS, VE);
}

/** plot 番号 → viewBox px 座標(Mist 委譲・後方互換)。存在しなければ null。 */
export function plotToPlacement(plot: number, kind: 'plot' = 'plot'): Placement | null { return plotToPlacementIn(mistWard, plot, kind); }
/** ノード ID → viewBox px 座標(Mist 委譲・後方互換)。未知ノードは null。(現在地マーカー等の単点配置向け) */
export function nodeToPoint(nodeId: string): { x: number; y: number } | null { return nodeToPointIn(mistWard, nodeId); }
/** origin ノード → goal ノード の道なり SVG path(Mist 委譲・後方互換)。未知ノード/到達不能で null。 */
export function buildRoutePath(originNodeId: string, goalNodeId: string): string | null { return buildRoutePathIn(mistWard, originNodeId, goalNodeId); }
