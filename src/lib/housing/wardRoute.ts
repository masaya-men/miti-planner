import mistWard from '../../data/housing/mistWard.generated.json';

export const MAP_VIEWBOX = { w: mistWard.viewBox.w, h: mistWard.viewBox.h };
const W = MAP_VIEWBOX.w;
const H = MAP_VIEWBOX.h;

/** 区中央エーテライト相当(仮置き・M1)。実データでの妥当性は実機で確認(spec §9)。 */
export const WARD_CENTER_NODE = 'node_1';

type Node = { id: string; x: number; y: number };
type House = { kind: string; plot: number; x: number; y: number; node: string | null };
type EdgeData = { a: string; b: string; polyline: [number, number][] };

const NODES = mistWard.nodes as Node[];
const HOUSES = mistWard.houses as House[];
const EDGES = mistWard.edges as unknown as EdgeData[];
const nodeById = new Map(NODES.map((n) => [n.id, n]));

const ADJ = (() => {
  const m = new Map<string, string[]>();
  for (const e of EDGES) {
    (m.get(e.a) ?? m.set(e.a, []).get(e.a)!).push(e.b);
    (m.get(e.b) ?? m.set(e.b, []).get(e.b)!).push(e.a);
  }
  return m;
})();

function routeNodes(startId: string, goalId: string): string[] {
  const prev: Record<string, string | null> = { [startId]: null };
  const q = [startId];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goalId) break;
    for (const nx of ADJ.get(cur) ?? []) if (!(nx in prev)) { prev[nx] = cur; q.push(nx); }
  }
  if (!(goalId in prev)) return [];
  const path: string[] = [];
  let c: string | null = goalId;
  while (c) { path.unshift(c); c = prev[c]; }
  return path;
}

export interface Placement { x: number; y: number; nodeId: string | null }

/** plot 番号 → viewBox px 座標。存在しなければ null。 */
export function plotToPlacement(plot: number, kind: 'plot' = 'plot'): Placement | null {
  const h = HOUSES.find((x) => x.plot === plot && x.kind === kind);
  if (!h) return null;
  return { x: h.x * W, y: h.y * H, nodeId: h.node };
}

/** origin ノード → goal ノード の道なり SVG path。未知ノード/到達不能で null。 */
export function buildRoutePath(originNodeId: string, goalNodeId: string): string | null {
  if (!nodeById.has(originNodeId) || !nodeById.has(goalNodeId)) return null;
  const ids = routeNodes(originNodeId, goalNodeId);
  if (ids.length === 0) return null;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ids.length; i++) {
    const a = ids[i];
    const b = ids[i + 1];
    const e = EDGES.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!e) {
      if (i === 0) { const aN = nodeById.get(a)!; pts.push([aN.x * W, aN.y * H]); }
      const bN = nodeById.get(b)!; pts.push([bN.x * W, bN.y * H]);
      continue;
    }
    const seg = e.a === a ? e.polyline : e.polyline.slice().reverse();
    const segPx = seg.map(([px, py]) => [px * W, py * H] as [number, number]);
    if (i === 0) pts.push(...segPx);
    else pts.push(...segPx.slice(1));
  }
  if (pts.length === 0) { // origin===goal 等
    const n = nodeById.get(goalNodeId)!; pts.push([n.x * W, n.y * H]);
  }
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}
