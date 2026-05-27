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
import { findListingsByAddressKey } from '../../../lib/housingListingsService';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { HousingDetailModal } from './HousingDetailModal';
import type { ReportNotice } from './HousingDetailContent';
import { HousingEditModal } from '../edit/HousingEditModal';
import { HousingDeleteConfirm } from '../delete/HousingDeleteConfirm';
import { useHousingDelete } from '../delete/useHousingDelete';
import { useResolveReport } from '../report/useResolveReport';
import { useNotifications } from '../notifications/useNotifications';
import { MAX_SELF_RESTORE } from '../../../constants/housing';
import { showToast } from '../../Toast';
import { purgeIfTweetGone } from '../../../lib/housingApiClient';

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
  // 2026-05-27 Phase 2-3 hotfix: 同 addressKey に自分以外の生きてる listing が居るかどうか。
  // 「今もあります」 ボタン + 「○月○日 確認済」 表示は重複時のみ意味があるので、 これで gate する。
  const [hasDuplicates, setHasDuplicates] = useState(false);
  // §3.8 (2026-05-27): 同 addressKey の他生存 listing 群そのもの。 詳細モーダル下部の
  // 「この住所の他の登録」 セクションで mini カード + 「ちがった」 ボタンに使う。
  const [peers, setPeers] = useState<HousingListing[]>([]);
  const viewerUid = auth.currentUser?.uid ?? null;

  const { deleteForListing } = useNotifications();
  const { deleteListing, loading: deleting } = useHousingDelete();
  const { resolve: resolveReport } = useResolveReport();

  const notificationId = searchParams.get('notification');
  // 通知 doc は notificationId ごとに 1 回だけ取得する。
  // (dismiss で notification=null にした後、 URL の ?notification= が残っていても再取得しないため)
  const fetchedNotifRef = useRef<string | null>(null);
  // SNS 物件のツイート生存チェックは listingId ごとに 1 回だけ走らせる
  const tweetCheckedRef = useRef<string | null>(null);

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

  // 2026-05-27 Phase 2-3 hotfix: listing 取得後に同 addressKey の他 listing を確認。
  // findListingsByAddressKey は isHidden=false で limit(10) を fetch。 client filter で
  // 「自分以外 + deletedAt 無し」 を絞る。 1 fetch / 詳細モーダル open 1 回。
  useEffect(() => {
    if (!listing) {
      setHasDuplicates(false);
      setPeers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const fetched = await findListingsByAddressKey(listing.addressKey);
        if (cancelled) return;
        const others = fetched.filter((l) => l.id !== listing.id && !l.deletedAt);
        setHasDuplicates(others.length > 0);
        setPeers(others);
      } catch {
        // 失敗時は false (= 「今もあります」 ボタンを安全側で隠す)
        if (!cancelled) {
          setHasDuplicates(false);
          setPeers([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listing]);

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

  // 取得失敗 = 削除済み / 非公開 / 存在しない。 静かに閉じず toast で理由を案内してから背景に戻る。
  useEffect(() => {
    if (notFound) {
      showToast(t('housing.detail.unavailable'), 'info');
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound]);

  // SNS 連動物件を開いたら、 その瞬間にサーバーへツイート生存確認を依頼する。
  // サーバー (purge-if-tweet-gone) が live syndication で判定し、 削除済み (tombstone) なら
  // soft delete して deleted:true を返す。 tweet-meta は edge キャッシュ (最大 1h) が古い「生存」を
  // 返し検知を阻むため前段に使わず、 purge を直接呼ぶ (要ログイン。 未ログイン分は cron が掃除)。
  // purgeIfTweetGone は内部で try/catch 済み (失敗/対象外は deleted:false)。
  useEffect(() => {
    if (!listing) return;
    if (listing.imageMode !== 'sns' || !listing.tweetId) return;
    if (tweetCheckedRef.current === listing.id) return;
    tweetCheckedRef.current = listing.id;
    let cancelled = false;
    (async () => {
      const result = await purgeIfTweetGone(listing.id);
      if (cancelled || !result.deleted) return;
      useHousingListingsStore.getState().remove(listing.id);
      showToast(t('housing.detail.postRemoved'), 'info');
      close();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing]);

  // 物件変更後の共通後処理: 詳細を再 fetch (即反映) + 一覧ストア同期 + 関連通知の削除 + バナーを閉じる。
  const refreshAfterChange = async () => {
    const updated = await loadListing();
    if (updated) {
      // 一覧 (ギャラリー) は非表示 / 削除を含まない。 公開対象なら upsert、 そうでなければ除去。
      const inGallery = !updated.isHidden && !updated.deletedAt;
      const vm = inGallery ? firestoreToGalleryListing(updated) : null;
      if (vm) useHousingListingsStore.getState().upsert(vm);
      else useHousingListingsStore.getState().remove(updated.id);
    }
    if (listing) void deleteForListing(listing.id);
    setNotification(null);
  };

  const onDispute = () => {
    const url =
      (import.meta as any).env?.VITE_DISCORD_INVITE_URL ?? 'https://discord.gg/';
    window.open(url, '_blank', 'noopener,noreferrer');
    // 異議は管理者対応に委ねる (非表示は解除しない)。 通知だけ消してバナーを閉じる。
    if (listing) void deleteForListing(listing.id);
    setNotification(null);
  };

  // 「これは誤り (却下)」: 通報を対処済みにして非表示を自己解除し、 即反映。
  const onDismiss = async () => {
    if (!listing) {
      setNotification(null);
      return;
    }
    const res = await resolveReport(listing.id);
    if (!res.ok) {
      showToast(
        t(res.escalation ? 'housing.report.escalation_required' : 'housing.delete.error'),
        'info',
      );
      return; // 復帰できないときはバナーを残す
    }
    await refreshAfterChange();
  };

  // 編集保存成功時: 編集=対処とみなし非表示解除を試み (escalation/失敗時も編集内容は保存済み)、 詳細/一覧へ即反映。
  const handleListingSaved = async () => {
    if (listing) await resolveReport(listing.id);
    await refreshAfterChange();
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

  // kebab (ActionBar) 経由の削除後の後処理: banner 経由の onConfirmDelete と同じく
  // 関連通知を一掃 + 一覧ストアから即除去 (削除 API 呼び出し / toast / close は ActionBar 側)。
  const onListingDeleted = () => {
    if (!listing) return;
    void deleteForListing(listing.id);
    useHousingListingsStore.getState().remove(listing.id);
  };

  if (!listing) return null;

  // 自己復帰の上限を超えて再非表示になった = 却下/編集では戻せず管理者対応 (Discord 異議) のみ。
  const escalated = !!(listing.isHidden && (listing.restoreCount ?? 0) >= MAX_SELF_RESTORE);

  // 2026-05-27 (Phase 2-4): 通報通知 (housing_report) のときだけ案内バナーを出す。
  // duplicate_alert は spec §3.4 で「シンプル A 派 (タップ = listing 詳細に飛ぶ、
  // ボタン直埋め込みナシ)」 と決めたので、 ここでは何もしない。
  const reportNotice: ReportNotice | undefined =
    notification && notification.type === 'housing_report' && notification.reason
      ? {
          reason: notification.reason,
          comment: notification.comment,
          escalated,
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
        hasDuplicates={hasDuplicates}
        peers={peers}
        onClose={close}
        reportNotice={reportNotice}
        onListingUpdated={handleListingSaved}
        onDeleted={onListingDeleted}
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
