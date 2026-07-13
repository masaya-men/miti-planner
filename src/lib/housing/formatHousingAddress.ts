/**
 * 物件住所の表記組み立て (house / apartment 分岐 + 多言語対応)
 *
 * 2026-05-27 アパート対応で新設。
 * 住所文字列は area / ward / buildingType によってフォーマットが変わるため、
 * 表示コンポーネントから直接組み立てず必ずこの util を介す (一貫性確保)。
 *
 * 表示例:
 * - house (ja): "ミスト・ヴィレッジ 23-6"
 * - house (en): "Mist 23-6"
 * - apartment (ja): "ミスト・ヴィレッジ 23区 トップマスト1号棟 #15"
 * - apartment (en): "Mist W23 The Topmast Bldg.1 #15"
 *
 * `compact` は MapBubbleCard 等の幅制約があるカード用に area 名を切り詰めた変種。
 */
import type { HousingArea } from '../../types/housing';
import { getAreaName, getApartmentName, toMasterLang } from './areaName';
import type { Region } from '../../data/housing/dcServerMap';
import { regionLabel, pickRegionLocale } from '../../data/housing/regionMap';

export interface AddressViewModel {
  area: HousingArea;
  ward: number;
  buildingType?: 'house' | 'apartment';
  plot?: number;
  apartmentBuilding?: 1 | 2;
  roomNumber?: number;
}

/** DC / ワールド / リージョンまで含めた完全住所を組み立てるための view-model。 */
export interface FullAddressViewModel extends AddressViewModel {
  region: Region;
  dc: string;
  server: string;
}

const COMPACT_AREA_MAX_CHARS = 6;

/** カード表題・詳細画面ヘッダ用のフル住所表記。 */
export function formatHousingAddress(
  addr: AddressViewModel,
  lang: string | undefined | null,
): string {
  const masterLang = toMasterLang(lang);
  const areaName = getAreaName(addr.area, masterLang);

  if (
    addr.buildingType === 'apartment'
    && (addr.apartmentBuilding === 1 || addr.apartmentBuilding === 2)
    && addr.roomNumber !== undefined
  ) {
    const aptName = getApartmentName(addr.area, masterLang);
    if (masterLang === 'en') {
      return `${areaName} W${addr.ward} ${aptName} Bldg.${addr.apartmentBuilding} #${addr.roomNumber}`;
    }
    return `${areaName} ${addr.ward}区 ${aptName}${addr.apartmentBuilding}号棟 #${addr.roomNumber}`;
  }

  if (addr.plot !== undefined) {
    return `${areaName} ${addr.ward}-${addr.plot}`;
  }
  return `${areaName} ${addr.ward}`;
}

/**
 * リージョン / DC / ワールド + area+ward+plot を ` / ` 区切りで並べた完全住所。
 * 例: "オセアニア / Materia / Bismarck / シロガネ 6-6"
 *
 * - リージョン部のみ locale 対応 (regionLabel)。dc / server は生文字列 (ローカライズ対象外)。
 * - area+ward+plot / apartment 部分は既存 formatHousingAddress をそのまま流用 (house/apartment 分岐込み)。
 *   → 既存の挙動を変えず、前置きの「リージョン / DC / ワールド」だけを合成する。
 * ツアーステップ・カード等、どの鯖のどの家かを一目で示したい箇所で使う。
 */
export function formatFullHousingAddress(
  addr: FullAddressViewModel,
  lang: string | undefined | null,
): string {
  const region = regionLabel(addr.region, pickRegionLocale(lang ?? 'ja'));
  const local = formatHousingAddress(addr, lang);
  return `${region} / ${addr.dc} / ${addr.server} / ${local}`;
}

/** MapBubbleCard 等の狭いラベル用。 area 名を先頭数文字で省略。 */
export function formatHousingAddressCompact(
  addr: AddressViewModel,
  lang: string | undefined | null,
): string {
  const masterLang = toMasterLang(lang);
  const areaName = getAreaName(addr.area, masterLang);
  const shortArea =
    areaName.length > COMPACT_AREA_MAX_CHARS ? areaName.slice(0, COMPACT_AREA_MAX_CHARS) : areaName;

  if (
    addr.buildingType === 'apartment'
    && (addr.apartmentBuilding === 1 || addr.apartmentBuilding === 2)
    && addr.roomNumber !== undefined
  ) {
    const aptName = getApartmentName(addr.area, masterLang);
    if (masterLang === 'en') {
      return `${shortArea} W${addr.ward} ${aptName} #${addr.roomNumber}`;
    }
    return `${shortArea} ${addr.ward} ${aptName}${addr.apartmentBuilding} #${addr.roomNumber}`;
  }

  if (addr.plot !== undefined) {
    return `${shortArea} ${addr.ward}-${addr.plot}`;
  }
  return `${shortArea} ${addr.ward}`;
}

/** aria-label / 画像 alt 用の短いテキスト (常に英数 + 数字)、 i18n 不要 */
export function formatHousingAddressAria(addr: AddressViewModel): string {
  if (
    addr.buildingType === 'apartment'
    && (addr.apartmentBuilding === 1 || addr.apartmentBuilding === 2)
    && addr.roomNumber !== undefined
  ) {
    return `${addr.area} W${addr.ward} Apt Bldg${addr.apartmentBuilding} #${addr.roomNumber}`;
  }
  if (addr.plot !== undefined) {
    return `${addr.area} ${addr.ward}-${addr.plot}`;
  }
  return `${addr.area} ${addr.ward}`;
}
