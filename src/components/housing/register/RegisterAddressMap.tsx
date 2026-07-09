import { useMemo } from 'react';
import type { RegisterAddressValues } from './RegisterSectionAddress';
import type { MockListing } from '../../../data/housing/mockListings';
import type { HousingArea, HousingSize } from '../../../types/housing';
import type { TourStep } from '../../../lib/housing/tourNav';
import { resolveWardMapRef } from '../../../lib/housing/resolveWardMapRef';
import { useWardMapAsset } from '../../../lib/housing/useWardMapAsset';
import { buildTourMapPlacements } from '../../../lib/housing/buildTourMapPlacements';
import { getPlotDirections } from '../../../lib/housing/wardDirections';
import { regionForDC } from '../../../data/housing/dcServerMap';
import { TourNavMap } from '../tour/TourNavMap';

/**
 * 登録/編集ページ右カラムの住所プレビュー地図 (#5)。
 *
 * 旧 WardMapPreview (静的ミニマップ + 発光マーカー) を、ツアーの「動くマップ」(TourNavMap) に
 * 統一する。詳細ページ HousingDetailMap と同じ配線だが、保存済み listing ではなく
 * 入力中の住所フィールド (RegisterAddressValues) から合成 listing を組んで駆動する
 * (create=入力途中の住所 / edit=listing 由来の初期値。どちらも address state を単一入力にできる)。
 *
 * 地図の配置・経路に必要なのは area / plot / buildingType / apartmentBuilding のみ
 * (buildTourMapPlacements 参照)。region/size/画像は配置に使わないため、型を満たす最小限の
 * 合成値で埋める。住所が地図解決できないうち (area 未確定 / plot 未入力等) は何も出さない。
 */
export const RegisterAddressMap: React.FC<{ address: RegisterAddressValues }> = ({ address }) => {
  const { dc, server, area, ward, buildingType, plot, size, apartmentBuilding, roomNumber } = address;

  const mapRef = useMemo(
    () => resolveWardMapRef(area ?? '', plot ?? null, apartmentBuilding ?? null, buildingType),
    [area, plot, apartmentBuilding, buildingType],
  );
  const asset = useWardMapAsset(mapRef?.mapKey ?? null);
  const directions = useMemo(() => getPlotDirections(area ?? '', plot), [area, plot]);

  // 住所から地図配置に必要な最小限の合成 listing。region/size/画像は配置に使わないため
  // 型を満たすだけの値で埋める (region は regionForDC 不能なら 'JP' でフィル・配置に未使用)。
  const galleryListing = useMemo<MockListing | null>(() => {
    if (!area) return null;
    return {
      id: 'register-preview',
      ownerUid: 'preview',
      dc: dc ?? '',
      server: server ?? '',
      region: (dc ? regionForDC(dc) : null) ?? 'JP',
      area: area as HousingArea,
      ward: ward ?? 0,
      buildingType: buildingType ?? 'house',
      plot,
      size: size as HousingSize | undefined,
      apartmentBuilding,
      roomNumber,
      imageMode: 'none',
      tags: [],
      createdAt: 0,
      lastConfirmedAt: 0,
      addressKey: 'register-preview',
    };
  }, [dc, server, area, ward, buildingType, plot, size, apartmentBuilding, roomNumber]);

  const steps = useMemo<TourStep[]>(
    () => (galleryListing ? [{ id: galleryListing.id, listing: galleryListing }] : []),
    [galleryListing],
  );
  const model = useMemo(
    () =>
      asset.status === 'ready' && mapRef && galleryListing
        ? buildTourMapPlacements(asset.json, mapRef.mapKey, mapRef, galleryListing, steps, 0)
        : null,
    [asset, mapRef, galleryListing, steps],
  );

  if (!mapRef) return null; // 住所が地図解決できないうちは非表示

  const status: 'loading' | 'ready' | 'error' =
    asset.status === 'ready' ? 'ready' : asset.status === 'error' ? 'error' : 'loading';

  return (
    <div className="housing-register-map-preview" data-testid="housing-register-map-preview">
      <TourNavMap
        status={status}
        svg={asset.status === 'ready' ? asset.svg : null}
        viewBox={asset.status === 'ready' ? asset.json.viewBox : null}
        model={model}
        // 同一ワード地図内の plot 変更は背景更新 (dip なし)、別ワード地図へは dip 演出。
        stepKey={mapRef.mapKey}
        originName={directions?.aetheryte ?? model?.originName ?? null}
      />
    </div>
  );
};
