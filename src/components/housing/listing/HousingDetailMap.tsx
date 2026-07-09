import { useMemo } from 'react';
import type { HousingListing } from '../../../types/housing';
import type { TourStep } from '../../../lib/housing/tourNav';
import { resolveWardMapRef } from '../../../lib/housing/resolveWardMapRef';
import { useWardMapAsset } from '../../../lib/housing/useWardMapAsset';
import { buildTourMapPlacements } from '../../../lib/housing/buildTourMapPlacements';
import { getPlotDirections } from '../../../lib/housing/wardDirections';
import { firestoreToGalleryListing } from '../../../lib/housing/galleryAdapter';
import { TourNavMap } from '../tour/TourNavMap';

/**
 * 詳細ページ用スタンドアロン地図 (Task2.1): TourNavPage の地図配線(pages/TourNavPage.tsx:71-103)を
 * 「1軒だけ」用に写したもの。ツアー中(currentIndex 等)の概念は無く、この listing 固定で常に
 * ステップ0として扱う。
 *
 * buildTourMapPlacements/TourStep は Firestore `HousingListing` ではなくギャラリー view-model
 * `MockListing`(region 等 denormalized フィールドを持つ)を要求するため、既存の
 * `firestoreToGalleryListing` アダプタ(HousingDetailModalRoute 等でも使用)で変換してから渡す。
 * 変換できない(dc が region に解決できない等)listing でも、mapRef 自体は住所の生値から
 * 解決できるため、経路無しでも実箱ハイライトだけは描画されうる(buildTourMapPlacements は
 * currentListing=null を許容する設計)。
 */
export const HousingDetailMap: React.FC<{ listing: HousingListing }> = ({ listing }) => {
  const directions = useMemo(() => getPlotDirections(listing.area, listing.plot), [listing]);
  const mapRef = useMemo(
    () =>
      resolveWardMapRef(
        listing.area,
        listing.plot ?? null,
        listing.apartmentBuilding ?? null,
        listing.buildingType,
      ),
    [listing],
  );
  const asset = useWardMapAsset(mapRef?.mapKey ?? null);

  const galleryListing = useMemo(() => firestoreToGalleryListing(listing), [listing]);
  // TourNavPage と同じ形(steps + currentIndex)だが、この1軒だけを steps[0] として扱う。
  const steps = useMemo<TourStep[]>(
    () => (galleryListing ? [{ id: galleryListing.id, listing: galleryListing }] : []),
    [galleryListing],
  );
  const model = useMemo(
    () =>
      asset.status === 'ready' && mapRef
        ? buildTourMapPlacements(asset.json, mapRef.mapKey, mapRef, galleryListing, steps, 0)
        : null,
    [asset, mapRef, galleryListing, steps],
  );

  if (!mapRef) return null; // 引けない物件は地図ブロックごと非表示

  const status: 'loading' | 'ready' | 'error' =
    asset.status === 'ready' ? 'ready' : asset.status === 'error' ? 'error' : 'loading';

  return (
    <TourNavMap
      status={status}
      svg={asset.status === 'ready' ? asset.svg : null}
      viewBox={asset.status === 'ready' ? asset.json.viewBox : null}
      model={model}
      stepKey={0}
      originName={directions?.aetheryte ?? model?.originName ?? null}
    />
  );
};
