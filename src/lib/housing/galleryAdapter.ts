import type { HousingListing } from '../../types/housing';
import type { MockListing } from '../../data/housing/mockListings';
import { regionForDC } from '../../data/housing/dcServerMap';

/**
 * Firestore `HousingListing` → ギャラリー表示用 view-model (`MockListing` 形)。
 *
 * - `region` は `dc` から `regionForDC` で導出 (マップに無い dc は変換不可)。
 * - `buildingType` 別に必須フィールドを検証して通す:
 *   - house: plot + size 必須
 *   - apartment: apartmentBuilding + roomNumber 必須 (2026-05-27 追加)
 * - 変換不可の場合は `null` を返し、呼び出し側でフィルタする。
 * - `createdAt` は number 設計だが、Firestore Timestamp が来た場合に備え `toMillis()` を許容。
 */
export function firestoreToGalleryListing(h: HousingListing): MockListing | null {
  const region = regionForDC(h.dc);
  if (region === null) return null;

  if (h.buildingType === 'house') {
    if (h.plot === undefined || h.size === undefined) return null;
  } else if (h.buildingType === 'apartment') {
    if (h.apartmentBuilding === undefined || h.roomNumber === undefined) return null;
  } else {
    return null;
  }

  const raw = h.createdAt as unknown;
  const createdAt =
    typeof raw === 'number'
      ? raw
      : typeof (raw as { toMillis?: () => number })?.toMillis === 'function'
        ? (raw as { toMillis: () => number }).toMillis()
        : 0;

  return {
    id: h.id,
    ownerUid: h.ownerUid,
    dc: h.dc,
    server: h.server,
    region,
    area: h.area,
    ward: h.ward,
    buildingType: h.buildingType,
    plot: h.plot,
    size: h.size,
    apartmentBuilding: h.apartmentBuilding,
    roomNumber: h.roomNumber,
    imageMode: h.imageMode,
    postUrl: h.postUrl,
    ogImageUrl: h.ogImageUrl,
    thumbnailPath: h.thumbnailPath,
    tags: h.tags ?? [],
    description: h.description,
    createdAt,
  };
}
