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
import { canViewListing } from '../../../lib/housing/listingVisibility';
import { firestoreToGalleryListing } from '../../../lib/housing/galleryAdapter';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
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

  const { deleteForListing } = useNotifications();
  const { deleteListing, loading: deleting } = useHousingDelete();

  const notificationId = searchParams.get('notification');
  // 通知 doc は notificationId ごとに 1 回だけ取得する。
  // (dismiss で notification=null にした後、 URL の ?notification= が残っていても再取得しないため)
  const fetchedNotifRef = useRef<string | null>(null);

  // listing 取得は初回マウントと編集保存後 (即反映) の両方から呼べるよう関数化。
  // 戻り値: 取得できた listing (家主は自分の非表示物件も取得可)、 取得不可なら null。
  const loadListing = useCallback(async (): Promise<HousingListing | null> => {
    if (!listingId) return null;
    try {
      const snap = await getDoc(doc(db, 'housing_listings', listingId));
      if (!snap.exists()) {
        setNotFound(true);
        return null;
      }
      const data = snap.data();
      // 家主は自分の物件なら非表示でも開ける (通知から編集/異議/削除で対処するため)。
      const uid = auth.currentUser?.uid ?? null;
      if (!canViewListing(data as HousingListing, uid)) {
        setNotFound(true);
        return null;
      }
      const next = { id: snap.id, ...data } as HousingListing;
      setListing(next);
      return next;
    } catch {
      setNotFound(true);
      return null;
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

  // 通報を解決する。 解決済みの通知はリストから消す方針なので、 その物件の通知を削除。
  const resolveNotification = () => {
    if (notification) void deleteForListing(notification.listingId);
    setNotification(null);
  };

  const onDispute = () => {
    const url =
      (import.meta as any).env?.VITE_DISCORD_INVITE_URL ?? 'https://discord.gg/';
    window.open(url, '_blank', 'noopener,noreferrer');
    resolveNotification();
  };

  const onDismiss = () => resolveNotification();

  // 編集保存成功時: 詳細を再 fetch して即反映 + 中央パネルの一覧カードも更新 + 関連通報を解決。
  const handleListingSaved = async () => {
    const updated = await loadListing();
    if (updated) {
      // 一覧 (ギャラリー) は非表示 / 削除を含まない。 公開対象なら upsert、 そうでなければ除去。
      const inGallery = !updated.isHidden && !updated.deletedAt;
      const vm = inGallery ? firestoreToGalleryListing(updated) : null;
      if (vm) useHousingListingsStore.getState().upsert(vm);
      else useHousingListingsStore.getState().remove(updated.id);
    }
    resolveNotification();
  };

  const onEdit = () => setEditOpen(true);
  const onDeleteClick = () => setDeleteOpen(true);

  const onConfirmDelete = async () => {
    if (!listing) return;
    const res = await deleteListing(listing.id);
    if (res.ok) {
      // 物件が無くなるので、 その物件に紐づく通知も一掃する
      void deleteForListing(listing.id);
      // 一覧 (ギャラリー) からも即除去
      useHousingListingsStore.getState().remove(listing.id);
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
