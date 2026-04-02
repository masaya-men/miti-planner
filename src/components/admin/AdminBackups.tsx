/**
 * バックアップ復元画面
 * GET  /api/admin?resource=templates&type=backups でバックアップ一覧取得
 * PUT  /api/admin?resource=templates { type: 'restore', backupId, backupCollection } で復元
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { showToast } from '../Toast';

// バックアップエントリーの型
interface BackupEntry {
  id: string;
  type: string;
  collection: 'master' | 'template';
  contentId?: string;
  createdAt?: { _seconds: number };
  data?: unknown;
}

// バックアップのフィルター種類
type FilterKey = 'all' | 'skills' | 'stats' | 'contents' | 'servers' | 'template';

/** Firestoreタイムスタンプを相対時刻文字列に変換 */
function relativeTime(seconds: number, isJa: boolean): string {
  const now = Date.now() / 1000;
  const diff = now - seconds;
  if (diff < 60) return isJa ? 'たった今' : 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}${isJa ? '分前' : 'm ago'}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${isJa ? '時間前' : 'h ago'}`;
  return `${Math.floor(diff / 86400)}${isJa ? '日前' : 'd ago'}`;
}

/** バックアップエントリーのtypeをフィルターキーに変換 */
function typeToFilterKey(entry: BackupEntry): FilterKey {
  if (entry.collection === 'template' || entry.type === 'template') return 'template';
  if (entry.type === 'skills') return 'skills';
  if (entry.type === 'stats') return 'stats';
  if (entry.type === 'servers') return 'servers';
  return 'contents';
}

export function AdminBackups() {
  const { t, i18n } = useTranslation();
  const isJa = i18n.language.startsWith('ja');

  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  /** バックアップ一覧取得 */
  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/admin?resource=templates&type=backups');
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      setBackups(json.backups ?? []);
    } catch {
      setError(t('admin.error_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  /** 復元実行 */
  const handleRestore = async (entry: BackupEntry) => {
    if (restoring) return;
    try {
      setRestoring(true);
      const res = await apiFetch('/api/admin?resource=templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'restore',
          backupId: entry.id,
          backupCollection: entry.collection,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      showToast(t('admin.backups_restore_success'));
      setConfirmId(null);
      await fetchBackups();
    } catch {
      showToast(t('admin.error_save'), 'error');
    } finally {
      setRestoring(false);
    }
  };

  /** フィルター後の一覧 */
  const filtered = filter === 'all'
    ? backups
    : backups.filter((b) => typeToFilterKey(b) === filter);

  const filterItems: { key: FilterKey; labelKey: string }[] = [
    { key: 'all', labelKey: 'admin.backups_filter_all' },
    { key: 'skills', labelKey: 'admin.backups_type_skills' },
    { key: 'stats', labelKey: 'admin.backups_type_stats' },
    { key: 'contents', labelKey: 'admin.backups_type_contents' },
    { key: 'servers', labelKey: 'admin.backups_type_servers' },
    { key: 'template', labelKey: 'admin.backups_type_template' },
  ];

  /** バックアップエントリーの表示ラベル */
  function entryLabel(entry: BackupEntry): string {
    const fk = typeToFilterKey(entry);
    const typeLabel = t(`admin.backups_type_${fk}`);
    if (entry.contentId) return `${typeLabel} — ${entry.contentId}`;
    return typeLabel;
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-app-3xl font-bold">{t('admin.backups_title')}</h1>
        <button
          onClick={fetchBackups}
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
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {/* バックアップ一覧 */}
      {loading && <p className="text-app-lg text-app-text-muted">...</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-app-lg text-app-text-muted">{t('admin.backups_no_data')}</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="border border-app-text/10 rounded divide-y divide-app-text/5">
          {filtered.map((entry) => {
            const isConfirming = confirmId === entry.id;
            const timeStr = entry.createdAt?._seconds
              ? relativeTime(entry.createdAt._seconds, isJa)
              : '-';

            return (
              <div
                key={entry.id}
                className="px-4 py-3 flex items-center gap-3 hover:bg-app-text/3 transition-colors"
              >
                {/* タイプバッジ */}
                <span className="shrink-0 text-app-base border border-app-text/20 rounded px-1.5 py-0.5 font-mono">
                  {typeToFilterKey(entry)}
                </span>

                {/* 情報 */}
                <div className="flex-1 min-w-0">
                  <div className="text-app-lg font-medium truncate">{entryLabel(entry)}</div>
                  <div className="text-app-base text-app-text-muted font-mono truncate mt-0.5">
                    {entry.id}
                  </div>
                </div>

                {/* 日時 */}
                <span className="shrink-0 text-app-base text-app-text-muted">{timeStr}</span>

                {/* 復元ボタン / 確認ダイアログ */}
                {isConfirming ? (
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-app-base text-app-text-muted max-w-[160px] text-right leading-tight">
                      {t('admin.backups_restore_confirm')}
                    </span>
                    <button
                      onClick={() => handleRestore(entry)}
                      disabled={restoring}
                      className="px-2 py-1 text-app-base border border-app-text rounded bg-app-text text-app-bg hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {restoring ? '...' : 'OK'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      disabled={restoring}
                      className="px-2 py-1 text-app-base border border-app-text/30 rounded hover:bg-app-text/10 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(entry.id)}
                    className="shrink-0 px-3 py-1 text-app-lg border border-app-text/30 rounded hover:bg-app-text/10 transition-colors"
                  >
                    {t('admin.backups_restore')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
