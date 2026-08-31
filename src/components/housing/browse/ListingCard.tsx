import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, Pencil, Image as ImageIcon } from 'lucide-react';
import { HousingCardMarqueeLine } from './HousingCardMarqueeLine';
import { HousingFavHeart } from './HousingFavHeart';
import type { MockListing } from '../../../data/housing/mockListings';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { isEffectivelyPublic, canDisplayAddress, isNewListing, isPinnedNew, NEW_LISTING_WINDOW_MS } from '../../../lib/housing/listingPublish';
import { useMasterData } from '../../../hooks/useMasterData';
import {
  handleYoutubeThumbnailError,
  handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { useRipple } from '../../../lib/housing/useRipple';
import { representativeImage } from '../../../lib/housing/representativeImage';
import { cardImageAttrs, CARD_IMAGE_SIZES } from '../../../lib/housing/cardImageAttrs';
import { HousingCardAmbientSlideshow } from '../workspace/HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from '../workspace/HousingCardVideoOverlay';
import { HousingRipple } from '../HousingRipple';
import { useTourAddFeedback } from '../../../lib/housing/useTourAddFeedback';
import { HousingTourAddErrorBubble } from '../HousingTourAddErrorBubble';

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
  /** selectable=true かつ selected=true の時だけ表示する「背景にも使う」トグルの選択状態。 */
  isBackground?: boolean;
  /** 背景トグルクリック時のコールバック。未指定ならトグル自体を描画しない。 */
  onToggleBackground?: (id: string) => void;
  /** 指定時、カード本体クリック/Enter で詳細遷移せずこれを呼ぶ (例: 地図の複数スポット→パネル起動)。 */
  onCardClick?: () => void;
  /** true のとき、家主向け管理コントロール (公開状態バッジ+切替+編集) をフッターに表示する。
      マイページ専用 (2026-07-24)。 */
  showOwnerControls?: boolean;
  /** showOwnerControls=true のとき、公開状態の切替先を選んだら呼ぶ (確認モーダルは呼び出し側の責務)。 */
  onRequestVisibilityChange?: (id: string, next: 'public' | 'unlisted' | 'private') => void;
  /** showOwnerControls=true のとき、編集ボタンクリックで呼ぶ。 */
  onEditListing?: (id: string) => void;
  /** true のとき、投稿から7日以内のカードに左上のNEWリボン+縁のビーム演出を出す。探すページ専用 (2026-08-16)。 */
  showNewBadge?: boolean;
}

// 光る時間 (3s) と同じ幅までズレを広げ、「そろって見える」を確実に避ける
// (2026-08-16: 400ms→1000msでもまだ物足りずさらに広げる実機指摘)。
const NEW_BEAM_MAX_STAGGER_MS = 3000;

/**
 * NEWビーム演出の開始を listing.id から決定的にずらす (2026-08-16)。
 * 複数のNEWカードが同時に画面内へ入ったとき全員が寸分違わず同時に光ると
 * 機械的で不自然に見えるため(Material Designの staggered animation 指針、
 * Framer Motion の staggerChildren / GSAP の stagger 等が標準機能として
 * 存在するのが示す通り、複数要素の同時アニメーションは業界的に避けられる)、
 * カードごとに 0〜3000ms の範囲でずらす。id 由来の決定的な値なので同じカードは
 * 毎回同じズレになる (再現性のためランダムにはしない)。
 */
