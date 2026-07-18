import terms from '../../data/housing/housingTerms.generated.json';
import { regionForDC } from '../../data/housing/dcServerMap';

export type TermLocale = 'ja' | 'en' | 'ko' | 'zh';
export type TermKind = 'dc' | 'world' | 'area' | 'apartment' | 'aetheryte' | 'district' | 'size' | 'tag';
type Entry = Record<TermLocale, string>;
const TABLE = terms as Record<TermKind, Record<string, Entry>>;

/** 辞書名。未登録キーはそのまま返す (壊さないフォールバック)。 */
export function termLabel(kind: TermKind, key: string, locale: TermLocale): string {
  return TABLE[kind]?.[key]?.[locale] ?? key;
}

const isCnKr = (dcKey: string) => { const r = regionForDC(dcKey); return r === 'KR' || r === 'CN'; };

/** DC 表示名: KR/CN のみ全ロケール辞書名、グローバルは現状表示 (内部キー=英名) を維持。 */
export function displayDcName(dcKey: string, locale: TermLocale): string {
  return isCnKr(dcKey) ? termLabel('dc', dcKey, locale) : dcKey;
}

/** ワールド表示名: 所属 DC が KR/CN のときのみ辞書名。 */
export function displayWorldName(dcKey: string, serverKey: string, locale: TermLocale): string {
  return isCnKr(dcKey) ? termLabel('world', serverKey, locale) : serverKey;
}

/** 検索用の別名 (キー自身と ja を除く en/ko/zh。ja を含めたい場合は includeJa)。 */
export function searchNamesFor(kind: TermKind, key: string, includeJa = false): string[] {
  const e = TABLE[kind]?.[key];
  if (!e) return [];
  const names = includeJa ? [e.ja, e.en, e.ko, e.zh] : [e.en, e.ko, e.zh];
  return [...new Set(names)].filter((n) => n && n !== key);
}
