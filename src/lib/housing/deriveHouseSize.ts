import type { HousingSize } from '../../types/housing.js';
import { getPlotSize } from '../../data/housing/wardPlotSizes.js';

/**
 * house (FC個室含む) の size を (area, plot) から導出する。
 * house を明示選択したときだけ導出し、未選択 (undefined) / apartment / area 未確定 /
 * plot 未確定・範囲外 のときは null。
 *
 * - `buildingType !== 'house'` (apartment または未選択) なら必ず null。未選択で null に
 *   するのは、建物タイプを選ぶまで番地・サイズを表示しない UI
 *   (`RegisterSectionAddress` の `isHouse = buildingType === 'house'`) と歩調を合わせるため。
 * - house のときは `getPlotSize(area, plot)` に委譲。area 不正 / plot 未確定・範囲外は
 *   getPlotSize が null を返す。
 */
export function deriveHouseSize(input: {
  buildingType?: 'house' | 'apartment' | string;
  area?: string;
  plot?: number;
}): HousingSize | null {
  // house を明示選択したときだけ size を導出する。未選択 (undefined) / apartment は null。
  // (以前は undefined を house 扱いしていたが、建物タイプ未選択のまま登録できてしまう
  //  不整合の原因だった。RegisterSectionAddress の isHouse === 'house' 判定に合わせる。)
  if (input.buildingType !== 'house') return null;
  // area / plot が未確定なら導出不可。
  if (input.area === undefined || input.plot === undefined) return null;
  return getPlotSize(input.area, input.plot);
}
