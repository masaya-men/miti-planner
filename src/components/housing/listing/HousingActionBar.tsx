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
  /** 親で詳細を閉じるコールバック (削除完了時に呼ぶ) */
  onClose?: () => void;
}

export const HousingActionBar: React.FC<HousingActionBarProps> = ({
  listing,
  viewerUid,
  onClose,
}) => {
  const { t } = useTranslation();
  const isOwner = viewerUid != null && listing.ownerUid === viewerUid;

  const favIds = useHousingFavoritesStore((s) => s.ids);
  const addFav = useHousingFavoritesStore((s) => s.add);
  const removeFav = useHousingFavoritesStore((s) => s.remove);
  const isFav = favIds.includes(listing.id);

  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { deleteListing, loading: deleting } = useHousingDelete();

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

  const onConfirmDelete = async () => {
    const res = await deleteListing(listing.id);
    if (res.ok) {
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

      {isOwner && (
        <HousingDetailKebab
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
        />
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
