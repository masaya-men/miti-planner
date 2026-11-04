/**
 * 運営通知 (system_notifications) の購読 + 既読管理 hook。
 *
 * - 取得は `systemNotificationsFeed` に集約 (部品が何個あっても取得は 1 本・5 分に 1 回まで)。
 * - 既読は localStorage で管理 (端末別)、 ログイン不要
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { SystemNotification } from '../types/systemNotification';
import {
  loadReadState,
  markRead as persistMarkRead,
} from '../lib/systemNotifReadStorage';
import {
  getSystemNotificationsSnapshot,
  subscribeSystemNotifications,
} from './systemNotificationsFeed';

export interface UseSystemNotificationsResult {
  items: SystemNotification[];
  unreadCount: number;
  /** 未読のうち最新 1 件。 全て既読なら null */
  latestUnread: SystemNotification | null;
  /** 既読化 (localStorage 更新 + re-render) */
  markRead: (id: string) => void;
}

export function useSystemNotifications(): UseSystemNotificationsResult {
  const items = useSyncExternalStore(subscribeSystemNotifications, getSystemNotificationsSnapshot);
  const [readIds, setReadIds] = useState<string[]>(() => loadReadState().readIds);

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
