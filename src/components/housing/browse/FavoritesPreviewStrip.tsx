import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Heart } from 'lucide-react';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import type { MockListing } from '../../../data/housing/mockListings';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { HousingCardAmbientSlideshow } from '../workspace/HousingCardAmbientSlideshow';

// 代表画像フォールバック (ListingCard と共通の規約)。
const PLACEHOLDER = '/housing/mock-thumbs/1.svg';
function representativeImage(l: MockListing): string {
  if (l.imageMode === 'thumbnail' && l.thumbnailPath) return l.thumbnailPath;
  if (l.imageMode === 'sns' && l.ogImageUrl) return l.ogImageUrl;
  return PLACEHOLDER;
}

/**
 * プレビュー strip の 1 サムネ (画像のみの生きたカード)。
 * isVideo=false で呼ぶ = spotlight 動画候補に入れない (strip は画像クロスフェードのみ)。
 * ambientOn は Provider 由来 (Provider 外なら NOOP で静止)。
 */
const FavPreviewThumb: React.FC<{ listing: MockListing }> = ({ listing }) => {
  const { ambientOn } = useHousingCardPlayback(listing.id, false);
  const frames = useHousingCardFrames(listing, ambientOn);
  return (
    <>
      <img src={representativeImage(listing)} alt="" loading="lazy" />
      <HousingCardAmbientSlideshow frames={frames} enabled={ambientOn} />
    </>
  );
};

// プレビューに並べる最大枚数 (これ以上はお気に入りページ「すべて見る」で)。
// 3件を超えると横スクロール + 4件目の見切れでスクロール可能を示唆する。
const MAX_THUMBS = 12;

/**
 * 探すページ右カラムのお気に入りプレビュー (参考UI準拠)。
 * 直近のお気に入りサムネを横一列で + 「すべて見る」でお気に入りページへ。
 * 3件超は横スクロール (ホイールでも横送り・4件目が見切れてスクロールを示唆)。
 * お気に入りが無いときは軽い誘導文。
 */
export const FavoritesPreviewStrip: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const favoriteIds = useHousingFavoritesStore((s) => s.ids);
  const listings = useHousingListingsStore((s) => s.listings);
  const listRef = useRef<HTMLUListElement>(null);

  // 新しい順 (add で末尾 push) で数枚。
  const recent = [...favoriteIds]
    .reverse()
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is MockListing => Boolean(l));
  const thumbs = recent.slice(0, MAX_THUMBS);

  // ストリップ上のホイールを横スクロールに変換する (横溢れがある時だけ・縦ページ送りは妨げない)。
  // React onWheel は passive で preventDefault が効かないためネイティブ登録。
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [thumbs.length]);

  return (
    <section className="housing-fav-strip">
      <div className="housing-fav-strip-head">
        <span className="housing-fav-strip-title">
          <Heart size={13} aria-hidden="true" />
          {t('housing.favStrip.title')}
          <span className="housing-fav-strip-count">{favoriteIds.length}</span>
        </span>
        <button
          type="button"
          className="housing-fav-strip-more"
          onClick={() => navigate('/housing/favorites')}
        >
          {t('housing.favStrip.viewAll')}
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>

      {thumbs.length === 0 ? (
        <div className="housing-empty-hint">
          <Heart size={18} aria-hidden="true" />
          <p>{t('housing.favStrip.empty')}</p>
        </div>
      ) : (
        <ul className="housing-fav-strip-list" ref={listRef}>
          {thumbs.map((l) => (
            <li key={l.id} className="housing-fav-strip-item">
              <button
                type="button"
                className="housing-fav-strip-thumb"
                aria-label={formatHousingAddress(l, i18n.language)}
                onClick={() => navigate(`/housing/listing/${l.id}`)}
              >
                <FavPreviewThumb listing={l} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
