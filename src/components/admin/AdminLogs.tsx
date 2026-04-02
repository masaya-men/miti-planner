/**
 * 監査ログ画面
 * GET /api/admin?resource=templates&type=logs で変更履歴取得
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';

// ログエントリーの型
interface LogEntry {
  id: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  target: string;
  adminUid: string;
  changes?: Record<string, unknown>;
  timestamp?: { _seconds: number };
}

// フィルターキーの型
type FilterKey = 'all' | 'skills' | 'stats' | 'contents' | 'templates' | 'config' | 'servers';

/** Firestoreタイムスタンプを相対時刻文字列に変換 */
function relativeTime(seconds: number, isJa: boolean): string {
  const now = Date.now() / 1000;
  const diff = now - seconds;
  if (diff < 60) return isJa ? 'たった今' : 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}${isJa ? '分前' : 'm ago'}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${isJa ? '時間前' : 'h ago'}`;
  return `${Math.floor(diff / 86400)}${isJa ? '日前' : 'd ago'}`;
}

/** target文字列をフィルターキーに変換 */
function targetToFilterKey(target: string): FilterKey {
  if (target.startsWith('template.')) return 'templates';
  if (target === 'skills') return 'skills';
  if (target === 'stats') return 'stats';
  if (target === 'config') return 'config';
  if (target === 'servers') return 'servers';
  if (target.startsWith('backup.')) return 'contents';
  if (target.startsWith('content.')) return 'contents';
  return 'contents';
}

/** target文字列を人間向けの説明に変換（日本語/英語） */
function targetDescription(target: string, isJa: boolean): string {
  if (target.startsWith('template.')) {
    const id = target.slice('template.'.length);
    return isJa ? `テンプレート ${id}` : `Template ${id}`;
  }
  if (target === 'skills') return isJa ? 'スキル' : 'Skills';
  if (target === 'stats') return isJa ? 'ステータス' : 'Stats';
  if (target === 'config') return isJa ? '設定' : 'Config';
  if (target === 'servers') return isJa ? 'サーバー' : 'Servers';
  if (target.startsWith('backup.')) {
    const id = target.slice('backup.'.length);
    return isJa ? `バックアップ ${id}` : `Backup ${id}`;
  }
  if (target.startsWith('content.')) {
    const id = target.slice('content.'.length);
    return isJa ? `コンテンツ ${id}` : `Content ${id}`;
  }
  return target;
}

/** アクションに対応するアイコン文字 */
function actionIcon(action: LogEntry['action']): string {
  switch (action) {
    case 'create': return '+';
    case 'update': return '~';
    case 'delete': return '−';
    case 'restore': return '↩';
    default: return '?';
  }
}

export function AdminLogs() {
  const { t, i18n } = useTranslation();
  const isJa = i18n.language.startsWith('ja');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  /** ログ一覧取得 */
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/admin?resource=templates&type=logs');
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      setLogs(json.logs ?? []);
    } catch {
      setError(t('admin.error_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /** アクション表示ラベル */
  function actionLabel(action: LogEntry['action']): string {
    switch (action) {
      case 'create': return t('admin.logs_action_create');
      case 'update': return t('admin.logs_action_update');
      case 'delete': return t('admin.logs_action_delete');
      case 'restore': return t('admin.logs_action_restore');
      default: return action;
    }
  }

  /** フィルター後の一覧 */
  const filtered = filter === 'all'
    ? logs
    : logs.filter((l) => targetToFilterKey(l.target) === filter);

  const filterItems: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('admin.logs_filter_all') },
    { key: 'skills', label: t('admin.skills') },
    { key: 'stats', label: t('admin.stats') },
    { key: 'contents', label: t('admin.contents') },
    { key: 'templates', label: t('admin.templates') },
    { key: 'config', label: t('admin.config') },
    { key: 'servers', label: t('admin.servers') },
  ];

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-app-3xl font-bold">{t('admin.logs_title')}</h1>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-3 py-1.5 text-app-lg border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : '↺'}
        </button>
      </div>

      {error && <p className="text-app-lg text-app-text-muted mb-4">{error}</p>}

      {/* フィルターボタン */}
      <div className="flex flex-wrap gap-1 mb-4">
        {filterItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`px-3 py-1 text-app-lg rounded border transition-colors ${
              filter === item.key
                ? 'border-app-text bg-app-text text-app-bg'
                : 'border-app-text/20 hover:bg-app-text/10'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ログ一覧 */}
      {loading && <p className="text-app-lg text-app-text-muted">...</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-app-lg text-app-text-muted">{t('admin.logs_no_data')}</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="border border-app-text/10 rounded divide-y divide-app-text/5">
          {filtered.map((entry) => {
            const timeStr = entry.timestamp?._seconds
              ? relativeTime(entry.timestamp._seconds, isJa)
              : '-';

            return (
              <div
                key={entry.id}
                className="px-4 py-3 flex items-center gap-3 hover:bg-app-text/3 transition-colors"
              >
                {/* アクションアイコン */}
                <span className="shrink-0 w-6 h-6 flex items-center justify-center text-app-lg border border-app-text/20 rounded font-mono">
                  {actionIcon(entry.action)}
                </span>

                {/* 情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-app-lg font-medium truncate">
                      {targetDescription(entry.target, isJa)}
                    </span>
                    <span className="shrink-0 text-app-base border border-app-text/20 rounded px-1.5 py-0.5">
                      {actionLabel(entry.action)}
                    </span>
                  </div>
                  <div className="text-app-base text-app-text-muted font-mono truncate mt-0.5">
                    {entry.adminUid}
                  </div>
                </div>

                {/* 日時 */}
                <span className="shrink-0 text-app-base text-app-text-muted">{timeStr}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
