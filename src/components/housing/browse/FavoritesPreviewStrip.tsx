import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Heart } from 'lucide-react';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import type { MockListing } from '../../../data/housing/mockListings';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';

// 代表画像フォールバック (ListingCard と共通の規約)。
const PLACEHOLDER = '/housing/mock-thumbs/1.svg';
function representativeImage(l: MockListing): string {
  if (l.imageMode === 'thumbnail' && l.thumbnailPath) return l.thumbnailPath;
  if (l.imageMode === 'sns' && l.ogImageUrl) return l.ogImageUrl;
  return PLACEHOLDER;
}

const MAX_THUMBS = 4;

/**
 * 探すページ右カラムのお気に入りプレビュー (参考UI準拠)。
 * 直近のお気に入りサムネを数枚 + 「すべて見る」でお気に入りページへ。
 * お気に入りが無いときは軽い誘導文。
 */
export const FavoritesPreviewStrip: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const favoriteIds = useHousingFavoritesStore((s) => s.ids);
  const listings = useHousingListingsStore((s) => s.listings);

  // 新しい順 (add で末尾 push) で数枚。
  const recent = [...favoriteIds]
    .reverse()
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is MockListing => Boolean(l));
  const thumbs = recent.slice(0, MAX_THUMBS);

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
        <ul className="housing-fav-strip-list">
          {thumbs.map((l) => (
            <li key={l.id} className="housing-fav-strip-item">
              <button
                type="button"
                className="housing-fav-strip-thumb"
                aria-label={formatHousingAddress(l, i18n.language)}
                onClick={() => navigate(`/housing/listing/${l.id}`)}
              >
                <img src={representativeImage(l)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
