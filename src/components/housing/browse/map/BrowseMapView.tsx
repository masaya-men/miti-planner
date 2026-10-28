import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../../data/housing/mockListings';
import { useHousingFilterStore } from '../../../../store/useHousingFilterStore';
import type { HousingArea } from '../../../../types/housing';
import { getAreaName } from '../../../../lib/housing/areaName';
import { pickRegionLocale } from '../../../../data/housing/regionMap';
import { displayWorldName } from '../../../../lib/housing/housingTerms';
import {
  groupListingsByMapSpot,
  AREA_MAP_KEY,
  type WardMapKind,
} from '../../../../lib/housing/browseMapSpots';
import {
  bestInArea,
  bestInDc,
  bestInServer,
  bestKindInWard,
  countServer,
  type MapIndexEntry,
  type MapSelection,
} from '../../../../lib/housing/browseMapIndex';
import { MapRail } from './MapRail';
import { BrowseWardMap } from './BrowseWardMap';
import { RoomListPanel } from './RoomListPanel';
import './BrowseMapView.css';

export interface BrowseMapViewProps {
  /** 左の絞り込み (サイズ・タグ・地域など) を適用済み。ただし DC / ワールドだけは外してある
   *  (案内板でワールドを選んでも他ワールドの件数が消えないように。DC・ワールドは store の選択で絞る)。 */
  listings: MockListing[];
  /** listings の件数索引 (BrowsePage が DC メニューと共有して一度だけ作る)。 */
  index: MapIndexEntry[];
  onAddToTour: (id: string) => void;
  /** DC 未選択のとき「DC を選ぶ」ボタンから DC メニューを開く。 */
  onOpenDcMenu: () => void;
}

/** 手動で選んだ位置。key = 選んだ時点の DC|ワールド (別のワールドに替わったら無効 → 最多へ戻る)。 */
interface Picked extends Omit<MapSelection, 'server'> {
  key: string;
}

/**
 * 探すページ 地図表示モードのコンテナ。
 * DC・ワールドは左の絞り込み (useHousingFilterStore の dc / servers) と同じものを使い、
 * 案内板での選択は store へ書き戻す (一覧へ戻っても条件が一致する)。
 * エリア・区・本街/拡張街はローカル state。ワールド/エリア/区を替えたら下位は件数最多へ自動選択する。
 */
