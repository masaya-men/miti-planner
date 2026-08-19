import type { HousingExtractResult } from './parseHousingFromText';
import type { RegisterAddressValues } from '../../components/housing/register/RegisterSectionAddress';
import { isValidHousingArea } from '../../types/housing';

/**
 * `HousingExtractResult` (URL本文からの解析結果) を住所フォームの patch に変換する。
 * `EphemeralAddPanel.applyParse` からロジックを抽出 (2026-08-19、Allmarksまとめてインポート
 * 機能で同じ変換をループ内で使うため。単発追加・バッチ追加どちらでも判定基準が
 * ずれないよう、この1箇所だけに変換ルールを持たせる)。
 *
 * 曖昧 (`ambiguity.length > 0`) または何も取れなかった場合は null (呼び出し側は
 * 「住所を読み取れませんでした」扱いにする。推測で埋めない方針は不変)。
 */
export function housingExtractResultToAddressPatch(r: HousingExtractResult): RegisterAddressValues | null {
  const gotSomething =
    r.area !== undefined || r.ward !== undefined || r.plot !== undefined || r.size !== undefined;
  if (r.ambiguity.length > 0 || !gotSomething) return null;

  const isApartment = r.size === 'Apartment';
  const patch: RegisterAddressValues = {};
  if (r.area !== undefined && isValidHousingArea(r.area)) patch.area = r.area;
  if (r.ward !== undefined) patch.ward = r.ward;
  if (r.dc !== undefined) patch.dc = r.dc;
  if (r.server !== undefined) patch.server = r.server;
  if (isApartment) {
    patch.buildingType = 'apartment';
    patch.apartmentBuilding = 1;
    patch.roomKind = 'apartment_room';
  } else {
    patch.buildingType = 'house';
    if (r.plot !== undefined) patch.plot = r.plot;
    if (r.size === 'S' || r.size === 'M' || r.size === 'L') patch.size = r.size;
  }
  return patch;
}
