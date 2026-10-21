/**
 * 左レールの座標表(見本 milspec-v11.js buildRail js:397-415)。
 * 座標は基板 SVG(幅 14・高さ L = H-12)の左上基準。リベットだけ区画(幅 22)基準。
 * H は区画の実高(見本は 679 固定。高さが伸びたぶんはバス B の下端 = L とリベットの数に反映する)。
 */
import type { Pt } from '../armor/types';
import { busPaths } from '../armor/geom';

export interface RailLayout {
  L: number;
  busA: Pt[][];
  busB: Pt[][];
  ic: { x: number; y: number; w: number; h: number; pins: number[]; mark: string };
  vias: Pt[];
  /** 取っ手の左右を縁取るビアの柵 */
  fence: Pt[];
  smd: { x: number; y: number; w: number; h: number }[];
  labels: { x: number; y: number; t: string }[];
  /** 区画(幅 22)基準のリベット位置 */
  rivets: Pt[];
  pull: { x: number; y: number; w: number; h: number };
}

export function railLayout(H: number): RailLayout {
  const L = H - 12;
  const busA = busPaths([[7, 0], [7, 84], [8.3, 85.3], [8.3, 172], [7, 173.3], [7, 250]], 8, 1.3);
  const busB = busPaths([[7, 270.5], [7, 396], [5.7, 397.3], [5.7, 506], [7, 507.3], [7, L]], 8, 1.3);
  const vias: Pt[] = [];
  busA.forEach((pts, k) => { if (k % 2) vias.push([pts[2][0], pts[2][1] + 3]); });
  busB.forEach((pts, k) => { if (!(k % 2)) vias.push([pts[2][0], pts[2][1] + 3]); });
  const fence: Pt[] = [];
  for (let y = 292; y < 372; y += 4.4) { fence.push([1, y]); fence.push([13, y + 2.2]); }
  const rivets: Pt[] = [];
  [40, 120, 200, 460, 540, 620].forEach((y) => {
    if (y + 20 < L) { rivets.push([0.6, y]); rivets.push([18.4, y + 20]); }
  });
  return {
    L, busA, busB,
    ic: { x: 1.4, y: 251.2, w: 11.2, h: 18, pins: busA.map((p) => p[p.length - 1][0]), mark: 'U7' },
    vias, fence,
    smd: [[0.4, 226], [12.4, 232], [0.4, 280], [12.4, 286]].map(([x, y]) => ({ x, y, w: 1.2, h: 2.4 })),
    labels: [{ x: 7, y: 300, t: 'PULL' }, { x: 7, y: 14, t: 'SIG-A' }],
    rivets,
    pull: { x: 4, y: Math.round(H / 2 - 22), w: 14, h: 44 },
  };
}
