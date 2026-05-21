import type { HousingListing } from '../../types/housing';
import type { MockListing } from '../../data/housing/mockListings';
import { regionForDC } from '../../data/housing/dcServerMap';

/**
 * Firestore `HousingListing` → ギャラリー表示用 view-model (`MockListing` 形)。
 *
 * - `region` は `dc` から `regionForDC` で導出 (マップに無い dc は変換不可)。
 * - 一覧カード/マップは `plot`・`size` を前提にするため、欠損レコード (個室・アパート等) は除外。
 * - 変換不可の場合は `null` を返し、呼び出し側でフィルタする。
 * - `createdAt` は number 設計だが、Firestore Timestamp が来た場合に備え `toMillis()` を許容。
 */
export function firestoreToGalleryListing(h: HousingListing): MockListing | null {
  const region = regionForDC(h.dc);
  if (region === null) return null;
  if (h.plot === undefined || h.size === undefined) return null;

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
    plot: h.plot,
    size: h.size,
    imageMode: h.imageMode,
    postUrl: h.postUrl,
    ogImageUrl: h.ogImageUrl,
    thumbnailPath: h.thumbnailPath,
    tags: h.tags ?? [],
    description: h.description,
    createdAt,
  };
}
