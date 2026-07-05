import { resolveWardMapRef } from './resolveWardMapRef';
import data from '../../data/housing/wardEntrances.generated.json';

// JSON import は各点を number[] と推論するため unknown 経由でタプル型に確定する。
const TABLE = data as unknown as Record<string, Record<string, [number, number]>>;

/**
 * 家(area, plot / apartment)の手動指定入口を引く純関数。収録あり→[x,y](0..1)、なし→null。
 * mapKey/plot は resolveWardMapRef で解決(拡張街 -30 読み替え・アパート棟 → mapKey/'apart')。
 */
export function getPlotEntrance(
  area: string,
  plot: number | null | undefined,
  buildingType: 'house' | 'apartment' | undefined,
  apartmentBuilding: 1 | 2 | null | undefined,
): [number, number] | null {
  const ref = resolveWardMapRef(area, plot ?? null, apartmentBuilding ?? null, buildingType);
  if (!ref) return null;
  const key = ref.highlightKind === 'apart' ? 'apart' : String(ref.highlightPlot);
  return TABLE[ref.mapKey]?.[key] ?? null;
}
