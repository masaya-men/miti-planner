/**
 * Phase 3: 物件詳細のアクションバー
 *
 * 表示:
 * - お気に入りトグル (常時)
 * - シェアボタン (常時)
 * - 「ちがった」 (= 通報) ボタン (家主以外に表示)
 * - kebab メニュー (家主のみ、 編集 / 削除)
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '../../../types/housing';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { confirmListing } from '../../../lib/housingApiClient';
import { showToast } from '../../Toast';
import { HousingDetailKebab } from './HousingDetailKebab';
import { HousingShareButton } from './HousingShareButton';
import { HousingEditModal } from '../edit/HousingEditModal';
import { HousingDeleteConfirm } from '../delete/HousingDeleteConfirm';
import { useHousingDelete } from '../delete/useHousingDelete';
import { HousingReportModal } from '../report/HousingReportModal';

export interface HousingActionBarProps {
  listing: HousingListing;
  /** ログインしてれば UID、 未ログインは null */
  viewerUid: string | null;
  /**
   * 同 addressKey に自分以外の生きてる listing が居るとき true。
   * 「今もあります」 ボタン + 「○月○日 確認済」 表示は重複時のみ意味があるため、
   * これが true のときだけ描画する (= 単独 listing では UI ノイズになるので隠す、
   * 設計書 §3.5 訂正 2026-05-27)。
   */
  hasDuplicates?: boolean;
  /** 親で詳細を閉じるコールバック (削除完了時に呼ぶ) */
  onClose?: () => void;
  /** 編集保存成功時に呼ぶ callback (親で詳細を再 fetch して即反映する) */
  onListingUpdated?: () => void;
  /** 削除成功時に呼ぶ callback (親で一覧ストア除去 + 関連通知の一掃を行う) */
  onDeleted?: () => void;
}

export const HousingActionBar: React.FC<HousingActionBarProps> = ({
  listing,
  viewerUid,
  hasDuplicates = false,
  onClose,
  onListingUpdated,
  onDeleted,
}) => {
  const { t, i18n } = useTranslation();
  const isOwner = viewerUid != null && listing.ownerUid === viewerUid;

  const favIds = useHousingFavoritesStore((s) => s.ids);
  const addFav = useHousingFavoritesStore((s) => s.add);
  const removeFav = useHousingFavoritesStore((s) => s.remove);
  const isFav = favIds.includes(listing.id);

  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { deleteListing, loading: deleting } = useHousingDelete();
  // 2026-05-27 Phase 2-3: 「今もあります」 ボタン。 押下成功で local state を
  // 上書きすることで、 モーダルを閉じずに「○月○日 確認済」 表示を即更新する。
  // 親 (HousingDetailModalRoute) で再 fetch すれば永続反映、 ここは表示のみ即更新。
  const [confirmedAtOverride, setConfirmedAtOverride] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const effectiveLastConfirmedAt = confirmedAtOverride ?? listing.lastConfirmedAt;

  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/housing/listing/${listing.id}`
      : `/housing/listing/${listing.id}`;
  const titleForShare = listing.description?.slice(0, 60) || listing.addressKey || 'LoPo Housing';

  const onToggleFavorite = () => {
    if (isFav) removeFav(listing.id);
    else addFav(listing.id);
  };

  const onReportClick = () => {
    if (!viewerUid) {
      showToast(t('housing.detail.login_required'), 'info');
      return;
    }
    if (isOwner) {
      showToast(t('housing.detail.cannot_report_own'), 'info');
      return;
    }
    setReportOpen(true);
  };

  const onConfirmStillHere = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      const result = await confirmListing(listing.id);
      setConfirmedAtOverride(result.lastConfirmedAt);
      showToast(t('housing.detail.confirm_success'), 'success');
      onListingUpdated?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown_error';
      if (message === 'forbidden_hidden') {
        showToast(t('housing.detail.confirm_error_forbidden_hidden'), 'error');
      } else {
        showToast(t('housing.detail.confirm_error'), 'error');
      }
    } finally {
      setConfirming(false);
    }
  };

  const onConfirmDelete = async () => {
    const res = await deleteListing(listing.id);
    if (res.ok) {
      // 一覧ストア除去 + 関連通知の一掃 (banner 経由の削除と同じ後処理) を親に委譲。
      onDeleted?.();
      showToast(t('housing.delete.success'), 'success');
      setDeleteOpen(false);
      onClose?.();
    } else {
      showToast(t('housing.delete.error'), 'error');
    }
  };

  return (
    <div className="housing-action-bar">
      <button
        type="button"
        className="housing-action-btn"
        aria-pressed={isFav}
        aria-label={
          isFav ? t('housing.detail.favorited_aria') : t('housing.detail.favorite_aria')
        }
        onClick={onToggleFavorite}
      >
        {isFav ? '♥' : '♡'}
      </button>

      <HousingShareButton url={url} title={titleForShare} />

      {!isOwner && (
        <button
          type="button"
          className="housing-action-btn"
          onClick={onReportClick}
          aria-label={t('housing.detail.report_button')}
        >
          {t('housing.detail.report_button')}
        </button>
      )}

      {isOwner && hasDuplicates && (
        <button
          type="button"
          className="housing-action-btn housing-action-btn--still-here"
          onClick={onConfirmStillHere}
          disabled={confirming}
          aria-label={t('housing.detail.still_here_aria')}
        >
          {t('housing.detail.still_here_button')}
        </button>
      )}

      {isOwner && (
        <HousingDetailKebab
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
        />
      )}

      {hasDuplicates && effectiveLastConfirmedAt && (
        <span className="housing-action-bar-confirmed-at" aria-live="polite">
          {t('housing.detail.last_confirmed_at', {
            date: new Date(effectiveLastConfirmedAt).toLocaleDateString(i18n.language, {
              month: 'long',
              day: 'numeric',
            }),
          })}
        </span>
      )}

      {reportOpen && (
        <HousingReportModal
          open={reportOpen}
          listingId={listing.id}
          onClose={() => setReportOpen(false)}
        />
      )}
      {editOpen && (
        <HousingEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          listing={listing}
          onSaved={onListingUpdated}
        />
      )}
      {deleteOpen && (
        <HousingDeleteConfirm
          open={deleteOpen}
          listingTitle={listing.description ?? listing.addressKey}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={onConfirmDelete}
          loading={deleting}
        />
      )}
    </div>
  );
};
