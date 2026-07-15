import { useMemo } from 'react';
import type { HousingListing } from '../../../types/housing';
import type { TourStep } from '../../../lib/housing/tourNav';
import { resolveWardMapRef } from '../../../lib/housing/resolveWardMapRef';
import { useWardMapAsset } from '../../../lib/housing/useWardMapAsset';
import { buildTourMapPlacements } from '../../../lib/housing/buildTourMapPlacements';
import { getPlotDirections } from '../../../lib/housing/wardDirections';
import { firestoreToGalleryListing } from '../../../lib/housing/galleryAdapter';
import { isAddressHidden } from '../../../lib/housing/listingPublish';
import { TourNavMap } from '../tour/TourNavMap';

/**
 * 詳細ページ用スタンドアロン地図 (Task2.1): TourNavPage の地図配線(pages/TourNavPage.tsx:71-103)を
 * 「1軒だけ」用に写したもの。ツアー中(currentIndex 等)の概念は無く、この listing 固定で常に
 * ステップ0として扱う。
 *
 * buildTourMapPlacements/TourStep は Firestore `HousingListing` ではなくギャラリー view-model
 * `MockListing`(region 等 denormalized フィールドを持つ)を要求するため、既存の
 * `firestoreToGalleryListing` アダプタ(useHousingDetail 等でも使用)で変換してから渡す。
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

  // 防御多重化 (§8.5・住所非公開): 呼び出し側の addressHidden ガードを万一忘れても unlisted は地図非表示。
  // rules-of-hooks 順守のため全 hook 実行後に判定する (早期 return を hook 前に置くと React #310 の温床)。
  // (unlisted は area/plot が窓口射影で undefined のため mapRef も引けず二重に落ちる)
  if (isAddressHidden(listing) || !mapRef) return null;

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
