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
import type { HousingNotification } from '../../../types/notification';

export interface UseNotificationsResult {
  items: HousingNotification[];
  loading: boolean;
  unreadCount: number;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
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
    const user = getAuth().currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    await fetch('/api/housing?action=mark-notification-read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notificationId }),
    });
  }

  async function markAllRead() {
    const user = getAuth().currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    await fetch('/api/housing?action=mark-notification-read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ all: true }),
    });
  }

  return { items, loading, unreadCount, markRead, markAllRead };
}
