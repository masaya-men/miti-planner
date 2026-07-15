import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Check } from 'lucide-react';
import { HousingCardMarqueeLine } from './HousingCardMarqueeLine';
import { HousingFavHeart } from './HousingFavHeart';
import type { MockListing } from '../../../data/housing/mockListings';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { isEffectivelyPublic, canDisplayAddress } from '../../../lib/housing/listingPublish';
import {
  handleYoutubeThumbnailError,
  handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { useRipple } from '../../../lib/housing/useRipple';
import { representativeImage } from '../../../lib/housing/representativeImage';
import { HousingCardAmbientSlideshow } from '../workspace/HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from '../workspace/HousingCardVideoOverlay';
import { HousingRipple } from '../HousingRipple';

export interface ListingCardProps {
  listing: MockListing;
  /** 未指定なら「ツアーに追加」ボタン自体を出さない (例: ハウジンガーページの一覧)。 */
  onAddToTour?: (id: string) => void;
  /** true のときメディア左上に選択チェックを表示する (探すページでは使わない) */
  selectable?: boolean;
  /** selectable=true のとき、選択済み状態を渡す */
  selected?: boolean;
  /** 選択トグル時のコールバック。selectable=true のとき使用する */
  onToggleSelect?: (id: string) => void;
  /** 指定時、カード本体クリック/Enter で詳細遷移せずこれを呼ぶ (例: 地図の複数スポット→パネル起動)。 */
  onCardClick?: () => void;
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
  onCardClick,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const viewerUid = useAuthStore((s) => s.user?.uid ?? null);

  // 生きたカード (段階2): 動画種別 → spotlight 候補判定、frames 解決、IO 登録。旧 HousingCard と同型。
  const videoKind: 'twitter' | 'youtube' | null = listing.videoUrl
    ? 'twitter'
    : listing.youtubeVideoId
      ? 'youtube'
      : null;
  const { isPlaying, ambientOn, register } = useHousingCardPlayback(listing.id, videoKind !== null);
  const { ripples, onClick: addRipple } = useRipple();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    register(mediaRef.current);
    return (): void => register(null);
  }, [register]);
  const frames = useHousingCardFrames(listing, ambientOn);

  // 主ラベルは登録者のタイトル (新シェルでは必須)。旧データ (title なし) は住所で代替。
  // 住所・サイズはカードに出さない (住所=ツアーが住所順に自動で組まれるため一覧では不要、
  // サイズ=左フィルタと詳細ページで足りる・ユーザー合意 2026-07-03)。
  // unlisted はタイトル未入力でも住所へフォールバックしない (住所漏洩防止・§8.3)。
  const title = listing.title?.trim()
    || (canDisplayAddress(listing) ? formatHousingAddress(listing, i18n.language) : t('housing.card.addressPrivate'));

  // spec A-3: 自分の登録だけに非公開/期限切れの静かな注記を出す (他人には出ない)。
  const isMine = viewerUid !== null && listing.ownerUid === viewerUid;
  const isPrivate = isMine && listing.visibility === 'private';
  const isExpired = isMine && !isPrivate && !isEffectivelyPublic(listing, Date.now());

  // カード全体クリック → 既定は詳細ページ。onCardClick 指定時はそちらを優先
  // (♡ / 選択 / ツアー追加は stopPropagation で独立動作、以下いずれの場合も不変)。
  const openDetail = () => navigate(`/housing/listing/${listing.id}`);
  const activate = onCardClick ?? openDetail;

  return (
    <article
      className="housing-listing-card"
      style={{ contentVisibility: 'auto' } as React.CSSProperties}
      data-testid="housing-listing-card"
      role="link"
      tabIndex={0}
      aria-label={title}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter') activate();
      }}
    >
      <div className="housing-listing-card-media" ref={mediaRef}>
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
        <HousingCardAmbientSlideshow frames={frames} enabled={ambientOn} />
        {isPlaying && videoKind === 'twitter' && listing.videoUrl && (
          <HousingCardVideoOverlay
            kind="twitter"
            videoUrl={listing.videoUrl}
            posterUrl={listing.videoPosterUrl}
          />
        )}
        {isPlaying && videoKind === 'youtube' && listing.youtubeVideoId && (
          <HousingCardVideoOverlay kind="youtube" youtubeVideoId={listing.youtubeVideoId} />
        )}

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

        <HousingFavHeart listingId={listing.id} />

        {/* 常時表示: 下端グラデーションにタイトル1行。見切れ分はカードホバー中に
            その場でゆっくり左へ流れ続ける (ループマーキー)。
            タグ・住所・サイズはカードに出さない (詳細ページ/フィルタが担う・2026-07-03 ユーザー合意)。 */}
        <div className="housing-listing-card-caption" aria-hidden="true">
          <HousingCardMarqueeLine>{title}</HousingCardMarqueeLine>
        </div>
      </div>

      {/* 画像に被らない常設フッター (主アクション)。onAddToTour 未指定 (ハウジンガーページ等) では
          ツアー追加ボタン自体を出さない (フッターごと消す)。 */}
      {onAddToTour && (
        <div className="housing-listing-card-footer">
          <button
            type="button"
            className="housing-card-add-btn"
            onClick={(e) => {
              e.stopPropagation();
              addRipple(e);
              onAddToTour(listing.id);
            }}
          >
            <Plus size={14} aria-hidden="true" />
            {t('housing.card.add_to_tour')}
            <HousingRipple ripples={ripples} />
          </button>
        </div>
      )}
    </article>
  );
};
