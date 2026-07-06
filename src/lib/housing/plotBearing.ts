import { getPlotDirections } from './wardDirections';

export type Vec = { x: number; y: number };

const D = Math.SQRT1_2;
const COMPASS: Record<string, Vec> = {
  '北東': { x: D, y: -D },
  '北西': { x: -D, y: -D },
  '南東': { x: D, y: D },
  '南西': { x: -D, y: D },
  '北': { x: 0, y: -1 },
  '南': { x: 0, y: 1 },
  '東': { x: 1, y: 0 },
  '西': { x: -1, y: 0 },
};

/** 行き方テキスト先頭の方角語 → 単位ベクトル(px空間・y下向き)。先頭が方角語でなければ null。 */
export function parseCompassBearing(text: string | null | undefined): Vec | null {
  if (!text) return null;
  const m = text.match(/^(北東|北西|南東|南西|北|南|東|西)/);
  return m ? COMPASS[m[1]] : null;
}

function normalize(v: Vec): Vec {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

/** plot の方角ベクトル。テキスト先頭語を優先、無ければ origin→door の向き。 */
export function getPlotBearing(area: string, plot: number | null | undefined, originPx: Vec, doorPx: Vec): Vec {
  const dir = getPlotDirections(area, plot);
  const parsed = parseCompassBearing(dir?.directions);
  return parsed ?? normalize({ x: doorPx.x - originPx.x, y: doorPx.y - originPx.y });
}
