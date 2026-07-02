import type { HousingExtractSize } from './parseHousingFromText';

/**
 * parseHousingFromText が返す `size?: HousingExtractSize` (S/M/L/Apartment/PrivateRoom) を、
 * Task10 の RegisterSectionAddress が採用する buildingType/roomKind/size モデル
 * (`src/utils/housingValidation.ts` の validateAddress と同じ場合分け) に変換する純関数。
 *
 * - 'Apartment'    → { buildingType: 'apartment', roomKind: 'apartment_room' } (size フィールドなし)
 * - 'PrivateRoom'  → { buildingType: 'house', roomKind: 'private_chamber' }
 * - 'S' | 'M' | 'L' → { buildingType: 'house', size } (size をそのまま渡す)
 *
 * dc/server/area/ward/plot/roomNumber はこの関数を通さず、 parseHousingFromText の結果を
 * そのまま fieldState.setAutoFilled へ渡す (このファイルは size フィールドの変換専用)。
 */
export interface ExtractSizeAddressFields {
  buildingType: 'house' | 'apartment';
  roomKind?: 'private_chamber' | 'apartment_room';
  size?: 'S' | 'M' | 'L';
}

export function extractSizeToAddress(size: HousingExtractSize): ExtractSizeAddressFields {
  switch (size) {
    case 'Apartment':
      return { buildingType: 'apartment', roomKind: 'apartment_room' };
    case 'PrivateRoom':
      return { buildingType: 'house', roomKind: 'private_chamber' };
    case 'S':
    case 'M':
    case 'L':
      return { buildingType: 'house', size };
  }
}
