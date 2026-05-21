/**
 * Phase 3: 物件詳細モーダルのルートラッパー
 *
 * - background-location パターンで「上に被せる」 側として App.tsx から描画される
 * - URL の `:listingId` を取って Firestore から listing を読み、 モーダルを開く
 * - URL クエリ `?notification=<id>` がある場合は対応する通知を読み込み、
 *   ガイドモーダル (HousingReportGuideModal) を上に重ねて家主にアクションを促す
 * - ガイドモーダル CTA に応じて編集 / 削除モーダルへ切り替え、 削除完了で背景ルートに戻る
 * - 閉じるとき (ESC / 背景クリック / × / 削除完了): `navigate(-1)` で背景ルートに戻る
 * - listing 取得中・失敗時はモーダルを描画しない (null)
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import type { HousingListing } from '../../../types/housing';
import type { HousingNotification } from '../../../types/notification';
import { HousingDetailModal } from './HousingDetailModal';
import { HousingReportGuideModal } from '../report/HousingReportGuideModal';
import { HousingEditModal } from '../edit/HousingEditModal';
import { HousingDeleteConfirm } from '../delete/HousingDeleteConfirm';
import { useHousingDelete } from '../delete/useHousingDelete';
import { useNotifications } from '../notifications/useNotifications';
import { showToast } from '../../Toast';

export const HousingDetailModalRoute: React.FC = () => {
  const { t } = useTranslation();
  const { listingId } = useParams<{ listingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<HousingListing | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [notification, setNotification] = useState<HousingNotification | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const viewerUid = auth.currentUser?.uid ?? null;

  const { markRead } = useNotifications();
  const { deleteListing, loading: deleting } = useHousingDelete();

  const notificationId = searchParams.get('notification');

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'housing_listings', listingId));
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const data = snap.data();
        if (data.deletedAt || data.isHidden) {
          setNotFound(true);
          return;
        }
        setListing({ id: snap.id, ...data } as HousingListing);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  // notification クエリがあれば、 通知 doc を id で直接取得してガイドを開く。
  // (ベルの購読 items 待ちだと遷移直後に未到達でヒットせず、 ガイドが出ないことがあった)
  useEffect(() => {
    if (!notificationId || guideOpen) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'notifications', notificationId));
        if (cancelled || !snap.exists()) return;
        setNotification({ id: snap.id, ...snap.data() } as HousingNotification);
        setGuideOpen(true);
        // 現状維持: 開いた時点で read。 解決アクション連動は次イテレーションで変更。
        void markRead(notificationId);
      } catch {
        /* 通知取得失敗時はガイドを出さない (詳細モーダルは表示済み) */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationId, guideOpen]);

  const close = () => navigate(-1);

  // 取得失敗 = 背景に戻る (フルページに飛ばしても良いが UX 上モーダルは閉じる)
  useEffect(() => {
    if (notFound) {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound]);

  const onLater = () => setGuideOpen(false);

  const onDispute = () => {
    const url =
      (import.meta as any).env?.VITE_DISCORD_INVITE_URL ?? 'https://discord.gg/';
    window.open(url, '_blank', 'noopener,noreferrer');
    setGuideOpen(false);
  };

  const onEdit = () => {
    setGuideOpen(false);
    setEditOpen(true);
  };

  const onDeleteClick = () => {
    setGuideOpen(false);
    setDeleteOpen(true);
  };

  const onConfirmDelete = async () => {
    if (!listing) return;
    const res = await deleteListing(listing.id);
    if (res.ok) {
      showToast(t('housing.delete.success'), 'success');
      setDeleteOpen(false);
      close();
    } else {
      showToast(t('housing.delete.error'), 'error');
    }
  };

  if (!listing) return null;
  return (
    <>
      <HousingDetailModal
        listing={listing}
        viewerUid={viewerUid}
        onClose={close}
      />
      {notification && (
        <HousingReportGuideModal
          open={guideOpen}
          reason={notification.reason}
          comment={notification.comment}
          onEdit={onEdit}
          onDelete={onDeleteClick}
          onDispute={onDispute}
          onLater={onLater}
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
    </>
  );
};