export const BrowseMapView: React.FC<BrowseMapViewProps> = (props) => {
  const { listings, index, onAddToTour, onOpenDcMenu } = props;
  const { t, i18n } = useTranslation();
  const locale = pickRegionLocale(i18n.language);

  const dc = useHousingFilterStore((s) => s.dc);
  const servers = useHousingFilterStore((s) => s.servers);
  const setServerExclusive = useHousingFilterStore((s) => s.setServerExclusive);

  const [picked, setPicked] = useState<Picked | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // 大量部屋パネル (RoomListPanel) を開いているスポットの key。null = 閉じている (地図のみ表示)。
  const [panelSpotKey, setPanelSpotKey] = useState<string | null>(null);

  // 使うワールド: store で1つに絞れていてその DC に家があればそれ、無ければ DC 内で最多のワールド。
  const server = useMemo(() => {
    if (!dc) return null;
    if (servers.length === 1 && countServer(index, dc, servers[0]) > 0) return servers[0];
    return bestInDc(index, dc)?.server ?? null;
  }, [dc, servers, index]);

  // 描画と同じ値を左の絞り込みへ反映 (DC だけ選ばれていた/複数選択だった時も1つに揃う)。
  useEffect(() => {
    if (dc && server && !(servers.length === 1 && servers[0] === server)) setServerExclusive(server);
  }, [dc, server, servers, setServerExclusive]);

  const key = `${dc}|${server}`;
  const sel: MapSelection | null = useMemo(() => {
    if (!dc || !server) return null;
    if (picked && picked.key === key) return { server, area: picked.area, ward: picked.ward, kind: picked.kind };
    return bestInServer(index, dc, server);
  }, [dc, server, picked, key, index]);

  const selArea = sel?.area;
  const selWard = sel?.ward;
  const selKind = sel?.kind;
  // 場所が替わったら前の場所のカード/パネルは閉じる (spot key の名前空間が場所をまたいで衝突しうる)。
  useEffect(() => {
    setExpandedKey(null);
    setPanelSpotKey(null);
  }, [key, selArea, selWard, selKind]);

  // Esc で大量部屋パネルを閉じる (Esc はパネル優先)。
  useEffect(() => {
    if (!panelSpotKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelSpotKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelSpotKey]);

  const mapKey = sel ? (sel.kind === 'main' ? AREA_MAP_KEY[sel.area] : `${AREA_MAP_KEY[sel.area]}-sub`) : '';
  const spots = useMemo(() => {
    if (!sel || !dc) return [];
    const wardListings = listings.filter(
      (l) => l.dc === dc && l.server === sel.server && l.area === sel.area && l.ward === sel.ward,
    );
    return groupListingsByMapSpot(wardListings, mapKey);
  }, [listings, dc, sel, mapKey]);

  if (!dc || !sel) {
    return (
      <div className="housing-browse-map-view" data-testid="housing-browse-map-view">
        <div className="housing-empty-result" role="status">
          <div className="housing-empty-result-title">
            {t(dc ? 'housing.map.empty_world' : 'housing.map.nav.pick_dc')}
          </div>
          {dc ? null : (
            <button type="button" className="housing-empty-result-back" onClick={onOpenDcMenu}>
              {t('housing.map.nav.pick_dc_button')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const pick = (next: Omit<MapSelection, 'server'>) => setPicked({ key, ...next });

  const handleServer = (sv: string) => {
    // 下位 (エリア・区・種別) はそのワールドの最多へ。key が替わるので picked は自然に無効になる。
    setServerExclusive(sv);
  };
  const handleArea = (area: HousingArea) => {
    const b = bestInArea(index, dc, sel.server, area);
    if (b) pick({ area: b.area, ward: b.ward, kind: b.kind });
  };
  const handleWard = (ward: number) =>
    pick({ area: sel.area, ward, kind: bestKindInWard(index, dc, sel.server, sel.area, ward) });
  const handleKind = (kind: WardMapKind) => pick({ area: sel.area, ward: sel.ward, kind });

  // 複数スポット (listings>=2) のカードクリック/「N件を見る」で大量部屋パネルを開く。
  // ポップドカード (expandedKey) を閉じてから開くことで、Esc がパネル優先で閉じる状態にそろえる。
  const openPanel = (spotKey: string) => {
    setExpandedKey(null);
    setPanelSpotKey(spotKey);
  };
  const panelSpot = panelSpotKey ? (spots.find((s) => s.key === panelSpotKey) ?? null) : null;

  const here = [
    displayWorldName(dc, sel.server, locale),
    '/',
    getAreaName(sel.area, i18n.language),
    t('housing.map.ward_label', { ward: sel.ward }),
    t(`housing.map.${sel.kind}_tab`),
  ].join(' ');

  return (
    <div
      className="housing-browse-map-view"
      data-testid="housing-browse-map-view"
      data-map-kind={sel.kind}
    >
      <MapRail
        index={index}
        dc={dc}
        sel={sel}
        onServer={handleServer}
        onArea={handleArea}
        onWard={handleWard}
        onKind={handleKind}
      />
      <div className="housing-browse-map-main">
        <BrowseWardMap
          mapKey={mapKey}
          spots={spots}
          expandedKey={expandedKey}
          onExpand={setExpandedKey}
          onAddToTour={onAddToTour}
          onOpenPanel={openPanel}
        />
        <div className="housing-browse-map-here" data-testid="housing-map-here" aria-live="polite">
          {here}
        </div>
        {panelSpot && (
          <RoomListPanel
            spot={panelSpot}
            onClose={() => setPanelSpotKey(null)}
            onAddToTour={onAddToTour}
          />
        )}
      </div>
    </div>
  );
};
