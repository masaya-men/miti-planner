import { getPlotDirections } from './wardDirections';
import { resolveWardMapRef } from './resolveWardMapRef';
import { getMapAetherytes } from './wardAetherytes';

const norm = (s: string) => s.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();

/**
 * 家(area, plot)の「最寄りエーテネットシャード起点」を解決する純関数。
 * P1名 → 正規化 → その家の地図(mapKey)のシャードとのみ照合(本街/拡張の混在なし) → 起点ノード+座標。
 * 照合不可(データ欠落)は null (呼び出し側で区の基準点にフォールバック)。
 */
export function getPlotOriginNode(
  area: string,
  plot: number | null | undefined,
): { node: string; aetheryte: string; x: number; y: number } | null {
  const dir = getPlotDirections(area, plot);
  if (!dir) return null;
  const ref = resolveWardMapRef(area, plot ?? null, null, 'house');
  if (!ref) return null;
  const key = norm(dir.aetheryte);
  const shard = getMapAetherytes(ref.mapKey).find((s) => norm(s.name) === key);
  if (!shard || !shard.node) return null;
  return { node: shard.node, aetheryte: shard.name, x: shard.x, y: shard.y };
}
