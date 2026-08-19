/**
 * Allmarksまとめてインポート中の「家が降ってくる→道でつながる→歩く→消える」演出の
 * 純粋ロジック(座標計算・経路組み立て・フェーズ時間)。 タイマー/DOM から切り離すことで
 * vitest で deterministic にテスト可能にする(`slideshowCycle.ts` と同じ分離方針)。
 */

export interface HousePoint {
  x: number;
  y: number;
}

export type FallingHousesPhase = 'falling' | 'path' | 'walking' | 'hold' | 'fading';

export const MIN_HOUSES = 4;
export const MAX_HOUSES = 6;

export const FALL_DURATION_MS = 500;
export const FALL_STAGGER_MS = 350;
export const SETTLE_PAUSE_MS = 300;
export const PATH_DRAW_MS = 700;
export const WALK_MS = 900;
export const HOLD_MS = 400;
export const FADE_MS = 400;

export const CONTAINER_WIDTH = 240;
export const CONTAINER_HEIGHT = 96;

const BASELINE_Y = 68;
const Y_JITTER = 6;
const X_JITTER = 10;
const MARGIN_X = 22;

/** 1周あたりの家の数 (4〜6のランダム)。 */
export function pickHouseCount(rng: () => number = Math.random): number {
  return MIN_HOUSES + Math.floor(rng() * (MAX_HOUSES - MIN_HOUSES + 1));
}

/** 家をコンテナ内に左→右へ並べつつ、縦横に軽くジッターさせて配置する。 */
export function layoutHouses(count: number, rng: () => number = Math.random): HousePoint[] {
  if (count <= 0) return [];
  const usableWidth = CONTAINER_WIDTH - MARGIN_X * 2;
  const colWidth = count > 1 ? usableWidth / count : 0;
  return Array.from({ length: count }, (_, i) => {
    const colCenter = count > 1 ? MARGIN_X + colWidth * (i + 0.5) : CONTAINER_WIDTH / 2;
    const x = colCenter + (rng() - 0.5) * 2 * X_JITTER;
    const y = BASELINE_Y + (rng() - 0.5) * 2 * Y_JITTER;
    return { x, y };
  });
}

/** 貪欲最近傍法で家をつなぐ順番 (index 0 始まり) を決める。 ジグザグの遠回りを避け、
 * 「歩けるルート」らしい自然な順序にする。 */
export function nearestNeighborOrder(points: HousePoint[]): number[] {
  if (points.length === 0) return [];
  const visited = new Set<number>([0]);
  const order = [0];
  while (visited.size < points.length) {
    const last = points[order[order.length - 1]];
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;
      const dx = points[i].x - last.x;
      const dy = points[i].y - last.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    visited.add(bestIdx);
    order.push(bestIdx);
  }
  return order;
}

/** 順番通りに家をつなぐSVGパス文字列。 直線つなぎではなく、区間ごとに垂直方向へ交互に
 * ふくらませた二次ベジェで「道」らしい緩やかな揺れを出す。 */
export function buildPathD(points: HousePoint[], order: number[]): string {
  if (order.length < 2) return '';
  const ordered = order.map((i) => points[i]);
  let d = `M ${ordered[0].x} ${ordered[0].y}`;
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const curr = ordered[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const bulge = Math.min(len * 0.35, 18) * (i % 2 === 0 ? 1 : -1);
    const ctrlX = midX + perpX * bulge;
    const ctrlY = midY + perpY * bulge;
    d += ` Q ${ctrlX} ${ctrlY} ${curr.x} ${curr.y}`;
  }
  return d;
}

const PHASE_ORDER: FallingHousesPhase[] = ['falling', 'path', 'walking', 'hold', 'fading'];

/** フェーズの表示時間 (家が増えるほど「落下」フェーズは長くなる)。 */
export function phaseDurationMs(phase: FallingHousesPhase, houseCount: number): number {
  switch (phase) {
    case 'falling':
      return Math.max(0, houseCount - 1) * FALL_STAGGER_MS + FALL_DURATION_MS + SETTLE_PAUSE_MS;
    case 'path':
      return PATH_DRAW_MS;
    case 'walking':
      return WALK_MS;
    case 'hold':
      return HOLD_MS;
    case 'fading':
      return FADE_MS;
    default:
      return 0;
  }
}

/** 次のフェーズ。 'fading' の次は無し (呼び出し側が周期をリセットする)。 */
export function nextPhase(phase: FallingHousesPhase): FallingHousesPhase | null {
  const idx = PHASE_ORDER.indexOf(phase);
  return idx >= 0 && idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
}
