import type { TourSnapshot } from '../../types/sharedTour';
import type { MockListing } from '../../data/housing/mockListings';

/** 値が undefined のキーを落とす（Firestore は undefined を受け付けないため書き込み前に必須）。 */
function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) {
      out[key] = obj[key];
    }
  }
  return out;
}

/** 幹事の MockListing 1件を参加者配布用の TourSnapshot に縮約する（ownerUid 等は写さない）。 */
export function toTourSnapshot(listing: MockListing): TourSnapshot {
  return omitUndefined({
    id: listing.id,
    area: listing.area,
    ward: listing.ward,
    buildingType: listing.buildingType,
    plot: listing.plot,
    size: listing.size,
    apartmentBuilding: listing.apartmentBuilding,
    roomNumber: listing.roomNumber,
    roomKind: listing.roomKind,
    dc: listing.dc,
    server: listing.server,
    region: listing.region,
    imageMode: listing.imageMode,
    postUrl: listing.postUrl,
    ogImageUrl: listing.ogImageUrl,
    sourceImageUrls: listing.sourceImageUrls,
    sourceImageAspectRatios: listing.sourceImageAspectRatios,
    youtubeVideoId: listing.youtubeVideoId,
    videoUrl: listing.videoUrl,
    videoPosterUrl: listing.videoPosterUrl,
    videoAspectRatio: listing.videoAspectRatio,
    thumbnailPath: listing.thumbnailPath,
    thumbnailPaths: listing.thumbnailPaths,
    title: listing.title,
    description: listing.description,
    tags: listing.tags,
    visibility: listing.visibility,
  });
}

/** orderedIds の順序で pool から該当 MockListing を集め、TourSnapshot に縮約する。pool に無い id は捨てる。 */
export function buildTourSnapshots(orderedIds: string[], pool: MockListing[]): TourSnapshot[] {
  return orderedIds
    .map(id => pool.find(p => p.id === id))
    .filter((listing): listing is MockListing => listing !== undefined)
    .map(toTourSnapshot);
}

/** スナップショット群に非公開（unlisted/private）住所が1件でも含まれるか判定する。 */
export function snapshotContainsHiddenAddress(snaps: TourSnapshot[]): boolean {
  return snaps.some(s => s.visibility && s.visibility !== 'public');
}
