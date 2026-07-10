import type { MockListing } from '../../../../data/housing/mockListings';

export interface BrowseMapViewProps {
  filtered: MockListing[];
  onAddToTour: (id: string) => void;
}

/**
 * 探すページ 地図表示モードのコンテナ (プレースホルダ)。
 * ワールド選択ゲート / 地図本体 / 操作列は Task 3〜6 で実装する (spec 3.2〜3.4, 4)。
 * ここでは BrowsePage との配線 (props 形状) だけを整える。
 */
export const BrowseMapView: React.FC<BrowseMapViewProps> = () => {
  return (
    <div
      className="housing-browse-map-view"
      data-testid="housing-browse-map-view"
    />
  );
};
