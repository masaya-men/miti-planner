/**
 * ハウジングエリア名・アパート名の多言語取得 util
 *
 * masterData.ts の `name` / `apartment_name` が `LocalizedString` ({ja, en, ko, zh})
 * になったため、 i18next の言語コードから適切な値を引くためのヘルパ。
 *
 * - 未対応言語コード (例: 'fr', 'de') が来た場合は `ja` にフォールバック
 *   (ja は必ず値が揃っている保証あり)
 * - region サブタグ (例: 'en-US') は primary subtag ('en') に正規化
 */
import { housingAreaMasterData, MASTER_LANGS, type MasterLang } from '../../data/masterData';
import type { HousingArea } from '../../types/housing';

export function toMasterLang(lang: string | undefined | null): MasterLang {
  if (!lang) return 'ja';
  const primary = lang.split('-')[0].toLowerCase();
  return (MASTER_LANGS as readonly string[]).includes(primary) ? (primary as MasterLang) : 'ja';
}

/** エリア正式名称を i18n 言語に応じて返す。 area が未知なら enum 値を素のまま返す。 */
export function getAreaName(area: HousingArea, lang: string | undefined | null): string {
  const data = housingAreaMasterData[area];
  if (!data) return area;
  return data.name[toMasterLang(lang)];
}

/** アパート (アパルトメント) 名称を i18n 言語に応じて返す。 area が未知なら空文字を返す。 */
export function getApartmentName(area: HousingArea, lang: string | undefined | null): string {
  const data = housingAreaMasterData[area];
  if (!data) return '';
  return data.apartment_name[toMasterLang(lang)];
}
