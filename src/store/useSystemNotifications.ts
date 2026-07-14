/**
 * 運営通知 (system_notifications) の購読 + 既読管理 hook。
 *
 * - 公開窓口 (`GET /api/template?action=public-notifications`) を fetch でポーリング
 *   (マウント時 + タブ復帰時)。Admin SDK 経由の窓口読みのため App Check 不要。
 * - 既読は localStorage で管理 (端末別)、 ログイン不要
 */
import { useEffect, useMemo, useState } from 'react';
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
    let cancelled = false;
    const load = async () => {
      try {
        // 公開読み窓口 (Admin SDK・キャッシュ・App Check 不要)。素の fetch で App Check を付与しない。
        const res = await fetch('/api/template?action=public-notifications');
        if (!res.ok) return;
        const data = (await res.json()) as { items?: SystemNotification[] };
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        // ネットワーク失敗時は既存 items を維持 (握りつぶし)
      }
    };
    load();
    // タブ復帰時に再取得 (運営通知は低頻度なので常時ポーリングはしない)
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); };
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
