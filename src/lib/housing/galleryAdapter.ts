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

  // 2026-05-27: buildingType 未定義の旧データは house 扱いで後方互換 (Phase 1 〜 Phase 3 初期の listing)
  if (h.buildingType === 'apartment') {
    if (h.apartmentBuilding === undefined || h.roomNumber === undefined) return null;
  } else {
    if (h.plot === undefined || h.size === undefined) return null;
  }

  const raw = h.createdAt as unknown;
  const createdAt =
    typeof raw === 'number'
      ? raw
      : typeof (raw as { toMillis?: () => number })?.toMillis === 'function'
        ? (raw as { toMillis: () => number }).toMillis()
        : 0;

  // 2026-05-27 (Phase 2-1): 既存 listing は lastConfirmedAt を持たないので createdAt で
  // fallback (= 「登録した瞬間に確認済」 と意味づけ)。 α 公開前のコールドスタートで全件
  // 消えるので、 この fallback はコールドスタート後は実質使われない。
  const lastConfirmedAtRaw = (h as { lastConfirmedAt?: unknown }).lastConfirmedAt;
  const lastConfirmedAt =
    typeof lastConfirmedAtRaw === 'number'
      ? lastConfirmedAtRaw
      : typeof (lastConfirmedAtRaw as { toMillis?: () => number })?.toMillis === 'function'
        ? (lastConfirmedAtRaw as { toMillis: () => number }).toMillis()
        : createdAt;

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
    // 2026-05-27 追加: card 一覧の ambient slideshow + 動画オーバーレイ用に pass-through
    thumbnailPaths: h.thumbnailPaths,
    sourceImageUrls: h.sourceImageUrls,
    youtubeVideoId: h.youtubeVideoId,
    videoUrl: h.videoUrl,
    videoPosterUrl: h.videoPosterUrl,
    videoAspectRatio: h.videoAspectRatio,
    tags: h.tags ?? [],
    description: h.description,
    createdAt,
    lastConfirmedAt,
    // 2026-05-27 (Phase 2-5 配線漏れ修正): 同住所判定用キーを pass-through。
    // sortListingsForGallery / 重複バッジ判定で使う。
    addressKey: h.addressKey,
  };
}
