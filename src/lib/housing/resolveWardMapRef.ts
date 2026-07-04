// 住所 → 表示すべき地図 mapKey とハイライト対象を解決する純関数 (spec パートC)。
// FF14 仕様: 拡張街の家は plot 31-60 (SVG は 1-30 命名なので -30 読み替え)。
// アパート棟 1=本街 / 2=拡張。FC 個室は親の家 plot をハイライト (呼び出し側で plot を渡す)。
// elementId = 地図 SVG 内の該当パス id (区画=plot_N / アパート=apart_1|apart_2)。実箱ハイライト用。

const AREA_TO_KEY: Record<string, string> = {
  Mist: 'mist',
  LavenderBeds: 'lavender',
  Goblet: 'goblet',
  Shirogane: 'shirogane',
  Empyreum: 'empyreum',
};

export function resolveWardMapRef(
  area: string,
  plot: number | null | undefined,
  apartmentBuilding: 1 | 2 | null | undefined,
  buildingType: 'house' | 'apartment' | undefined,
): { mapKey: string; highlightPlot: number; highlightKind: 'plot' | 'apart'; elementId: string } | null {
  const baseKey = AREA_TO_KEY[area];
  if (!baseKey) return null;

  if (buildingType === 'apartment') {
    const sub = apartmentBuilding === 2;
    return {
      mapKey: sub ? `${baseKey}-sub` : baseKey,
      highlightPlot: 1,
      highlightKind: 'apart',
      elementId: sub ? 'apart_2' : 'apart_1',
    };
  }

  if (plot == null) return null;
  if (plot >= 1 && plot <= 30) {
    return { mapKey: baseKey, highlightPlot: plot, highlightKind: 'plot', elementId: `plot_${plot}` };
  }
  if (plot >= 31 && plot <= 60) {
    return { mapKey: `${baseKey}-sub`, highlightPlot: plot - 30, highlightKind: 'plot', elementId: `plot_${plot - 30}` };
  }
  return null;
}
