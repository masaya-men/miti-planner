import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../../data/housing/mockListings';
import { useHousingFilterStore, type HousingArea } from '../../../../store/useHousingFilterStore';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import {
  findInitialWardTarget,
  selectWardListings,
  countListingsByWard,
  countListingsByMapKind,
  groupListingsByMapSpot,
  AREA_MAP_KEY,
  type WardMapKind,
} from '../../../../lib/housing/browseMapSpots';
import { WorldSelectGate } from './WorldSelectGate';
import { MapControls, autoSelectMapKind } from './MapControls';
import { BrowseWardMap } from './BrowseWardMap';

export interface BrowseMapViewProps {
  filtered: MockListing[];
  onAddToTour: (id: string) => void;
}

/**
 * 探すページ 地図表示モードのコンテナ (spec §3.2〜3.4, 4)。
 *
 * 責務:
 * 1. servers が1件に絞られていなければ WorldSelectGate で止める。
 * 2. 1件に絞れていれば、地図の対象 listing = filtered (一覧と同じフィルタ結果。地図側で独自緩和しない)。
 * 3. area/ward/mapKind のローカル state を持ち、ワールドが新しく確定するたび
 *    findInitialWardTarget(filtered) で最多件数の区へジャンプする (null = 0件 → 空状態)。
 * 4. 操作列 (MapControls) + BrowseWardMap を配置し、area/ward/mapKind の変更を一元管理する。
 */
export const BrowseMapView: React.FC<BrowseMapViewProps> = (props) => {
  const { filtered, onAddToTour } = props;
  const { t } = useTranslation();

  const servers = useHousingFilterStore((s) => s.servers);
  const setBrowseView = useHousingViewStore((s) => s.setBrowseView);
  const worldKey = servers.length === 1 ? servers[0] : null;

  const [area, setArea] = useState<HousingArea | null>(null);
  const [ward, setWard] = useState<number | null>(null);
  const [mapKind, setMapKind] = useState<WardMapKind>('main');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // 直前にナビゲーション位置を初期化したワールド (同じワールド滞在中は再初期化しない)。
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  // 指定 area×ward の kindCounts (main/sub 別件数)。mapKind の自動選択 (初期表示・area/ward 変更の
  // どちらも) はこれを autoSelectMapKind に通して決める。フックではないので早期 return の前後どちらでも呼べる。
  const kindCountsFor = (targetArea: HousingArea, targetWard: number) =>
    countListingsByMapKind(selectWardListings(filtered, targetArea, targetWard));

  useEffect(() => {
    if (worldKey === null || initializedFor === worldKey) return;
    const target = findInitialWardTarget(filtered);
    setArea(target?.area ?? null);
    setWard(target?.ward ?? null);
    // 初期表示 = 「登録件数が最多の住宅街×区」(spec 3.4) が実際に賑わって見えるよう、
    // その区の main/sub のうち件数が多い側を初期 mapKind にする (単純に 'main' 固定にすると、
    // 最多件数が拡張街側に偏っている場合に初期表示のマーカーが0件になってしまう)。
    setMapKind(target ? autoSelectMapKind(kindCountsFor(target.area, target.ward)) : 'main');
    setExpandedKey(null); // ワールド切替で spot 集合が丸ごと変わるため、前ワールドの拡大カードは閉じる
    setInitializedFor(worldKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldKey, initializedFor, filtered]);

  if (servers.length !== 1) {
    return (
      <div className="housing-browse-map-view" data-testid="housing-browse-map-view">
        <WorldSelectGate />
      </div>
    );
  }

  if (area === null || ward === null) {
    return (
      <div className="housing-browse-map-view" data-testid="housing-browse-map-view">
        <div className="housing-empty-result" role="status">
          <div className="housing-empty-result-title">{t('housing.map.empty_world')}</div>
          <button
            type="button"
            className="housing-empty-result-back"
            onClick={() => setBrowseView('list')}
          >
            {t('housing.map.back_to_list')}
          </button>
        </div>
      </div>
    );
  }

  // ここから先、area/ward は上の早期 return で非 null に確定している (TS の narrowing がそのまま効く)。

  const wardCounts = countListingsByWard(filtered, area);
  const wardListings = selectWardListings(filtered, area, ward);
  const kindCounts = countListingsByMapKind(wardListings);
  const mapKey = mapKind === 'main' ? AREA_MAP_KEY[area] : `${AREA_MAP_KEY[area]}-sub`;
  const spots = groupListingsByMapSpot(wardListings, mapKey);

  // area/ward 変更時も同じ kindCountsFor (上で定義済み) で件数が多い側へ mapKind を自動セットする
  // (plan Task6:「area/ward 変更時: mapKind は件数が多い側へ自動セット (両方0なら main)」)。
  const handleAreaChange = (newArea: HousingArea) => {
    setArea(newArea);
    setMapKind(autoSelectMapKind(kindCountsFor(newArea, ward)));
    setExpandedKey(null);
  };
  const handleWardChange = (newWard: number) => {
    setWard(newWard);
    setMapKind(autoSelectMapKind(kindCountsFor(area, newWard)));
    setExpandedKey(null);
  };
  const handleKindChange = (newKind: WardMapKind) => {
    // spot.key (`plot:5` 等) はマップ間で名前空間が分かれていないため、切替後に旧マップの
    // expandedKey が新マップの別スポットへ偶然一致すると誤ったカードが開いたままになる。
    // ブリーフ本文は ward/area 変更時のリセットのみ明記しているが、同じ理由でここもリセットする。
    setMapKind(newKind);
    setExpandedKey(null);
  };

  return (
    <div
      className="housing-browse-map-view"
      data-testid="housing-browse-map-view"
      data-map-kind={mapKind}
    >
      <MapControls
        area={area}
        ward={ward}
        mapKind={mapKind}
        wardCounts={wardCounts}
        kindCounts={kindCounts}
        onAreaChange={handleAreaChange}
        onWardChange={handleWardChange}
        onKindChange={handleKindChange}
      />
      <BrowseWardMap
        mapKey={mapKey}
        spots={spots}
        expandedKey={expandedKey}
        onExpand={setExpandedKey}
        onAddToTour={onAddToTour}
      />
    </div>
  );
};
