/**
 * Phase 3: ハウジング通知購読フック
 *
 * - users/{uid}/notifications を `createdAt desc, limit 20` で onSnapshot 購読
 * - 未ログイン時は空配列でリターン
 * - markRead / markAllRead は通知 API を叩く (mark-notification-read)
 *
 * 注意: notification doc には reporterUid を含めない方針 (Plan §通報サーバー側)。
 */
import { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getFirestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { buildHousingHeaders } from '../../../lib/housingAuthHeaders';
import type { HousingNotification } from '../../../types/notification';

export interface UseNotificationsResult {
  items: HousingNotification[];
  loading: boolean;
  unreadCount: number;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** 解決時に、 その物件に紐づく通知をまとめて削除 (リスト/バッジから消える)。 */
  deleteForListing: (listingId: string) => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const [items, setItems] = useState<HousingNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ref = collection(getFirestore(), 'users', user.uid, 'notifications');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as HousingNotification[];
      setItems(next);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const unreadCount = items.filter((n) => !n.read).length;

  async function markRead(notificationId: string) {
    if (!getAuth().currentUser) return;
    const headers = await buildHousingHeaders(true);
    await fetch('/api/housing?action=mark-notification-read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ notificationId }),
    });
  }

  async function markAllRead() {
    if (!getAuth().currentUser) return;
    const headers = await buildHousingHeaders(true);
    await fetch('/api/housing?action=mark-notification-read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ all: true }),
    });
  }

  async function deleteForListing(listingId: string) {
    if (!getAuth().currentUser) return;
    const headers = await buildHousingHeaders(true);
    await fetch('/api/housing?action=delete-notification', {
      method: 'POST',
      headers,
      body: JSON.stringify({ listingId }),
    });
  }

  return { items, loading, unreadCount, markRead, markAllRead, deleteForListing };
}
