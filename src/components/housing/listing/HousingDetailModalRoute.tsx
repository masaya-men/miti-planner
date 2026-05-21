/**
 * Phase 3: 物件詳細モーダルのルートラッパー
 *
 * - background-location パターンで「上に被せる」 側として App.tsx から描画される
 * - URL の `:listingId` を取って Firestore から listing を読み、 モーダルを開く
 * - URL クエリ `?notification=<id>` がある場合は通知 doc を id で直接読み込み、
 *   詳細モーダル内に「通報の案内バナー」を出して家主にアクションを促す
 *   (別モーダルを重ねるとスタッキングが破綻するため、 詳細の中に出す)
 * - 開いただけ / 読んだだけでは解決しない。 解決アクション (誤りとして却下 / 異議 / 削除) で read=解決にする
 * - 閉じるとき (ESC / 背景クリック / × / 削除完了): `navigate(-1)` で背景ルートに戻る
 * - listing 取得中・失敗時はモーダルを描画しない (null)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import type { HousingListing } from '../../../types/housing';
import type { HousingNotification } from '../../../types/notification';
import { HousingDetailModal } from './HousingDetailModal';
import type { ReportNotice } from './HousingDetailContent';
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
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const viewerUid = auth.currentUser?.uid ?? null;

  const { markRead } = useNotifications();
  const { deleteListing, loading: deleting } = useHousingDelete();

  const notificationId = searchParams.get('notification');
  // 通知 doc は notificationId ごとに 1 回だけ取得する。
  // (dismiss で notification=null にした後、 URL の ?notification= が残っていても再取得しないため)
  const fetchedNotifRef = useRef<string | null>(null);

  // listing 取得は初回マウントと編集保存後 (即反映) の両方から呼べるよう関数化。
  const loadListing = useCallback(async () => {
    if (!listingId) return;
    try {
      const snap = await getDoc(doc(db, 'housing_listings', listingId));
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
      setNotFound(true);
    }
  }, [listingId]);

  useEffect(() => {
    void loadListing();
  }, [loadListing]);

  // notification クエリがあれば、 通知 doc を id で直接取得して案内バナー用にセット。
  // (購読 items 待ちだと遷移直後に未到達でヒットしないため getDoc で確実に取る)
  // 開いた時点では read にしない (= 読んだだけでは解決扱いにしない)。
  useEffect(() => {
    if (!notificationId) return;
    if (fetchedNotifRef.current === notificationId) return; // 取得済みなら再取得しない
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    fetchedNotifRef.current = notificationId;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'notifications', notificationId));
        if (cancelled || !snap.exists()) return;
        setNotification({ id: snap.id, ...snap.data() } as HousingNotification);
      } catch {
        /* 通知取得失敗時はバナーを出さない (詳細モーダルは表示済み) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notificationId]);

  const close = () => navigate(-1);

  // 取得失敗 = 背景に戻る (フルページに飛ばしても良いが UX 上モーダルは閉じる)
  useEffect(() => {
    if (notFound) {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound]);

  // 通報を「確認のうえ解決済み」 にする (read=解決)。 バナーを閉じる。
  const resolveNotification = () => {
    if (notification) void markRead(notification.id);
    setNotification(null);
  };

  const onDispute = () => {
    const url =
      (import.meta as any).env?.VITE_DISCORD_INVITE_URL ?? 'https://discord.gg/';
    window.open(url, '_blank', 'noopener,noreferrer');
    resolveNotification();
  };

  const onDismiss = () => resolveNotification();

  // 編集保存成功時: 詳細を再 fetch して即反映 + 関連通報を解決済みにする (自動解決)。
  const handleListingSaved = async () => {
    await loadListing();
    resolveNotification();
  };

  const onEdit = () => setEditOpen(true);
  const onDeleteClick = () => setDeleteOpen(true);

  const onConfirmDelete = async () => {
    if (!listing) return;
    const res = await deleteListing(listing.id);
    if (res.ok) {
      // 物件が無くなるので関連通報も解決済みにする
      if (notification) void markRead(notification.id);
      showToast(t('housing.delete.success'), 'success');
      setDeleteOpen(false);
      close();
    } else {
      showToast(t('housing.delete.error'), 'error');
    }
  };

  if (!listing) return null;

  const reportNotice: ReportNotice | undefined = notification
    ? {
        reason: notification.reason,
        comment: notification.comment,
        onEdit,
        onDelete: onDeleteClick,
        onDispute,
        onDismiss,
      }
    : undefined;

  return (
    <>
      <HousingDetailModal
        listing={listing}
        viewerUid={viewerUid}
        onClose={close}
        reportNotice={reportNotice}
        onListingUpdated={handleListingSaved}
      />
      {editOpen && (
        <HousingEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          listing={listing}
          onSaved={handleListingSaved}
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
