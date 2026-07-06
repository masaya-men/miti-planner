import overridesRaw from '../../data/housing/wardRouteOverrides.generated.json';

export interface RouteOverride { road: [number, number][]; jump: [number, number][] | null }
type OverrideTable = Record<string, Record<string, RouteOverride>>;
const TABLE = overridesRaw as OverrideTable;

/** (mapKey, plotKey) の手動上書き経路(正規化 0..1)。plotKey は plot 番号文字列 or 'apart'。無ければ null。 */
export function getRouteOverride(mapKey: string, plotKey: string): RouteOverride | null {
  return TABLE[mapKey]?.[plotKey] ?? null;
}
