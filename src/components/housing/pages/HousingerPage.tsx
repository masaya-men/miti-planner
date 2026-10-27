/**
 * Task 7: ハウジンガーページ (spec 2026-07-10-housinger-profile-design.md §4.3)
 * 2026-07-24 拡張: `/housing/mypage` (:uid なし) はマイページとして同コンポーネントを流用する。
 *
 * このファイルは指揮役 (uid の解決・本人判定と、部品/処理のつなぎ込み) のみ。処理は housinger/ 配下:
 * - 取得 (プロフィール+一覧・再訪の即表示・失敗時の縮退) = useHousingerPageData
 * - 代表作・背景の選択 (本人のみ) = useOgRepresentativeSelection
 * - 公開状態切替 (本人のみ) = useMyListingVisibilityChange
 * - まとめてツアー (他人のみ) = useHousingerTourAll
 * - アイコン+名前 (本人はその場編集) = HousingerIdentity / 「…」メニュー (通報・他人のみ) = HousingerReportMenu
 * - 未ログイン/読み込み中/非公開の画面 = HousingerPageStates
 *
 * - `/housing/housinger/:uid` (シェル子ルート、`listing/:listingId` と同型)。
 * - 一覧は探すのカードグリッド (ListingGrid) を流用する。 他人のページではカードに「ツアーに追加」
 *   (PC=ホバーで下端の帯・タッチ端末=右下の＋) を出す (tourAddVariant='overlay')。 本人のページには出さない。
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import { normalizeHousingerUid, buildHousingerShortSlug } from '../../../lib/housing/housingerProfile';
import { HousingShareButton } from '../listing/HousingShareButton';
import { ListingGrid } from '../browse/ListingGrid';
import { useSkeletonReveal } from '../../../lib/housing/useSkeletonReveal';
import { TourAllButtonSkeleton } from '../skeleton/HousingSkeletons';
import type { BrowseSortOrder } from '../browse/BrowseSortSelect';
import { VisibilityConfirmModal } from '../mypage/VisibilityConfirmModal';
import { HousingerProfileSection } from '../mypage/HousingerProfileSection';
import { useHousingListOrderStore } from '../../../store/useHousingListOrderStore';
import { useHousingerPageData } from '../housinger/useHousingerPageData';
import { useOgRepresentativeSelection } from '../housinger/useOgRepresentativeSelection';
import { useMyListingVisibilityChange } from '../housinger/useMyListingVisibilityChange';
import { useHousingerTourAll } from '../housinger/useHousingerTourAll';
import { HousingerIdentity } from '../housinger/HousingerIdentity';
import { HousingerReportMenu } from '../housinger/HousingerReportMenu';
import {
  HousingerBackLink,
  HousingerListingsSkeleton,
  HousingerLoadingView,
  HousingerLoginView,
  HousingerUnavailableView,
} from '../housinger/HousingerPageStates';
import '../../../styles/housing.css';

/** 他人視点のツアー追加: トレイへの追加は ListingCard の attemptToggle が済ませる。表示スイッチ用。 */
const noopAddToTour = (): void => {};

