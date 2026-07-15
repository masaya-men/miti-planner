import type { TourSnapshot } from '../../types/sharedTour';
import type { MockListing } from '../../data/housing/mockListings';
import type { HousingArea, HousingSize } from '../../store/useHousingFilterStore';
import type { Region } from '../../data/housing/dcServerMap';

/**
 * 参加者側の TourSnapshot(幹事が発行した縮約データ)を、useTourRenderModel が期待する
 * MockListing 形へ写す(幹事側 toTourSnapshot(snapshot.ts) の逆写像)。
 *
 * ownerUid/createdAt/lastConfirmedAt は参加者には配布されず表示にも使わないためダミー値で埋める。
 * region/area/size は TourSnapshot では string 幅の optional だが、元は実 MockListing 由来の値
 * (幹事が toTourSnapshot で書き出したもの)なので、MockListing の enum 型へキャストして安全。
 */
export function snapshotToPoolListing(snap: TourSnapshot): MockListing {
  return {
    id: snap.id,
    ownerUid: '',
    dc: snap.dc,
    server: snap.server,
    region: snap.region as Region | undefined,
    area: snap.area as HousingArea | undefined,
    ward: snap.ward,
    buildingType: snap.buildingType,
    plot: snap.plot,
    size: snap.size as HousingSize | undefined,
    apartmentBuilding: snap.apartmentBuilding,
    roomNumber: snap.roomNumber,
    roomKind: snap.roomKind,
    imageMode: snap.imageMode ?? 'none',
    postUrl: snap.postUrl,
    ogImageUrl: snap.ogImageUrl,
    thumbnailPath: snap.thumbnailPath,
    thumbnailPaths: snap.thumbnailPaths,
    sourceImageUrls: snap.sourceImageUrls,
    sourceImageAspectRatios: snap.sourceImageAspectRatios,
    youtubeVideoId: snap.youtubeVideoId,
    videoUrl: snap.videoUrl,
    videoPosterUrl: snap.videoPosterUrl,
    videoAspectRatio: snap.videoAspectRatio,
    tags: snap.tags ?? [],
    description: snap.description,
    title: snap.title,
    visibility: snap.visibility,
    createdAt: 0,
    lastConfirmedAt: 0,
  };
}
