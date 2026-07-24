/**
 * Task 7: ハウジンガーページ (spec 2026-07-10-housinger-profile-design.md §4.3)
 * 2026-07-24 拡張: `/housing/mypage` (:uid なし) はマイページとして同コンポーネントを流用する。
 *
 * - `/housing/housinger/:uid` (シェル子ルート、`listing/:listingId` と同型)。
 *   profile + ハウジング一覧を並行取得する (Promise.all)。
 * - 非公開・存在しない uid は housing トンマナの既存 NotFound (HousingDetailPage.tsx:40-57) を
 *   同一形 (unavailable 文言 + ← 探すへ戻る Link) で踏襲する。
 * - 一覧は探すのカードグリッド (ListingGrid) を流用するが onAddToTour は渡さない
 *   (= 個々のカードに「ツアーに追加」ボタンは出さず、 まとめてツアーボタンで一括対応する)。
 * - 本人閲覧時 (:uid なし、または :uid が自分) は名前横の鉛筆アイコンから /housing/mypage へ。
 *   一覧も本人のときだけ myListings ストア (公開/住所非公開/完全非公開すべて) を使う。
 *   他人閲覧時は getHousingerListings (公開分のみ) のまま不変。
 * - uid 切替 (同一コンポーネントのまま :uid だけ変わる遷移) 時は前の人のプロフィール/一覧を
 *   保持したまま表示しない (useHousingerProfile の stale 対策と同じ理由で fetch 開始前に必ず
 *   null/空へ戻す)。
 * - Task9: 本人以外が見ているときだけ、 プロフィール右のアクション列に控えめな「…」メニュー
 *   (通報) を出す。 HousingDetailKebab.tsx と同じ popover 仕様 (クリック/Esc/外側クリックで
 *   閉じる) をこのページ専用に軽量実装 (項目が「報告する」1つだけなので共有コンポーネント化はしない)。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Camera } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useAccountActions } from '../../../hooks/auth/useAccountActions';
import { DisplayNameEditor } from '../../DisplayNameEditor';
import { AvatarCropModal } from '../../AvatarCropModal';
import {
  getHousingerProfile,
  getHousingerListings,
} from '../../../lib/housing/housingerProfileService';
import { normalizeHousingerUid, stripHashedPrefix } from '../../../lib/housing/housingerProfile';
import { firestoreToGalleryListing } from '../../../lib/housing/galleryAdapter';
import { HousingShareButton } from '../listing/HousingShareButton';
import { sortListingsForGallery } from '../../../lib/housing/sortListingsForGallery';
import { orderTourStopIds } from '../../../lib/housing/orderTourStops';
import { tourRegionConflict } from '../../../lib/housing/tourCrossing';
import { ListingGrid } from '../browse/ListingGrid';
import type { BrowseSortOrder } from '../browse/BrowseSortSelect';
import { HousingerAvatar } from '../housinger/HousingerAvatar';
import { HousingerReportModal } from '../report/HousingerReportModal';
import { MannerNoticeDialog } from '../workspace/MannerNoticeDialog';
import { VisibilityConfirmModal } from '../mypage/VisibilityConfirmModal';
import { HousingerProfileSection } from '../mypage/HousingerProfileSection';
import {
  useHousingVisibilityUpdate,
  type HousingVisibilityValue,
} from '../mypage/useHousingVisibilityUpdate';
import { showToast } from '../../Toast';
import type { HousingerProfile } from '../../../types/housing';
import type { MockListing } from '../../../data/housing/mockListings';
import { useHousingListOrderStore } from '../../../store/useHousingListOrderStore';
import '../../../styles/housing.css';

export const HousingerPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid: routeUid } = useParams<{ uid: string }>();
  const viewerUid = useAuthStore((s) => s.user?.uid ?? null);
  // URL は hashed: prefix を外した短縮形 (#3・/housing/housinger/<hex>)。取得・本人判定の前に
  // 内部 ID 形式 'hashed:<hex>' へ復元する (doc ID / ownerUid / auth uid はすべてこの形式)。
  // 旧 'hashed:…' 付き URL も normalizeHousingerUid が no-op で通す (後方互換)。
  // /housing/mypage (:uid なし) はログイン中の自分の uid にフォールバックする。
  // isSelf 判定 (下記) と同様、viewerUid 側も normalizeHousingerUid を通す (auth uid が
  // 'hashed:' 無し形式で来るケースの防御。付いていれば no-op)。
  const isMyPageRoute = !routeUid;
  const uid = routeUid
    ? normalizeHousingerUid(routeUid)
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
  const accountActions = useAccountActions();

  const [profile, setProfile] = useState<HousingerProfile | null>(null);
  const [listings, setListings] = useState<MockListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [kebabOpen, setKebabOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [mannerOpen, setMannerOpen] = useState(false);
  // マイページ: 名前/アイコンをその場編集する (鉛筆クリックで名前編集モードへ)。
  const [editingName, setEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [isAvatarBusy, setIsAvatarBusy] = useState(false);
  // マイページ: 公開状態切替の確認モーダル (対象 listing + 切替先)。
  const [visibilityTarget, setVisibilityTarget] = useState<{
    listingId: string;
    listingTitle: string;
    next: HousingVisibilityValue;
  } | null>(null);
  const { updateVisibility, loading: visibilityUpdating } = useHousingVisibilityUpdate();
  const kebabRef = useRef<HTMLDivElement>(null);
  // 並び替え選択は探すページと共通のストアに保持する (詳細ページ往復で選択が保持される)。
  // ランダムは選択肢に含めない (探すページのみの機能、既存仕様どおり新着順/古い順の2択)。
  const sort = useHousingListOrderStore((s) => s.entries.housinger.sortMode);
  const setSort = (v: BrowseSortOrder) => useHousingListOrderStore.getState().setSortMode('housinger', v);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setListings([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    // uid 切替時、 前の人の profile/一覧を保持したまま表示しない (別人のデータが一瞬出る事故防止)。
    setProfile(null);
    setListings([]);
    setLoading(true);
    (async () => {
      try {
        if (isSelf) {
          // 自分の場合: 公開/住所非公開/完全非公開すべて (myListings ストア、visibility 問わず)。
          // 他人視点の表示 (getHousingerListings、公開分のみ) はこの分岐に入らない限り不変。
          const [profileResult] = await Promise.all([
            getHousingerProfile(uid),
            useHousingListingsStore.getState().loadMine(uid),
          ]);
          if (cancelled) return;
          const gallery = sortListingsForGallery(useHousingListingsStore.getState().myListings);
          setProfile(profileResult);
          setListings(gallery);
          setLoading(false);
          return;
        }
        const [profileResult, listingDocs] = await Promise.all([
          getHousingerProfile(uid),
          getHousingerListings(uid),
        ]);
        if (cancelled) return;
        const gallery = sortListingsForGallery(
          listingDocs.map(firestoreToGalleryListing).filter((l): l is MockListing => l !== null),
        );
        setProfile(profileResult);
        setListings(gallery);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        // getHousingerProfile は自身のエラーを飲み込み null を返すが、getHousingerListings は
        // reject しうる (デプロイ直後の複合インデックス未反映、一時的な Firestore エラー等)。
        // ここで捕まえないと loading=false が呼ばれず無限ローディングになるため、
        // 既存の unavailable 表示へ縮退する。
        console.warn('[HousingerPage] failed to load profile/listings', err);
        setProfile(null);
        setListings([]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, isSelf]);

  // 「…」メニュー: クリック/Esc/外側クリックで閉じる (HousingDetailKebab.tsx と同じ仕様)。
  useEffect(() => {
    if (!kebabOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setKebabOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKebabOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [kebabOpen]);

  // BrowsePage と同じ「新着順/古い順」ローカル並び替え。sortListingsForGallery (住所グルーピング)
  // は基礎データの整形用で、 表示順は BrowseSortSelect の選択で上書きする。
  // 'random' は意図的に到達不能: 下記 ListingGrid 呼び出しは sortOrders 未指定 (新着/古い2択) のため、
  // sort は実際には 'newest'/'oldest' しか取り得ない (共有型 BrowseSortOrder には 'random' も含むが未使用)。
  const sorted = useMemo(
    () =>
      [...listings].sort((a, b) =>
        sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
      ),
    [listings, sort],
  );

  // マイページ一覧: カードの切替メニューで選んだ内容を確認モーダルへ渡す (実行はモーダルの確認で)。
  const onRequestVisibilityChange = (id: string, next: HousingVisibilityValue) => {
    const target = listings.find((l) => l.id === id);
    if (!target) return;
    setVisibilityTarget({ listingId: id, listingTitle: target.title || '', next });
  };

  const onEditListing = (id: string) => {
    navigate(`/housing/listing/${id}/edit`);
  };

  const onConfirmVisibilityChange = async () => {
    if (!visibilityTarget) return;
    const { listingId, next } = visibilityTarget;
    const result = await updateVisibility(listingId, next);
    if (result.ok) {
      // 楽観的更新: publishUntil は update-visibility ハンドラと同じ規則 (unlisted/private は null)。
      setListings((prev) =>
        prev.map((l) =>
          l.id === listingId
            ? { ...l, visibility: next, publishUntil: next === 'public' ? l.publishUntil : null }
            : l,
        ),
      );
      setVisibilityTarget(null);
    } else {
      showToast(t('housing.mypage.visibilityConfirm.error'), 'error');
    }
  };

  // 名前/アイコンのその場編集。HousingAccountModal.tsx と同じロジック (useAccountActions 経由)。
  // 成功後は useAuthStore が更新され、displayName/avatarUrl (下記算出) が自動で最新表示に切り替わる。
  const handleSaveName = async (newName: string) => {
    setIsSavingName(true);
    try {
      await accountActions.updateDisplayName(newName);
      setEditingName(false);
      showToast(t('profile.toast_name_updated'));
    } catch (err) {
      console.error('Display name update error:', err);
      showToast(t('profile.toast_name_error'), 'error');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleAvatarComplete = async (blob: Blob) => {
    setIsAvatarBusy(true);
    setShowAvatarCrop(false);
    try {
      await accountActions.uploadAvatar(blob);
      showToast(t('avatar.toast_uploaded'));
    } catch (err) {
      console.error('Avatar upload error:', err);
      showToast(t('avatar.toast_upload_error'), 'error');
    } finally {
      setIsAvatarBusy(false);
    }
  };

  // HousingActionBar.tsx の onReportClick と同形 (未ログインならログイン案内、それ以外はモーダルを開く)。
  const onReportClick = () => {
    if (!viewerUid) {
      showToast(t('housing.detail.login_required'), 'info');
      return;
    }
    setReportOpen(true);
  };

  // まとめてツアー: まずマナー確認を出す(#C・Browse/Favorites と同じく毎回確認)。
  const onTourAll = () => {
    if (listings.length === 0) return;
    setMannerOpen(true);
  };

  // マナー確認の「はじめる」で実際にツアーを開始する。BrowsePage.tsx の commitStart と同形。
  const commitTourAll = () => {
    const ids = listings.map((l) => l.id);
    const orderedIds = orderTourStopIds(ids, listings);
    const stops = orderedIds
      .map((id) => listings.find((l) => l.id === id))
      .filter((l): l is MockListing => Boolean(l));
    const conflict = tourRegionConflict(stops);
    if (conflict) {
      showToast(t('housing.tour.region_block_start', { regions: conflict.join(' / ') }), 'error');
      return;
    }
    useHousingTourStore.getState().setListings(orderedIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
    setMannerOpen(false);
    navigate('/housing/tour');
  };

  // マイページ (:uid なし) は未ログインだとそもそも表示する自分が居ないので、
  // 読み込み表示を挟まずログイン導線を出す。
  if (isMyPageRoute && !viewerUid) {
    return (
      <div className="housing-detail-panel">
        <div className="housing-detail-shell">
          <main className="housing-detail-fullpage-main">
            <p>{t('housing.housinger.mypageLoginRequired')}</p>
            <button
              type="button"
              className="housing-action-btn"
              onClick={() => useHousingModalStore.getState().openLogin()}
            >
              {t('housing.topbar.login')}
            </button>
          </main>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="housing-detail-panel">
        <div className="housing-detail-shell">
          <main className="housing-detail-fullpage-main">{t('housing.housinger.loading')}</main>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="housing-detail-panel">
        <div className="housing-detail-shell">
          <main className="housing-detail-fullpage-main">
            <p>{t('housing.housinger.unavailable')}</p>
            <Link
              to="/housing"
              className="housing-detail-back"
              aria-label={t('housing.detail.back_aria')}
            >
              ← {t('housing.detail.back_aria')}
            </Link>
          </main>
        </div>
      </div>
    );
  }

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
  // 共有 URL は hashed: prefix を外した短縮形にする (#3)。
  const shareUrl = `${window.location.origin}/housing/housinger/${stripHashedPrefix(uid ?? '')}`;

  return (
    <div className="housing-detail-panel">
      <div className="housing-detail-shell">
        <header className="housing-detail-fullpage-header housinger-page-headerbar">
          <Link
            to="/housing"
            className="housing-detail-back"
            aria-label={t('housing.detail.back_aria')}
          >
            ← {t('housing.detail.back_aria')}
          </Link>
        </header>
        <main className="housing-detail-fullpage-main housinger-page-main">
          {/* 2026-07-24 レイアウト刷新: 1枚のパネルを左右に分けるだけ (パネル分割はしない)。
              左列 = プロフィール一式 (スクロールに追従して画面内に留まる)、
              右列 = 一覧グリッド (この列だけがスクロールする)。 */}
          <div className="housinger-page-body">
            <div className="housinger-page-profile-col">
              <div className="housinger-page-identity">
                {isSelf ? (
                  <div className="housinger-page-avatar-wrap">
                    <HousingerAvatar
                      avatarUrl={avatarUrl}
                      name={displayName}
                      className="housinger-page-avatar"
                    />
                    <button
                      type="button"
                      className="housinger-page-avatar-edit-btn"
                      onClick={() => setShowAvatarCrop(true)}
                      disabled={isAvatarBusy}
                      aria-label={t('housing.account.avatarChange')}
                      title={t('housing.account.avatarChange')}
                    >
                      <Camera size={13} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <HousingerAvatar
                    avatarUrl={avatarUrl}
                    name={displayName}
                    className="housinger-page-avatar"
                  />
                )}
                {/* 本人閲覧時のみ: 鉛筆アイコンで名前をその場編集 (旧: /housing/mypage への
                    ナビゲーションだったが、マイページ自体でも押せる導線だったため意味を持たなかった)。 */}
                {isSelf && editingName ? (
                  <div className="housinger-page-name-editor">
                    <DisplayNameEditor
                      value={displayName || ''}
                      onSave={handleSaveName}
                      onCancel={() => setEditingName(false)}
                      isSaving={isSavingName}
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="housinger-page-name">{displayName}</h2>
                    {isSelf && (
                      <button
                        type="button"
                        className="housinger-page-edit-btn"
                        aria-label={t('housing.housinger.editProfile')}
                        title={t('housing.housinger.editProfile')}
                        onClick={() => setEditingName(true)}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                    )}
                  </>
                )}
              </div>
              {/* 本人閲覧時は自己紹介文・SNSリンクをここで直接編集できる (旧: 設定ウィンドウ内の
                  セクションだったが 2026-07-24 にマイページへ移動、設定ウィンドウはアイコン/名前/
                  ログアウト/退会のみのシンプル構成に縮小した)。 */}
              {isSelf ? (
                <HousingerProfileSection />
              ) : (
                <>
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
                  {profile.bio && <p className="housinger-page-bio">{profile.bio}</p>}
                </>
              )}
              {/* まとめてツアーは公開ハウジングが 1 件以上のときだけ出す。 */}
              {listings.length > 0 && (
                <button type="button" className="housinger-page-tour-btn" onClick={onTourAll}>
                  {t('housing.housinger.tourAll')}
                </button>
              )}
              {/* Task9 の「…」メニュー (通報) も本人以外にだけここに置く。 */}
              <div className="housinger-page-profile-actions">
                <HousingShareButton url={shareUrl} title={profile.displayName} />
                {!isSelf && (
                  <div className="housing-kebab" ref={kebabRef}>
                    <button
                      type="button"
                      aria-label={t('housing.detail.kebab.aria_label')}
                      aria-haspopup="menu"
                      aria-expanded={kebabOpen}
                      className="housing-kebab-trigger housinger-page-kebab-trigger"
                      onClick={() => setKebabOpen((v) => !v)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                        <circle cx="12" cy="5" r="2" fill="currentColor" />
                        <circle cx="12" cy="12" r="2" fill="currentColor" />
                        <circle cx="12" cy="19" r="2" fill="currentColor" />
                      </svg>
                    </button>
                    {kebabOpen && (
                      <div role="menu" className="housing-kebab-menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setKebabOpen(false);
                            onReportClick();
                          }}
                        >
                          {t('housing.housinger.report.menuItem')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="housinger-page-listings-col">
              {listings.length === 0 ? (
                <p className="housinger-page-empty">{t('housing.housinger.noListings')}</p>
              ) : (
                <ListingGrid
                  listings={sorted}
                  sort={sort}
                  onSortChange={setSort}
                  listKey="housinger"
                  showOwnerControls={isSelf}
                  onRequestVisibilityChange={isSelf ? onRequestVisibilityChange : undefined}
                  onEditListing={isSelf ? onEditListing : undefined}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      {reportOpen && (
        <HousingerReportModal
          open={reportOpen}
          housingerUid={uid ?? ''}
          onClose={() => setReportOpen(false)}
        />
      )}
      <MannerNoticeDialog
        open={mannerOpen}
        onCancel={() => setMannerOpen(false)}
        onStart={commitTourAll}
      />
      {visibilityTarget && (
        <VisibilityConfirmModal
          open={Boolean(visibilityTarget)}
          listingTitle={visibilityTarget.listingTitle}
          targetVisibility={visibilityTarget.next}
          loading={visibilityUpdating}
          onCancel={() => setVisibilityTarget(null)}
          onConfirm={onConfirmVisibilityChange}
        />
      )}
      {isSelf && (
        <AvatarCropModal
          isOpen={showAvatarCrop}
          onClose={() => setShowAvatarCrop(false)}
          onComplete={handleAvatarComplete}
        />
      )}
    </div>
  );
};
