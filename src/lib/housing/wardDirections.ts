import data from '../../data/housing/wardDirections.generated.json';

export interface PlotDirections {
  aetheryte: string;
  directions: string;
}

/** wardDirections.generated.json 内部の実データ形 (i18n はパーサが付与する Task8 追加分)。 */
type PlotDirectionsWithI18n = PlotDirections & { i18n?: Record<string, string> };

const TABLE = data as Record<string, Record<string, PlotDirectionsWithI18n>>;

/**
 * area(enum) + plot(1-60) → 最寄りエーテライト名 + 言葉ナビ。無ければ null。
 * 返り値は従来通り {aetheryte, directions} のみ(Task8 で追加した i18n フィールドは含めない。
 * plotOrigin/plotBearing 等の既存 lookup が toEqual({aetheryte, directions}) で厳密比較しているため)。
 */
export function getPlotDirections(
  area: string,
  plot: number | null | undefined,
): PlotDirections | null {
  if (plot == null || !Number.isInteger(plot)) return null;
  const d = TABLE[area]?.[String(plot)];
  if (!d) return null;
  return { aetheryte: d.aetheryte, directions: d.directions };
}

/**
 * area(enum) + plot(1-60) + locale → 行き方本文 (Task8: en/ko/zh 訳付き)。
 * ja、または該当ロケールの訳が無い場合は正典 (ja) 本文にフォールバックする。無ければ null。
 */
export function getPlotDirectionsText(
  area: string,
  plot: number | null | undefined,
  locale: 'ja' | 'en' | 'ko' | 'zh',
): string | null {
  if (plot == null || !Number.isInteger(plot)) return null;
  const d = TABLE[area]?.[String(plot)];
  if (!d) return null;
  return (locale !== 'ja' && d.i18n?.[locale]) || d.directions;
}
