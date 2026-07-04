import data from '../../data/housing/wardAetherytes.generated.json';

export interface WardAetheryte { name: string; x: number; y: number; node: string }
const TABLE = data as Record<string, WardAetheryte[]>;

/** mapKey → そのワード地図のエーテネットシャード一覧 (x,y は 0..1 正規化・node は最寄りノード)。 */
export function getMapAetherytes(mapKey: string): WardAetheryte[] {
  return TABLE[mapKey] ?? [];
}
