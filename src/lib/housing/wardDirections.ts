import data from '../../data/housing/wardDirections.generated.json';

export interface PlotDirections {
  aetheryte: string;
  directions: string;
}

const TABLE = data as Record<string, Record<string, PlotDirections>>;

/** area(enum) + plot(1-60) → 最寄りエーテライト名 + 言葉ナビ。無ければ null。 */
export function getPlotDirections(
  area: string,
  plot: number | null | undefined,
): PlotDirections | null {
  if (plot == null || !Number.isInteger(plot)) return null;
  return TABLE[area]?.[String(plot)] ?? null;
}
