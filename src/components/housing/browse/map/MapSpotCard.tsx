import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BrowseMapSpot } from '../../../../lib/housing/browseMapSpots';
import { representativeImage } from '../../../../lib/housing/representativeImage';
import { ListingCard } from '../ListingCard';

export interface MapSpotCardProps {
  spot: BrowseMapSpot;
  expanded: boolean;
  onExpand: (key: string | null) => void;
  onAddToTour: (id: string) => void;
  /** コンテナ右端/上端に近いとき true (Task4/6 が画面座標から算出して渡す)。
   *  吹き出しの向き (ミニカード) と展開方向 (拡大カード) を反転する。 */
  flip: { x: boolean; y: boolean };
}

/**
 * 地図マーカーの吹き出しミニカード ⇔ 拡大カード (spec §4.2/5.3、plan Task5)。
 *
 * 常時: 48px サムネ + ラベル + 件数バッジのミニカード (`button.housing-bmap-mini`)。
 * hover/focus/クリック/Enter で `onExpand(spot.key)` を呼び、expanded=true になったら
 * 既存 `ListingCard` をそのまま重ねて描画する (ロジックをフォークしない = ツアー追加/
 * ♡/詳細クリックが一覧と完全に同一の挙動になる)。拡大カードはミニカードの兄弟要素
 * (button の中に入れ子にしない = ListingCard 内部の button と入れ子ボタンになるのを避ける)。
 *
 * 位置決め (translate(sx,sy)) は親 (`.housing-bmap-marker-pos`、BrowseWardMap/Task4・
 * 配線は Task6) の責務。本コンポーネントはその原点 (0,0) を基準に
 * transform: translate(-50%, -100%) 系で自身をアンカーする。
 */
export const MapSpotCard: React.FC<MapSpotCardProps> = ({ spot, expanded, onExpand, onAddToTour, flip }) => {
  const { t } = useTranslation();
  const label =
    spot.kind === 'apart'
      ? t('housing.map.apartment_label')
      : t('housing.map.plot_label', { plot: spot.plot });
  const count = spot.listings.length;
  const flipX = flip.x ? 'true' : 'false';
  const flipY = flip.y ? 'true' : 'false';

  const expand = () => onExpand(spot.key);

  return (
    <>
      <button
        type="button"
        className="housing-bmap-mini"
        data-testid={`bmap-marker-${spot.key}`}
        aria-expanded={expanded}
        data-flip-x={flipX}
        data-flip-y={flipY}
        onMouseEnter={expand}
        onFocus={expand}
        onClick={(e) => {
          e.stopPropagation();
          expand();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.stopPropagation();
            expand();
          }
        }}
      >
        <span className="housing-bmap-mini-thumb">
          <img src={representativeImage(spot.representative)} alt="" loading="lazy" />
        </span>
        <span className="housing-bmap-marker-label">{label}</span>
        {count > 1 && <span className="housing-bmap-badge">×{count}</span>}
      </button>
      {/* マウント時のみ ListingCard を生成 (常時マウントしない = spec §5.3)。 */}
      {expanded && (
        <MapSpotExpanded spot={spot} onAddToTour={onAddToTour} onExpand={onExpand} flipX={flipX} flipY={flipY} />
      )}
    </>
  );
};

interface MapSpotExpandedProps {
  spot: BrowseMapSpot;
  onAddToTour: (id: string) => void;
  onExpand: (key: string | null) => void;
  flipX: 'true' | 'false';
  flipY: 'true' | 'false';
}

/** 拡大カード。expanded=true の間だけマウントされるので、index state はここに置くだけで
 *  開き直すたびに自然に 0 (代表 = 最新確認) へ戻る。 */
const MapSpotExpanded: React.FC<MapSpotExpandedProps> = ({ spot, onAddToTour, onExpand, flipX, flipY }) => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const total = spot.listings.length;

  // Esc で閉じる。このコンポーネント自体が expanded 時だけマウントされるため、
  // listener の付け外しがそのまま「開いている間だけ Esc を拾う」になる。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExpand(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExpand]);

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  return (
    <div
      className="housing-bmap-expanded"
      data-testid={`bmap-expanded-${spot.key}`}
      data-flip-x={flipX}
      data-flip-y={flipY}
      // 地図の空白クリック (Task4: onExpand(null)) がここでの操作に反応して即閉じないよう、
      // 拡大カード内のクリックは外へ伝播させない (BrowseWardMap.tsx のマーカー同様の防御)。
      onClick={(e) => e.stopPropagation()}
    >
      {total > 1 && (
        <div className="housing-bmap-expanded-nav">
          <button
            type="button"
            className="housing-bmap-expanded-nav-btn"
            aria-label={t('housing.map.spot_prev')}
            onClick={goPrev}
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <span className="housing-bmap-expanded-nav-label">
            {t('housing.map.spot_more', { index: index + 1, total })}
          </span>
          <button
            type="button"
            className="housing-bmap-expanded-nav-btn"
            aria-label={t('housing.map.spot_next')}
            onClick={goNext}
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <ListingCard listing={spot.listings[index]} onAddToTour={onAddToTour} />
    </div>
  );
};
