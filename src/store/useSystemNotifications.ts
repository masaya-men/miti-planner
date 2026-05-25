/**
 * 運営通知 (system_notifications) の購読 + 既読管理 hook。
 *
 * - Firestore 'system_notifications' を published===true で onSnapshot 購読
 * - 既読は localStorage で管理 (端末別)、 ログイン不要
 * - 認証不要で read 可 (Firestore Rules で公開 read)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  getFirestore,
} from 'firebase/firestore';
import type { SystemNotification } from '../types/systemNotification';
import {
  loadReadState,
  markRead as persistMarkRead,
} from '../lib/systemNotifReadStorage';

export interface UseSystemNotificationsResult {
  items: SystemNotification[];
  unreadCount: number;
  /** 未読のうち最新 1 件。 全て既読なら null */
  latestUnread: SystemNotification | null;
  /** 既読化 (localStorage 更新 + re-render) */
  markRead: (id: string) => void;
}

export function useSystemNotifications(): UseSystemNotificationsResult {
  const [items, setItems] = useState<SystemNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => loadReadState().readIds);

  useEffect(() => {
    const ref = collection(getFirestore(), 'system_notifications');
    const q = query(ref, where('published', '==', true), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SystemNotification, 'id'>),
      }));
      setItems(next);
    });
    return () => unsub();
  }, []);

  const unread = useMemo(
    () => items.filter((n) => !readIds.includes(n.id)),
    [items, readIds]
  );

  const latestUnread = unread.length > 0 ? unread[0] : null;

  function markRead(id: string) {
    persistMarkRead(id);
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  return {
    items,
    unreadCount: unread.length,
    latestUnread,
    markRead,
  };
}