export const HousingerPage: React.FC<{ uidOverride?: string }> = ({ uidOverride }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid: routeUid } = useParams<{ uid: string }>();
  const viewerUid = useAuthStore((s) => s.user?.uid ?? null);
  // uidOverride: 短縮URL (/h/:slug、HousingerShortLinkPage.tsx) 経由のときは、slug の名前+識別コードを
  // 実際の uid へ解決済みの値がここに渡ってくる。routeUid (通常の /housing/housinger/:uid) より優先。
  const effectiveRouteUid = uidOverride ?? routeUid;
  // URL は hashed: prefix を外した短縮形 (#3・/housing/housinger/<hex>)。取得・本人判定の前に
  // 内部 ID 形式 'hashed:<hex>' へ復元する (doc ID / ownerUid / auth uid はすべてこの形式)。
  // 旧 'hashed:…' 付き URL も normalizeHousingerUid が no-op で通す (後方互換)。
  // /housing/mypage (:uid なし) はログイン中の自分の uid にフォールバックする。
  // isSelf 判定 (下記) と同様、viewerUid 側も normalizeHousingerUid を通す (auth uid が
  // 'hashed:' 無し形式で来るケースの防御。付いていれば no-op)。
  const isMyPageRoute = !effectiveRouteUid;
  const uid = effectiveRouteUid
    ? normalizeHousingerUid(effectiveRouteUid)
    : viewerUid
      ? normalizeHousingerUid(viewerUid)
      : undefined;
  // viewerUid ('hashed:<hex>') と正規化済み uid を同じ内部 ID 形式で比較する
  // (viewerUid が万一 prefix 無しでも normalize で吸収)。useEffect (下記) が参照するため
  // ここで先に定義する。
  const isSelf = viewerUid !== null && uid === normalizeHousingerUid(viewerUid);
  // 本人閲覧時の名前/アイコンは housing_profiles の非同期転記を待たず、常に最新の
  // useAuthStore 値を優先表示する (更新直後の即時反映のため。HousingerProfileSection と同じ考え方)。
  const authDisplayName = useAuthStore((s) => s.profileDisplayName);
  const authAvatarUrl = useAuthStore((s) => s.profileAvatarUrl);

  const { profile, listings, setListings, hiddenListings, profileLoading, listingsLoading } =
    useHousingerPageData(uid, isSelf);
  // ダミーが見えた後に本物へ替わったときだけ「ふわっと表示」を付ける (プロフィール列・一覧列を別々に)。
  const profileReveal = useSkeletonReveal(profileLoading);
  const listingsReveal = useSkeletonReveal(listingsLoading);
  const { ogSelectionSet, ogBackgroundId, toggleOgSelect, toggleOgBackground } =
    useOgRepresentativeSelection(isSelf, profile, listings);
  const {
    visibilityTarget,
    visibilityUpdating,
    requestVisibilityChange,
    cancelVisibilityChange,
    confirmVisibilityChange,
  } = useMyListingVisibilityChange(listings, setListings);
  const onTourAll = useHousingerTourAll(listings, viewerUid);
  // 並び替え選択は探すページと共通のストアに保持する (詳細ページ往復で選択が保持される)。
  // ランダムは選択肢に含めない (探すページのみの機能、既存仕様どおり新着順/古い順の2択)。
  const sort = useHousingListOrderStore((s) => s.entries.housinger.sortMode);
  const setSort = (v: BrowseSortOrder) => useHousingListOrderStore.getState().setSortMode('housinger', v);

  // BrowsePage と同じ「新着順/古い順」ローカル並び替え。sortListingsForGallery (住所グルーピング)
  // は基礎データの整形用で、 表示順は BrowseSortSelect の選択で上書きする。
  // 'random' は意図的に到達不能: 下記 ListingGrid 呼び出しは sortOrders 未指定 (新着/古い2択) のため、
  // sort は実際には 'newest'/'oldest' しか取り得ない (共有型 BrowseSortOrder には 'random' も含むが未使用)。
  const sorted = useMemo(
    () =>
      [...listings, ...hiddenListings].sort((a, b) =>
        sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
      ),
    [listings, hiddenListings, sort],
  );

  const onEditListing = (id: string) => {
    navigate(`/housing/listing/${id}/edit`);
  };

  if (isMyPageRoute && !viewerUid) return <HousingerLoginView />;
  if (profileLoading) return <HousingerLoadingView />;
  if (!profile) return <HousingerUnavailableView />;

  // 本人閲覧時は housing_profiles の転記を待たず useAuthStore の最新値を表示する
  // (未転記でも空にならないよう profile 側をフォールバックにする)。
  const displayName = isSelf ? authDisplayName?.trim() || profile.displayName : profile.displayName;
  const avatarUrl = isSelf ? (authAvatarUrl ?? profile.avatarUrl) : profile.avatarUrl;

  // SNS リンクは表示テキストをホスト名にする (spec §4.3)。 保存済み URL は
  // upsertHousingerProfile がサーバー側で validateHousingerSnsUrl 検証済みだが、
  // 念のため URL 構築に失敗したら生 URL のまま表示する (壊れて何も出ないよりまし)。
  let snsHost: string | null = null;
  if (profile.snsUrl) {
    try {
      snsHost = new URL(profile.snsUrl).hostname;
    } catch {
      snsHost = profile.snsUrl;
    }
  }

  // e: X共有 (A案)。詳細ページと同じ HousingShareButton を流用し、このハウジンガーの
  // まとめページ URL を共有する (公開分のみ表示のプライバシーと整合)。
  // 共有 URL は名前+識別コードの短縮形 (/h/<slug>、2026-08-19)。名前は飾りのみで実際の
  // 解決は識別コードだけが担うため、改名しても既存に共有済みのリンクは壊れない。
  const shareUrl = `${window.location.origin}/h/${buildHousingerShortSlug(displayName, uid ?? '')}`;

  return (
    <div className="housing-detail-panel">
      <div className="housing-detail-shell">
        <header className="housing-detail-fullpage-header housinger-page-headerbar">
          <HousingerBackLink />
        </header>
        <main className="housing-detail-fullpage-main housinger-page-main">
          {/* 2026-07-24 レイアウト刷新: 1枚のパネルを左右に分けるだけ (パネル分割はしない)。
              左列 = プロフィール一式 (スクロールに追従して画面内に留まる)、
              右列 = 一覧グリッド (この列だけがスクロールする)。 */}
          <div className="housinger-page-body">
            <div className={`housinger-page-profile-col${profileReveal ? ' housing-reveal' : ''}`} data-reveal={profileReveal || undefined}>
              <HousingerIdentity isSelf={isSelf} displayName={displayName} avatarUrl={avatarUrl} />
              {/* 本人閲覧時は自己紹介文・SNSリンクをここで直接編集できる (旧: 設定ウィンドウ内の
                  セクションだったが 2026-07-24 にマイページへ移動、設定ウィンドウはアイコン/名前/
                  ログアウト/退会のみのシンプル構成に縮小した)。
                  2026-07-31: シェア/通報の導線を下部から上部へ移動 (ユーザー指摘)。本人閲覧時は
                  「ハウジンガー公開」タイトル行の右側 (actions prop)、他人閲覧時は SNS リンクと
                  同じ行の右側に置く (別行に落とすと指示と違う、という実機指摘で修正)。 */}
              {isSelf ? (
                <HousingerProfileSection
                  actions={<HousingShareButton url={shareUrl} title={profile.displayName} />}
                />
              ) : (
                <>
                  <div className="housinger-page-sns-row">
                    {profile.snsUrl && (
                      <a
                        href={profile.snsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="housinger-page-sns"
                      >
                        {snsHost}
                      </a>
                    )}
                    {/* Task9 の「…」メニュー (通報) も本人以外にだけここに置く。 */}
                    <div className="housinger-page-profile-actions">
                      <HousingShareButton url={shareUrl} title={profile.displayName} />
                      <HousingerReportMenu viewerUid={viewerUid} housingerUid={uid ?? ''} />
                    </div>
                  </div>
                  {profile.bio && <p className="housinger-page-bio">{profile.bio}</p>}
                </>
              )}
              {/* まとめてツアーは他人のハウジングを見学する機能なので本人閲覧時は出さない
                  (自分の家をツアーする意味がない・2026-07-24 実機指摘)。公開ハウジングが
                  1 件以上のときだけ出すのは他人視点のみ引き続き有効。 */}
              {/* 一覧取得中はボタンの居場所をダミーで確保 (届いてから押し下げでずれないように)。 */}
              {!isSelf && listingsLoading && <TourAllButtonSkeleton />}
              {!isSelf && !listingsLoading && listings.length > 0 && (
                <button type="button" className="housinger-page-tour-btn" onClick={onTourAll}>
                  {t('housing.housinger.tourAll')}
                </button>
              )}
            </div>

            <div className={`housinger-page-listings-col${listingsReveal ? ' housing-reveal' : ''}`} data-reveal={listingsReveal || undefined}>
              {listingsLoading ? (
                <HousingerListingsSkeleton />
              ) : sorted.length === 0 ? (
                <p className="housinger-page-empty">{t('housing.housinger.noListings')}</p>
              ) : (
                <ListingGrid
                  listings={sorted}
                  sort={sort}
                  onSortChange={setSort}
                  listKey="housinger"
                  // 他人のページだけ画像上の「ツアーに追加」を出す。ListingCard 内の attemptToggle が
                  // 既にトレイへ追加するので、ここでの追加処理は不要 (空関数=ボタン表示のスイッチ)。
                  onAddToTour={isSelf ? undefined : noopAddToTour}
                  tourAddVariant={isSelf ? undefined : 'overlay'}
                  tourExtraPool={isSelf ? undefined : listings}
                  showOwnerControls={isSelf}
                  onRequestVisibilityChange={isSelf ? requestVisibilityChange : undefined}
                  onEditListing={isSelf ? onEditListing : undefined}
                  selectable={isSelf}
                  selectedIds={isSelf ? ogSelectionSet : undefined}
                  onToggleSelect={isSelf ? toggleOgSelect : undefined}
                  backgroundId={isSelf ? ogBackgroundId : undefined}
                  onToggleBackground={isSelf ? toggleOgBackground : undefined}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      {visibilityTarget && (
        <VisibilityConfirmModal
          open={Boolean(visibilityTarget)}
          listingTitle={visibilityTarget.listingTitle}
          targetVisibility={visibilityTarget.next}
          loading={visibilityUpdating}
          onCancel={cancelVisibilityChange}
          onConfirm={confirmVisibilityChange}
        />
      )}
    </div>
  );
};
