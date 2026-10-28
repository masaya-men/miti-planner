import { HOUSING_AREAS } from '../../types/housing';

/** HOUSING_AREAS 内の並び順。未知のエリアは末尾(HOUSING_AREAS.length)。 */
export function areaIndex(area: string): number {
  const idx = HOUSING_AREAS.indexOf(area as typeof HOUSING_AREAS[number]);
  return idx === -1 ? HOUSING_AREAS.length : idx;
}
