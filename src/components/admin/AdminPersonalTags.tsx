/**
 * 個人タグ通報管理画面 (計画書 2026-07-10 タグ体系刷新 Phase B-4)
 *
 * AdminHousingReports.tsx と同じ「案 B」パターン: 通報数の多い順に最大 50 件表示、
 * 各タグの通報レコード (comment/createdAt) をカード内にリスト表示。
 * 「非表示にする」 (isHidden=false 時のみ) と 「表示に戻す」 (isHidden=true 時のみ、
 * 通報記録も一緒にクリア) の 2 アクション。
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { showToast } from '../Toast';
import { AdminPage } from './AdminPage';

interface ReportRecord {
  id: string;
  comment?: string;
  createdAt: number;
}

interface ReportedPersonalTag {
  id: string;
  displayName: string;
  ownerUid: string;
  createdAt: number;
  isHidden: boolean;
  reportCount: number;
  reports: ReportRecord[];
}

export function AdminPersonalTags() {
  const { t, i18n } = useTranslation();
  const [tags, setTags] = useState<ReportedPersonalTag[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/admin?resource=personal_tags');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTags(json.tags ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleHide = async (id: string) => {
    if (!confirm(t('admin.personal_tags.hide_confirm'))) return;
    setPendingId(id);
    try {
      const res = await apiFetch(
        `/api/admin?resource=personal_tags&action=hide&tagId=${encodeURIComponent(id)}`,
        { method: 'PATCH' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(t('admin.personal_tags.hide_success'));
      await fetchData();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'failed', 'error');
    } finally {
      setPendingId(null);
    }
  };

  const handleUnhide = async (id: string) => {
    if (!confirm(t('admin.personal_tags.unhide_confirm'))) return;
    setPendingId(id);
    try {
      const res = await apiFetch(
        `/api/admin?resource=personal_tags&action=unhide&tagId=${encodeURIComponent(id)}`,
        { method: 'PATCH' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(t('admin.personal_tags.unhide_success'));
      await fetchData();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'failed', 'error');
    } finally {
      setPendingId(null);
    }
  };

  const formatReportTime = (ts: number): string => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString(i18n.language || 'ja', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return new Date(ts).toISOString();
    }
  };

  return (
    <AdminPage title={t('admin.personal_tags.title')}>
      <p className="text-app-base text-app-text-muted mb-4">
        {t('admin.personal_tags.description')}
      </p>

      {error && (
        <p className="text-app-base text-app-red mb-4">{error}</p>
      )}

      {loading && (
        <p className="text-app-base text-app-text-muted">{t('admin.loading')}</p>
      )}

      {!loading && tags?.length === 0 && (
        <p className="text-app-base text-app-text-muted">
          {t('admin.personal_tags.empty')}
        </p>
      )}

      {!loading && tags && tags.length > 0 && (
        <div className="flex flex-col gap-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="border border-app-text/10 rounded p-3 flex gap-3 items-start"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-app-lg font-bold">{tag.displayName}</span>
                  <span className="text-app-sm text-app-red border border-app-red/40 px-2 py-0.5 rounded">
                    {t('admin.personal_tags.report_count', { count: tag.reportCount })}
                  </span>
                  {tag.isHidden && (
                    <span className="text-app-sm text-app-text-muted border border-app-text/20 px-2 py-0.5 rounded">
                      {t('admin.personal_tags.hidden_badge')}
                    </span>
                  )}
                </div>
                <div className="text-app-sm text-app-text-muted truncate">
                  {t('admin.personal_tags.id_label')}: {tag.id}
                </div>
                {tag.reports.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {tag.reports.map((r) => (
                      <li key={r.id} className="border-l-2 border-app-red/40 pl-3 py-1">
                        <div className="text-app-sm text-app-text-muted">
                          {formatReportTime(r.createdAt)}
                        </div>
                        {r.comment && (
                          <blockquote className="text-app-sm text-app-text-muted mt-1 pl-2 border-l border-app-text/20 italic break-words">
                            {r.comment}
                          </blockquote>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {!tag.isHidden ? (
                  <button
                    type="button"
                    onClick={() => handleHide(tag.id)}
                    disabled={pendingId === tag.id}
                    className="px-3 py-1 text-app-base bg-app-red text-white rounded disabled:opacity-50"
                  >
                    {pendingId === tag.id
                      ? t('admin.personal_tags.hiding')
                      : t('admin.personal_tags.hide')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUnhide(tag.id)}
                    disabled={pendingId === tag.id}
                    className="px-3 py-1 text-app-base border border-app-text/30 rounded hover:bg-app-text/10 disabled:opacity-50"
                  >
                    {pendingId === tag.id
                      ? t('admin.personal_tags.unhiding')
                      : t('admin.personal_tags.unhide')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
