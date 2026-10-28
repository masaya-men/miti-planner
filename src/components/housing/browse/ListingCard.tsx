import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HousingCardMarqueeLine } from './HousingCardMarqueeLine';
import { HousingFavHeart } from './HousingFavHeart';
import type { MockListing } from '../../../data/housing/mockListings';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { isEffectivelyPublic, canDisplayAddress, isNewListing, isPinnedNew, NEW_LISTING_WINDOW_MS } from '../../../lib/housing/listingPublish';
import { useMasterData } from '../../../hooks/useMasterData';
import { useHousingCardPlayback } from '../../../lib/housing/housingPlaybackState';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { useRipple } from '../../../lib/housing/useRipple';
import { representativeImage } from '../../../lib/housing/representativeImage';
import { thumbHashToDataURL } from 'thumbhash';
import { HousingCardAmbientSlideshow } from '../workspace/HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from '../workspace/HousingCardVideoOverlay';
import { useTourAddFeedback } from '../../../lib/housing/useTourAddFeedback';
import { HousingImage } from '../media/HousingImage';
import { useListingVisibilityMenu } from './useListingVisibilityMenu';
import { useListingNewBeam } from './useListingNewBeam';
import { ListingCardNewRibbon } from './ListingCardNewRibbon';
import { ListingCardTopLeft } from './ListingCardTopLeft';
import { ListingCardOwnerControls } from './ListingCardOwnerControls';
import { ListingCardTourAddOverlay } from './ListingCardTourAddOverlay';
import { ListingCardTourAddFooter } from './ListingCardTourAddFooter';
import './ListingCard.css';
import './ListingCardOwner.css';
import './ListingCardMarks.css';
import './ListingCardNew.css';
import './ListingCardTourAdd.css';

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
  /** ツアー追加ボタンの出し方。'footer'(既定)=画像の下の常設フッター / 'overlay'=画像上のボタン
      (PC=ホバーで下端の帯・タッチ=右下の＋。見た目の切替は CSS のメディアクエリのみ・ハウジンガーページ用)。 */
  tourAddVariant?: 'footer' | 'overlay';
  /** overlay 時の地域判定用の追加母集団 (公開一覧ストア未読込でもトレイ内の家の地域を引けるように)。 */
  tourExtraPool?: { id: string; region?: string | null }[];
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
  tourAddVariant = 'footer',
  tourExtraPool,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const viewerUid = useAuthStore((s) => s.user?.uid ?? null);

  const {
    visibilityMenuOpen, setVisibilityMenuOpen, visibilityMenuPos, setVisibilityMenuPos, visibilityBtnRef, visibilityMenuPortalRef,
  } = useListingVisibilityMenu();

  // 生きたカード (段階2): 動画種別 → spotlight 候補判定、frames 解決、IO 登録。旧 HousingCard と同型。
  const videoKind: 'twitter' | 'youtube' | null = listing.videoUrl
    ? 'twitter'
    : listing.youtubeVideoId
      ? 'youtube'
      : null;
  const { isPlaying, ambientOn, register } = useHousingCardPlayback(listing.id, videoKind !== null);
  const { ripples, onClick: addRipple } = useRipple();
  const addToTourBtnRef = useRef<HTMLButtonElement>(null);
  const tourFeedback = useTourAddFeedback(listing.id, listing.region ?? null, tourExtraPool);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    register(mediaRef.current);
    return (): void => register(null);
  }, [register]);
  const frames = useHousingCardFrames(listing, ambientOn);

  // カード画像のぼかしプレースホルダ (ThumbHash・§5.5)。coverThumbHash がある物件
  // (= 直接アップロードの代表画像) だけメイン <img> の背面にぼかしを敷き、画像 load 完了で
  // フェードアウトさせる。X / YouTube / 旧データ / 生成失敗は coverThumbHash 無し = 従来の背景色。
  const [imgLoaded, setImgLoaded] = useState(false);
  const blurDataUrl = useMemo(() => {
    if (!listing.coverThumbHash) return null;
    try {
      return thumbHashToDataURL(
        Uint8Array.from(atob(listing.coverThumbHash), (c) => c.charCodeAt(0)),
      );
    } catch {
      return null;
    }
  }, [listing.coverThumbHash]);

  // overlay: unlisted (住所非公開) はツアーに使えないのでボタン自体を出さない。
  const showOverlayAdd = tourAddVariant === 'overlay' && Boolean(onAddToTour) && listing.visibility !== 'unlisted';

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
  const { enterCount, cardElRef } = useListingNewBeam(isNew);

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
      <div
        className="housing-listing-card-media"
        ref={mediaRef}
        data-blur-pending={blurDataUrl && !imgLoaded ? '' : undefined}
      >
        {blurDataUrl && (
          <div
            className="housing-listing-card-blur"
            style={{ backgroundImage: `url("${blurDataUrl}")` }}
            data-hidden={imgLoaded || undefined}
            aria-hidden="true"
          />
        )}
        {/* サイズ変換・YouTube 段階予備・失敗時の代替表示は HousingImage に集約。 */}
        <HousingImage
          className="housing-listing-card-img"
          src={representativeImage(listing)}
          variant="card"
          onLoad={() => setImgLoaded(true)}
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

        {/* NEWリボン (探すページ限定・投稿7日以内): 左上の角を斜めに横切る帯。
            selectable (お気に入り/マイページ) では showNewBadge 自体を渡さないので競合しない。 */}
        {isNew && (
          <ListingCardNewRibbon listing={listing} showBeam={showBeam} enterCount={enterCount} />
        )}

        {/* 常時表示 (左上): 選択チェック (お気に入りページのタグ選択・マイページのOGP代表作選択で共用)
            + 自分の登録の非公開/期限切れ印。
            印はホバー必須にしない (非公開かどうかが一覧で即分かることが安心につながるため常時)。
            showOwnerControls (マイページ) では isPrivate は右上の公開状態バッジと表示が重複する
            ため出さない。isExpired (visibility=public のまま公開期限切れで実質非表示) は
            バッジには出ない状態なので引き続き表示する。 */}
        <ListingCardTopLeft
          listing={listing}
          selectable={selectable}
          selected={selected}
          onToggleSelect={onToggleSelect}
          isBackground={isBackground}
          onToggleBackground={onToggleBackground}
          isPrivate={isPrivate}
          isExpired={isExpired}
          showOwnerControls={showOwnerControls}
        />

        {/* マイページ (showOwnerControls): 右上はお気に入りハートの代わりに公開状態バッジ、
            右下に編集(鉛筆)ボタン。旧: 画像の下に常設フッター行を作っていたため縦に長く、
            一度に見えるカード数が少なかった (2026-07-24 実機指摘・画像タイル上のオーバーレイに統合)。 */}
        {showOwnerControls ? (
          <ListingCardOwnerControls
            listing={listing}
            visibilityMenuOpen={visibilityMenuOpen}
            setVisibilityMenuOpen={setVisibilityMenuOpen}
            visibilityMenuPos={visibilityMenuPos}
            setVisibilityMenuPos={setVisibilityMenuPos}
            visibilityBtnRef={visibilityBtnRef}
            visibilityMenuPortalRef={visibilityMenuPortalRef}
            onRequestVisibilityChange={onRequestVisibilityChange}
            onEditListing={onEditListing}
          />
        ) : (
          <HousingFavHeart listingId={listing.id} />
        )}

        {/* 常時表示: 下端グラデーションにタイトル1行。見切れ分はカードホバー中に
            その場でゆっくり左へ流れ続ける (ループマーキー)。
            タグ・住所・サイズはカードに出さない (詳細ページ/フィルタが担う・2026-07-03 ユーザー合意)。 */}
        <div className="housing-listing-card-caption" aria-hidden="true">
          <HousingCardMarqueeLine>{title}</HousingCardMarqueeLine>
        </div>

        {showOverlayAdd && onAddToTour && (
          <ListingCardTourAddOverlay
            listing={listing}
            onAddToTour={onAddToTour}
            tourFeedback={tourFeedback}
            addToTourBtnRef={addToTourBtnRef}
            ripples={ripples}
            addRipple={addRipple}
          />
        )}
      </div>

      {/* 画像に被らない常設フッター (主アクション)。onAddToTour 未指定 (ハウジンガーページ等) では
          ツアー追加ボタン自体を出さない (フッターごと消す)。 */}
      {onAddToTour && tourAddVariant === 'footer' && (
        <ListingCardTourAddFooter
          listing={listing}
          onAddToTour={onAddToTour}
          tourFeedback={tourFeedback}
          addToTourBtnRef={addToTourBtnRef}
          ripples={ripples}
          addRipple={addRipple}
        />
      )}

    </article>
  );
};
