import type { HousingSize } from '../../types/housing.js';
import { getPlotSize } from '../../data/housing/wardPlotSizes.js';

/**
 * house (FC個室含む) の size を (area, plot) から導出する。
 * apartment / area 未確定 / plot 未確定・範囲外 のときは null。
 *
 * - `buildingType === 'apartment'` なら必ず null (apartment は size を持てない。
 *   `validateAddress` が `not_allowed_for_apartment` を返す)。
 * - `buildingType` が undefined のときは house 扱い
 *   (`RegisterSectionAddress.tsx` の `isHouse = buildingType !== 'apartment'` と同じ挙動)。
 * - それ以外は `getPlotSize(area, plot)` に委譲。area 不正 / plot 未確定・範囲外は
 *   getPlotSize が null を返す。
 */
export function deriveHouseSize(input: {
  buildingType?: 'house' | 'apartment' | string;
  area?: string;
  plot?: number;
}): HousingSize | null {
  // apartment は size を持てない (undefined は house 扱いなので除外しない)。
  if (input.buildingType === 'apartment') return null;
  // area / plot が未確定なら導出不可。
  if (input.area === undefined || input.plot === undefined) return null;
  return getPlotSize(input.area, input.plot);
}
