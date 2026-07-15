/**
 * Task 7: ハウジンガーページ (spec 2026-07-10-housinger-profile-design.md §4.3)
 *
 * - `/housing/housinger/:uid` (シェル子ルート、`listing/:listingId` と同型)。
 *   profile + 公開ハウジング一覧を並行取得する (Promise.all)。
 * - 非公開・存在しない uid は housing トンマナの既存 NotFound (HousingDetailPage.tsx:40-57) を
 *   同一形 (unavailable 文言 + ← 探すへ戻る Link) で踏襲する。
 * - 一覧は探すのカードグリッド (ListingGrid) を流用するが onAddToTour は渡さない
 *   (= 個々のカードに「ツアーに追加」ボタンは出さず、 まとめてツアーボタンで一括対応する)。
 * - 本人閲覧時のみ「プロフィールを編集」 ボタン (アカウントモーダルを開く)。 本人でも見えるのは
 *   getHousingerListings が返す公開分のみ (v1、 自分の非公開ハウジングはここに出さない)。
 * - uid 切替 (同一コンポーネントのまま :uid だけ変わる遷移) 時は前の人のプロフィール/一覧を
 *   保持したまま表示しない (useHousingerProfile の stale 対策と同じ理由で fetch 開始前に必ず
 *   null/空へ戻す)。
 * - Task9: 本人以外が見ているときだけ、 ヘッダー右端に控えめな「…」メニュー (通報) を出す。
 *   HousingDetailKebab.tsx と同じ popover 仕様 (クリック/Esc/外側クリックで閉じる) をこの
 *   ページ専用に軽量実装 (項目が「報告する」1つだけなので共有コンポーネント化はしない)。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
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
import { showToast } from '../../Toast';
import type { HousingerProfile } from '../../../types/housing';
import type { MockListing } from '../../../data/housing/mockListings';
import '../../../styles/housing.css';

export const HousingerPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid: routeUid } = useParams<{ uid: string }>();
  // URL は hashed: prefix を外した短縮形 (#3・/housing/housinger/<hex>)。取得・本人判定の前に
  // 内部 ID 形式 'hashed:<hex>' へ復元する (doc ID / ownerUid / auth uid はすべてこの形式)。
  // 旧 'hashed:…' 付き URL も normalizeHousingerUid が no-op で通す (後方互換)。
  const uid = routeUid ? normalizeHousingerUid(routeUid) : undefined;
  const viewerUid = useAuthStore((s) => s.user?.uid ?? null);

  const [profile, setProfile] = useState<HousingerProfile | null>(null);
  const [listings, setListings] = useState<MockListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [kebabOpen, setKebabOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [mannerOpen, setMannerOpen] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<BrowseSortOrder>('newest');

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
  }, [uid]);

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
  const sorted = useMemo(
    () =>
      [...listings].sort((a, b) =>
        sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
      ),
    [listings, sort],
  );

  // viewerUid ('hashed:<hex>') と正規化済み uid を同じ内部 ID 形式で比較する
  // (viewerUid が万一 prefix 無しでも normalize で吸収)。
  const isSelf = viewerUid !== null && uid === normalizeHousingerUid(viewerUid);

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
          {/* Task9 の「…」メニュー (通報) は本人以外にだけ、この右端グループに置く。
              シェアは 2026-07-15 にプロフィールヘッダー右のアクション群へ移動した (一覧性向上)。 */}
          <div className="housinger-page-headerbar-actions">
            {!isSelf && (
              <div className="housing-kebab" ref={kebabRef}>
                <button
                  type="button"
                  aria-label={t('housing.detail.kebab.aria_label')}
                  aria-haspopup="menu"
                  aria-expanded={kebabOpen}
                  className="housing-kebab-trigger"
                  onClick={() => setKebabOpen((v) => !v)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
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
        </header>
        <main className="housing-detail-fullpage-main">
          <div className="housinger-page-header">
            <HousingerAvatar
              avatarUrl={profile.avatarUrl}
              name={profile.displayName}
              className="housinger-page-avatar"
            />
            <div className="housinger-page-headertext">
              <h2 className="housinger-page-name">{profile.displayName}</h2>
              {profile.bio && <p className="housinger-page-bio">{profile.bio}</p>}
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
              {isSelf && (
                <button
                  type="button"
                  className="housing-action-btn"
                  onClick={() => useHousingModalStore.getState().openAccount()}
                >
                  {t('housing.housinger.editProfile')}
                </button>
              )}
            </div>
            {/* まとめてツアー + シェア をプロフィール右端へ (2026-07-15 一覧性向上: 独立ツールバー行を
                廃止して一覧を上げる)。まとめてツアーは公開ハウジングが 1 件以上のときだけ出す。 */}
            <div className="housinger-page-header-actions">
              {listings.length > 0 && (
                <button type="button" className="housinger-page-tour-btn" onClick={onTourAll}>
                  {t('housing.housinger.tourAll')}
                </button>
              )}
              <HousingShareButton url={shareUrl} title={profile.displayName} />
            </div>
          </div>

          {listings.length === 0 ? (
            <p className="housinger-page-empty">{t('housing.housinger.noListings')}</p>
          ) : (
            <ListingGrid listings={sorted} sort={sort} onSortChange={setSort} />
          )}
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
    </div>
  );
};
