import type { WardMapJson } from '../../data/housing/wardMapManifest';
import { getMapAetherytes } from './wardAetherytes';

/**
 * アパートの「最寄りエーテネットシャード起点」を解決する純関数。
 * 家は per-plot 名で正典指定(getPlotOriginNode)だが、アパートは正典データが無いため、
 * 同一地図(mapKey)のシャードから幾何的に最寄りの1つを選ぶ。
 * getMapAetherytes(mapKey) は当該マップのシャードのみ(本街=非[拡張街]/sub=[拡張街])＝クロス0は構造保証。
 */
export function getApartmentOrigin(
  json: WardMapJson,
  mapKey: string,
): { node: string; aetheryte: string; x: number; y: number } | null {
  const apart = json.houses.find((h) => h.kind === 'apart');
  if (!apart) return null;
  const shards = getMapAetherytes(mapKey);
  let best: { name: string; x: number; y: number; node: string } | null = null;
  let bd = Infinity;
  for (const s of shards) {
    const d = Math.hypot(s.x - apart.x, s.y - apart.y);
    if (d < bd) { bd = d; best = s; }
  }
  if (!best || !best.node) return null;
  return { node: best.node, aetheryte: best.name, x: best.x, y: best.y };
}