export function staggerDelayMs(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % NEW_BEAM_MAX_STAGGER_MS;
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
  isBackground,
  onToggleBackground,
  onCardClick,
  showOwnerControls,
  onRequestVisibilityChange,
  onEditListing,
  showNewBadge,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const viewerUid = useAuthStore((s) => s.user?.uid ?? null);

  // マイページ: 公開状態切替ポップオーバーの開閉。カードごとに独立 (HousingDetailKebab と同仕様)。
  // カード自体が overflow:hidden (角丸のため) を持つため、メニューはカード内の絶対配置ではなく
  // createPortal で document.body 直下に出す (でないとカードの縁でクリップされ表示が崩れる・
  // 2026-07-24 実機指摘)。ボタンとメニューが DOM 上は離れた場所になるため、外側クリック判定は
  // 両方の ref を見る。
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [visibilityMenuPos, setVisibilityMenuPos] = useState<{ top: number; right: number } | null>(null);
  const visibilityBtnRef = useRef<HTMLButtonElement | null>(null);
  const visibilityMenuPortalRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!visibilityMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideButton = visibilityBtnRef.current?.contains(target) ?? false;
      const insideMenu = visibilityMenuPortalRef.current?.contains(target) ?? false;
      if (!insideButton && !insideMenu) {
        setVisibilityMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisibilityMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [visibilityMenuOpen]);

  // 生きたカード (段階2): 動画種別 → spotlight 候補判定、frames 解決、IO 登録。旧 HousingCard と同型。
  const videoKind: 'twitter' | 'youtube' | null = listing.videoUrl
    ? 'twitter'
    : listing.youtubeVideoId
      ? 'youtube'
      : null;
  const { isPlaying, ambientOn, register } = useHousingCardPlayback(listing.id, videoKind !== null);
  const { ripples, onClick: addRipple } = useRipple();
  const addToTourBtnRef = useRef<HTMLButtonElement>(null);
  const tourFeedback = useTourAddFeedback(listing.id, listing.region ?? null);
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
  // 探すページ限定 (showNewBadge): 投稿からN日以内のカードに左上のNEWリボン+縁のビーム演出。
  // N日は管理画面 (master/config.newListingWindowDays) で変更可能 (2026-08-16)。
  // 未設定/未取得時は既定7日 (NEW_LISTING_WINDOW_MS) にフォールバックする。
  const { config: masterConfig } = useMasterData();
  const newListingWindowMs = masterConfig?.newListingWindowDays != null
    ? masterConfig.newListingWindowDays * 24 * 60 * 60 * 1000
    : NEW_LISTING_WINDOW_MS;
  // 2026-08-24 追加: 管理者が pinnedNewUntil (期限付き) を設定していれば、投稿日に関わらず
  // NEWリボンを固定表示する (publishUntil と同じ「未来なら有効・遅延評価」設計、期限を
  // 過ぎたら自動的に通常の投稿日ベース判定へフォールバックする)。
  const isNew = Boolean(showNewBadge) &&
    (isNewListing(listing.createdAt, Date.now(), newListingWindowMs) || isPinnedNew(listing.pinnedNewUntil, Date.now()));
  // ビーム演出はマウント直後ではなく、実際にスクロールして画面内に入るたびに1周だけ再生する
  // (2026-08-16 実機指摘: 全カードが一度にDOM化されるため、マウント基準だと画面外のカードが
  // 見えないまま光り終わっていた。さらに2026-08-16 追加要望: 画面外に出てまた入ってきた時にも
  // 再度光ってほしい)。リボン自体 (isNew) は静的表示なので画面内に入るのを待たず即座に出す。
  // enterCount を「画面内に入った回数」として増やし、それを beam span の key にすることで、
  // React に毎回そのDOM要素を作り直させ (再マウント)、CSSアニメーションを確実に最初から
  // 再生させる (クラスの再付与だけでは既に走り終えたCSSアニメーションは再始動しないため)。
  const [enterCount, setEnterCount] = useState(0);
  const wasIntersectingRef = useRef(false);
  const cardElRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isNew) return;
    const el = cardElRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !wasIntersectingRef.current) {
          wasIntersectingRef.current = true;
          setEnterCount((c) => c + 1);
        } else if (!entry.isIntersecting) {
          wasIntersectingRef.current = false;
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isNew]);

  // カード全体クリック → 既定は詳細ページ。onCardClick 指定時はそちらを優先
  // (♡ / 選択 / ツアー追加は stopPropagation で独立動作、以下いずれの場合も不変)。
  const openDetail = () => navigate(`/housing/listing/${listing.id}`);
  const activate = onCardClick ?? openDetail;

  // NEW かつ画面内に入った後だけ、縁を光が一周するビーム演出クラスを足す (投稿7日以内・探すページ限定)。
  const showBeam = isNew && enterCount > 0;

  return (
    <article
      ref={cardElRef}
      className={`housing-listing-card${showBeam ? ' housing-card-new-beam' : ''}`}
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
      {/* 縁だけを光が一周するリング (2026-08-16改: 透ける部分から光が漏れる問題の根治のため
          mask で輪の形に切り抜く方式にした。中の巨大な正方形だけが回転し、この輪自体は
          カードの角丸の縁に固定されたまま動かない)。
          key={enterCount}: 画面内に入るたびに増える値をkeyにすることで、2回目以降の再入場でも
          Reactに要素を作り直させ、既に再生し終えたCSSアニメーションを確実に最初から再生させる。
          --beam-delay: 実際に回転しているのは疑似要素 (::before) で、React の style は
          疑似要素に直接効かないため、CSS変数として span に渡し housing.css 側の
          animation-delay: var(--beam-delay) で疑似要素に届ける (2026-08-16 バグ修正: 当初
          span 自身に animationDelay を置いていて何も効いていなかった)。 */}
      {showBeam && (
        <span
          key={enterCount}
          className="housing-card-new-beam-glow"
          style={{ '--beam-delay': `${staggerDelayMs(listing.id)}ms` } as React.CSSProperties}
          aria-hidden="true"
        />
      )}
      <div className="housing-listing-card-media" ref={mediaRef}>
        {(() => {
          const a = cardImageAttrs(representativeImage(listing), {
            sizes: CARD_IMAGE_SIZES,
            twitterName: 'small',
          });
          return (
            <img
              className="housing-listing-card-img"
              src={a.src}
              srcSet={a.srcSet}
              sizes={a.sizes}
              alt=""
              loading="lazy"
              decoding="async"
              // YouTube maxresdefault 不在動画の 120x90 グレー画像 (200) / 404 を検出し
              // hqdefault→mqdefault→default へ段階フォールバック (他カードと同一機構)。
              // 非 YouTube 画像 (Twitter/プレースホルダ) では両ハンドラとも no-op。
              onError={handleYoutubeThumbnailError}
              onLoad={handleYoutubeThumbnailLoad}
            />
          );
        })()}
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

        {/* NEWリボン (探すページ限定・投稿7日以内): 左上の角を斜めに横切る帯。
            selectable (お気に入り/マイページ) では showNewBadge 自体を渡さないので競合しない。 */}
        {isNew && (
          <span
            className="housing-card-new-ribbon"
            data-testid="housing-card-new-ribbon"
            aria-label={t('housing.card.new_badge_aria')}
          >
            {t('housing.card.new_badge')}
          </span>
        )}

        {/* 常時表示 (左上): 選択チェック (お気に入りページのタグ選択・マイページのOGP代表作選択で共用)
            + 自分の登録の非公開/期限切れ印。
            印はホバー必須にしない (非公開かどうかが一覧で即分かることが安心につながるため常時)。
            showOwnerControls (マイページ) では isPrivate は右上の公開状態バッジと表示が重複する
            ため出さない。isExpired (visibility=public のまま公開期限切れで実質非表示) は
            バッジには出ない状態なので引き続き表示する。 */}
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
          {selectable && selected && onToggleBackground && (
            <button
              type="button"
              className={`housing-card-background-select${isBackground ? ' is-selected' : ''}`}
              aria-label={t('housing.housinger.ogSelect.backgroundToggle')}
              aria-pressed={isBackground ?? false}
              data-testid="housing-card-background-select"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBackground(listing.id);
              }}
            >
              <ImageIcon size={13} aria-hidden="true" />
            </button>
          )}
          {((isPrivate && !showOwnerControls) || isExpired) && (
            <span className="housing-listing-card-mine-note" data-testid="housing-card-mine-note">
              {isPrivate ? t('housing.register.badge_private') : t('housing.register.badge_expired')}
            </span>
          )}
        </div>

        {/* マイページ (showOwnerControls): 右上はお気に入りハートの代わりに公開状態バッジ、
            右下に編集(鉛筆)ボタン。旧: 画像の下に常設フッター行を作っていたため縦に長く、
            一度に見えるカード数が少なかった (2026-07-24 実機指摘・画像タイル上のオーバーレイに統合)。 */}
        {showOwnerControls ? (
          <button
            ref={visibilityBtnRef}
            type="button"
            className="housing-card-visibility-badge housing-card-visibility-badge-overlay"
            aria-haspopup="menu"
            aria-expanded={visibilityMenuOpen}
            onClick={(e) => {
              e.stopPropagation();
              if (!visibilityMenuOpen && visibilityBtnRef.current) {
                const rect = visibilityBtnRef.current.getBoundingClientRect();
                setVisibilityMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
              }
              setVisibilityMenuOpen((v) => !v);
            }}
          >
            {t(`housing.register.visibility.${listing.visibility ?? 'public'}`)}
          </button>
        ) : (
          <HousingFavHeart listingId={listing.id} />
        )}

        {/* カード自体が overflow:hidden なのでメニューは body 直下に portal し、
            ボタンの画面座標を基準に fixed 配置する (2026-07-24 実機指摘)。 */}
        {showOwnerControls && visibilityMenuOpen && visibilityMenuPos && createPortal(
          <div
            ref={visibilityMenuPortalRef}
            role="menu"
            className="housing-card-visibility-menu housing-card-visibility-menu-portal"
            style={{ top: `${visibilityMenuPos.top}px`, right: `${visibilityMenuPos.right}px` }}
          >
            {(['public', 'unlisted', 'private'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="menuitem"
                disabled={(listing.visibility ?? 'public') === v}
                onClick={(e) => {
                  e.stopPropagation();
                  setVisibilityMenuOpen(false);
                  onRequestVisibilityChange?.(listing.id, v);
                }}
              >
                {t(`housing.register.visibility.${v}`)}
              </button>
            ))}
          </div>,
          document.body,
        )}

        {showOwnerControls && (
          <button
            type="button"
            className="housing-card-edit-btn housing-card-edit-btn-overlay"
            aria-label={t('housing.mypage.editListing')}
            title={t('housing.mypage.editListing')}
            onClick={(e) => {
              e.stopPropagation();
              onEditListing?.(listing.id);
            }}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}

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
            ref={addToTourBtnRef}
            type="button"
            className={`housing-card-add-btn${tourFeedback.isAdded ? ' is-added' : ''}`}
            data-tour-anim={tourFeedback.animState}
            disabled={listing.visibility === 'unlisted'}
            aria-disabled={listing.visibility === 'unlisted'}
            aria-pressed={tourFeedback.isAdded}
            title={listing.visibility === 'unlisted' ? t('housing.card.addressPrivate') : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (listing.visibility === 'unlisted') return;
              addRipple(e);
              const outcome = tourFeedback.attemptToggle();
              if (outcome === 'added') onAddToTour(listing.id);
            }}
          >
            {tourFeedback.isAdded ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Plus size={14} aria-hidden="true" />
            )}
            {tourFeedback.isAdded ? t('housing.card.added_to_tour') : t('housing.card.add_to_tour')}
            <HousingRipple ripples={ripples} />
          </button>
          <HousingTourAddErrorBubble anchorRef={addToTourBtnRef} message={tourFeedback.errorMessage} />
        </div>
      )}

    </article>
  );
};
