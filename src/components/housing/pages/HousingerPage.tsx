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
import { firestoreToGalleryListing } from '../../../lib/housing/galleryAdapter';
import { sortListingsForGallery } from '../../../lib/housing/sortListingsForGallery';
import { orderTourStopIds } from '../../../lib/housing/orderTourStops';
import { ListingGrid } from '../browse/ListingGrid';
import type { BrowseSortOrder } from '../browse/BrowseSortSelect';
import { HousingerAvatar } from '../housinger/HousingerAvatar';
import { HousingerReportModal } from '../report/HousingerReportModal';
import { showToast } from '../../Toast';
import type { HousingerProfile } from '../../../types/housing';
import type { MockListing } from '../../../data/housing/mockListings';
import '../../../styles/housing.css';

export const HousingerPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid } = useParams<{ uid: string }>();
  const viewerUid = useAuthStore((s) => s.user?.uid ?? null);

  const [profile, setProfile] = useState<HousingerProfile | null>(null);
  const [listings, setListings] = useState<MockListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [kebabOpen, setKebabOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
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

  const isSelf = viewerUid !== null && uid === viewerUid;

  // HousingActionBar.tsx の onReportClick と同形 (未ログインならログイン案内、それ以外はモーダルを開く)。
  const onReportClick = () => {
    if (!viewerUid) {
      showToast(t('housing.detail.login_required'), 'info');
      return;
    }
    setReportOpen(true);
  };

  // BrowsePage.tsx:66-73 の onStart と同形。
  const onTourAll = () => {
    const ids = listings.map((l) => l.id);
    const orderedIds = orderTourStopIds(ids, listings);
    useHousingTourStore.getState().setListings(orderedIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
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
          {/* Task9: 本人以外にだけ、控えめな「…」メニュー (通報) を出す。 */}
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
          </div>

          {listings.length === 0 ? (
            <p className="housinger-page-empty">{t('housing.housinger.noListings')}</p>
          ) : (
            <>
              <div className="housinger-page-listings-toolbar">
                <button type="button" className="housinger-page-tour-btn" onClick={onTourAll}>
                  {t('housing.housinger.tourAll')}
                </button>
              </div>
              <ListingGrid listings={sorted} sort={sort} onSortChange={setSort} />
            </>
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
    </div>
  );
};
