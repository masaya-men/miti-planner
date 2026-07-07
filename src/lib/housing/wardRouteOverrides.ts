import overridesRaw from '../../data/housing/wardRouteOverrides.generated.json';
import { migrateLegacyOverride, type RouteSegment } from './routePaths';

// 生成物 JSON は旧 {road, jump} と新 {segments} が混在しうる。どちらも受ける生の型。
type RawEntry = { road?: [number, number][]; jump?: [number, number][] | null; segments?: RouteSegment[] };
const TABLE = overridesRaw as unknown as Record<string, Record<string, RawEntry>>;

/** (mapKey, plotKey) の手動上書き経路を segments で返す。旧 {road,jump} も segments に正規化。plotKey は plot 番号文字列 or 'apart'。無ければ null。 */
export function getRouteOverride(mapKey: string, plotKey: string): RouteSegment[] | null {
  const raw = TABLE[mapKey]?.[plotKey];
  if (!raw) return null;
  return migrateLegacyOverride(raw);
}
