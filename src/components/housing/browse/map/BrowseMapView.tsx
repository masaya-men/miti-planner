import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../../data/housing/mockListings';
import { useHousingFilterStore, type HousingArea } from '../../../../store/useHousingFilterStore';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import { findInitialWardTarget, type WardMapKind } from '../../../../lib/housing/browseMapSpots';
import { WorldSelectGate } from './WorldSelectGate';

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
 * 4. 操作列 (Task 6) + BrowseWardMap (Task 4) をここに配置する (現時点はプレースホルダ)。
 */
export const BrowseMapView: React.FC<BrowseMapViewProps> = (props) => {
  const { filtered } = props;
  const { t } = useTranslation();

  const servers = useHousingFilterStore((s) => s.servers);
  const setBrowseView = useHousingViewStore((s) => s.setBrowseView);
  const worldKey = servers.length === 1 ? servers[0] : null;

  const [area, setArea] = useState<HousingArea | null>(null);
  const [ward, setWard] = useState<number | null>(null);
  const [mapKind, setMapKind] = useState<WardMapKind>('main');
  // 直前にナビゲーション位置を初期化したワールド (同じワールド滞在中は再初期化しない)。
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  useEffect(() => {
    if (worldKey === null || initializedFor === worldKey) return;
    const target = findInitialWardTarget(filtered);
    setArea(target?.area ?? null);
    setWard(target?.ward ?? null);
    setMapKind('main');
    setInitializedFor(worldKey);
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

  return (
    // mapKind は Task 4 (BrowseWardMap) / Task 6 (操作列) が読み書きする。
    // ここでは container として state を保持するだけで、描画は次タスクで実装する。
    <div
      className="housing-browse-map-view"
      data-testid="housing-browse-map-view"
      data-map-kind={mapKind}
    >
      {/* 操作列 (Task 6) + BrowseWardMap (Task 4) はここに配置する */}
    </div>
  );
};
