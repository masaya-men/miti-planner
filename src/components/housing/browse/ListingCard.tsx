import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Heart, Plus, Check } from 'lucide-react';
import { HousingCardMarqueeLine } from './HousingCardMarqueeLine';
import type { MockListing } from '../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { isEffectivelyPublic } from '../../../lib/housing/listingPublish';
import {
  handleYoutubeThumbnailError,
  handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';

export interface ListingCardProps {
  listing: MockListing;
  onAddToTour: (id: string) => void;
  /** true のときメディア左上に選択チェックを表示する (探すページでは使わない) */
  selectable?: boolean;
  /** selectable=true のとき、選択済み状態を渡す */
  selected?: boolean;
  /** 選択トグル時のコールバック。selectable=true のとき使用する */
  onToggleSelect?: (id: string) => void;
}

// 代表画像が無い/未取得のときのフォールバック (既存カードと共通)。
const PLACEHOLDER = '/housing/mock-thumbs/1.svg';

function representativeImage(l: MockListing): string {
  if (l.imageMode === 'thumbnail' && l.thumbnailPath) return l.thumbnailPath;
  if (l.imageMode === 'sns' && l.ogImageUrl) return l.ogImageUrl;
  return PLACEHOLDER;
}

/**
 * 探す / お気に入り / マイページ 共通のグリッドカード (生きたカード)。
 *
 * 2026-07-03 刷新 (ユーザー合意のデザイン): カード全体を 16:9 の画像タイルにして
 * ハウジングの画像を最大限見せる。常時表示はタイトル1行 (下端グラデーション) と
 * 自分の登録の非公開/期限切れ印のみ。タグ・住所・アクションはホバー/フォーカスで
 * 下からせり上がるオーバーレイパネルに出す (オーバーレイなのでグリッド行の高さ
 * 計算に影響しない = 画像潰れバグ B8 の構造的根治)。
 *
 * 段階1: 静止代表画像。段階2 で HousingPlaybackProvider をシェルに足すと
 * spotlight 動画再生 / 複数画像スライドショーが画像枠内で有効化される (既存機構流用予定)。
 */
export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onAddToTour,
  selectable,
  selected,
  onToggleSelect,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const favIds = useHousingFavoritesStore((s) => s.ids);
  const addFav = useHousingFavoritesStore((s) => s.add);
  const removeFav = useHousingFavoritesStore((s) => s.remove);
  const isFav = favIds.includes(listing.id);
  const viewerUid = useAuthStore((s) => s.user?.uid ?? null);

  // 主ラベルは登録者のタイトル (新シェルでは必須)。旧データ (title なし) は住所で代替。
  // 住所・サイズはカードに出さない (住所=ツアーが住所順に自動で組まれるため一覧では不要、
  // サイズ=左フィルタと詳細ページで足りる・ユーザー合意 2026-07-03)。
  const title = listing.title?.trim() || formatHousingAddress(listing, i18n.language);

  // spec A-3: 自分の登録だけに非公開/期限切れの静かな注記を出す (他人には出ない)。
  const isMine = viewerUid !== null && listing.ownerUid === viewerUid;
  const isPrivate = isMine && listing.visibility === 'private';
  const isExpired = isMine && !isPrivate && !isEffectivelyPublic(listing, Date.now());

  // カード全体クリック → 詳細ページ。♡ / 選択 / ツアー追加は stopPropagation で独立動作。
  const openDetail = () => navigate(`/housing/listing/${listing.id}`);

  return (
    <article
      className="housing-listing-card"
      style={{ contentVisibility: 'auto' } as React.CSSProperties}
      data-testid="housing-listing-card"
      role="link"
      tabIndex={0}
      aria-label={title}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openDetail();
      }}
    >
      <div className="housing-listing-card-media">
        <img
          className="housing-listing-card-img"
          src={representativeImage(listing)}
          alt=""
          loading="lazy"
          // YouTube maxresdefault 不在動画の 120x90 グレー画像 (200) / 404 を検出し
          // hqdefault→mqdefault→default へ段階フォールバック (他カードと同一機構)。
          // 非 YouTube 画像 (Twitter/プレースホルダ) では両ハンドラとも no-op。
          onError={handleYoutubeThumbnailError}
          onLoad={handleYoutubeThumbnailLoad}
        />

        {/* 常時表示 (左上): 選択チェック (お気に入りページのみ) + 自分の登録の非公開/期限切れ印。
            印はホバー必須にしない (非公開かどうかが一覧で即分かることが安心につながるため常時)。 */}
        <div className="housing-listing-card-topleft">
          {selectable && (
            <button
              type="button"
              className={`housing-card-select${selected ? ' is-selected' : ''}`}
              aria-label={t('housing.card.select')}
              aria-pressed={selected ?? false}
              data-testid="housing-card-select"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(listing.id);
              }}
            >
              {selected && <Check size={14} aria-hidden="true" />}
            </button>
          )}
          {(isPrivate || isExpired) && (
            <span className="housing-listing-card-mine-note" data-testid="housing-card-mine-note">
              {isPrivate ? t('housing.register.badge_private') : t('housing.register.badge_expired')}
            </span>
          )}
        </div>

        <button
          type="button"
          className={`housing-card-fav${isFav ? ' is-on' : ''}`}
          aria-label={t('housing.card.favorite')}
          aria-pressed={isFav}
          onClick={(e) => {
            e.stopPropagation();
            isFav ? removeFav(listing.id) : addFav(listing.id);
          }}
        >
          <Heart size={16} aria-hidden="true" />
        </button>

        {/* 常時表示: 下端グラデーションにタイトル1行。見切れ分はカードホバー中に
            その場でゆっくり左へ流れ続ける (ループマーキー)。
            タグ・住所・サイズはカードに出さない (詳細ページ/フィルタが担う・2026-07-03 ユーザー合意)。 */}
        <div className="housing-listing-card-caption" aria-hidden="true">
          <HousingCardMarqueeLine>{title}</HousingCardMarqueeLine>
        </div>
      </div>

      {/* 画像に被らない常設フッター (主アクション) */}
      <div className="housing-listing-card-footer">
        <button
          type="button"
          className="housing-card-add-btn"
          onClick={(e) => {
            e.stopPropagation();
            onAddToTour(listing.id);
          }}
        >
          <Plus size={14} aria-hidden="true" />
          {t('housing.card.add_to_tour')}
        </button>
      </div>
    </article>
  );
};
