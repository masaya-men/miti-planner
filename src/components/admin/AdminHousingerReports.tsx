/**
 * ハウジンガープロフィール通報管理画面 (spec 2026-07-10-housinger-profile-design.md §6.2)
 *
 * AdminHousingReports.tsx / AdminPersonalTags.tsx と同じ「案 B」パターン:
 * 通報数の多い順に最大 50 件表示、各プロフィールの通報レコード (reason/comment/createdAt) を
 * カード内にリスト表示。
 * - 「強制非公開にする」 (isModerationHidden=false 時のみ) と「復帰させる」 (true 時のみ) の 2 択
 * - 各通報レコードは個別に「この通報を却下」 (report doc 削除 + reportCount-1)
 * listing 通報と異なり閾値による自動非表示が無いため、運営が人の目で判断する (spec §6.2)。
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { showToast } from '../Toast';
import type { HousingerReportReason } from '../../lib/housing/housingerProfile';
import { AdminPage } from './AdminPage';

interface ReportRecord {
  id: string;
  reason: HousingerReportReason;
  comment?: string;
  createdAt: number;
}

interface ReportedProfile {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  snsUrl: string | null;
  isPublished: boolean;
  isModerationHidden: boolean;
  reportCount: number;
  reports: ReportRecord[];
}

export function AdminHousingerReports() {
  const { t, i18n } = useTranslation();
  const [profiles, setProfiles] = useState<ReportedProfile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [dismissingReportId, setDismissingReportId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/admin?resource=housinger_reports');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProfiles(json.profiles ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleHide = async (uid: string) => {
    if (!confirm(t('admin.housinger_reports.hide_confirm'))) return;
    setPendingUid(uid);
    try {
      const res = await apiFetch(
        `/api/admin?resource=housinger_reports&action=hide&uid=${encodeURIComponent(uid)}`,
        { method: 'PATCH' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(t('admin.housinger_reports.hide_success'));
      await fetchData();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'failed', 'error');
    } finally {
      setPendingUid(null);
    }
  };

  const handleRestore = async (uid: string) => {
    if (!confirm(t('admin.housinger_reports.restore_confirm'))) return;
    setPendingUid(uid);
    try {
      const res = await apiFetch(
        `/api/admin?resource=housinger_reports&action=restore&uid=${encodeURIComponent(uid)}`,
        { method: 'PATCH' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(t('admin.housinger_reports.restore_success'));
      await fetchData();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'failed', 'error');
    } finally {
      setPendingUid(null);
    }
  };

  const handleDismissOne = async (uid: string, reportId: string) => {
    if (!confirm(t('admin.housinger_reports.dismiss_one_confirm'))) return;
    setDismissingReportId(reportId);
    try {
      const res = await apiFetch(
        `/api/admin?resource=housinger_reports&action=dismiss-one&uid=${encodeURIComponent(uid)}&reportId=${encodeURIComponent(reportId)}`,
        { method: 'PATCH' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(t('admin.housinger_reports.dismiss_one_success'));
      await fetchData();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'failed', 'error');
    } finally {
      setDismissingReportId(null);
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
    <AdminPage title={t('admin.housinger_reports.title')}>
      <p className="text-app-base text-app-text-muted mb-4">
        {t('admin.housinger_reports.description')}
      </p>

      {error && (
        <p className="text-app-base text-app-red mb-4">{error}</p>
      )}

      {loading && (
        <p className="text-app-base text-app-text-muted">{t('admin.loading')}</p>
      )}

      {!loading && profiles?.length === 0 && (
        <p className="text-app-base text-app-text-muted">
          {t('admin.housinger_reports.empty')}
        </p>
      )}

      {!loading && profiles && profiles.length > 0 && (
        <div className="flex flex-col gap-3">
          {profiles.map((p) => (
            <div
              key={p.uid}
              className="border border-app-text/10 rounded p-3 flex gap-3 items-start"
            >
              {p.avatarUrl && (
                <img
                  src={p.avatarUrl}
                  alt=""
                  className="w-16 h-16 object-cover rounded-full shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-app-lg font-bold">{p.displayName}</span>
                  <span className="text-app-sm text-app-red border border-app-red/40 px-2 py-0.5 rounded">
                    {t('admin.housinger_reports.report_count', { count: p.reportCount })}
                  </span>
                  {!p.isPublished && (
                    <span className="text-app-sm text-app-text-muted border border-app-text/20 px-2 py-0.5 rounded">
                      {t('admin.housinger_reports.unpublished_badge')}
                    </span>
                  )}
                  {p.isModerationHidden && (
                    <span className="text-app-sm text-app-text-muted border border-app-text/20 px-2 py-0.5 rounded">
                      {t('admin.housinger_reports.hidden_badge')}
                    </span>
                  )}
                </div>
                {p.bio && <p className="text-app-base mt-1">{p.bio}</p>}
                {p.snsUrl && (
                  <a
                    href={p.snsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-app-sm text-app-text-muted underline break-all"
                  >
                    {p.snsUrl}
                  </a>
                )}
                {/* 通報レコード一覧 (理由 / コメント / 日時 + 個別却下) */}
                {p.reports.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {p.reports.map((r) => (
                      <li
                        key={r.id}
                        className="border-l-2 border-app-red/40 pl-3 py-1 flex items-start gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-app-sm">
                            <span className="font-bold">
                              {t(`admin.housinger_reports.reason.${r.reason}`)}
                            </span>
                            <span className="text-app-text-muted">
                              {' · '}
                              {formatReportTime(r.createdAt)}
                            </span>
                          </div>
                          {r.comment && (
                            <blockquote className="text-app-sm text-app-text-muted mt-1 pl-2 border-l border-app-text/20 italic break-words">
                              {r.comment}
                            </blockquote>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDismissOne(p.uid, r.id)}
                          disabled={dismissingReportId === r.id}
                          className="px-2 py-1 text-app-sm border border-app-text/30 rounded hover:bg-app-text/10 disabled:opacity-50 shrink-0"
                        >
                          {dismissingReportId === r.id
                            ? t('admin.housinger_reports.dismissing_one')
                            : t('admin.housinger_reports.dismiss_one')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {!p.isModerationHidden ? (
                  <button
                    type="button"
                    onClick={() => handleHide(p.uid)}
                    disabled={pendingUid === p.uid}
                    className="px-3 py-1 text-app-base bg-app-red text-white rounded disabled:opacity-50"
                  >
                    {pendingUid === p.uid
                      ? t('admin.housinger_reports.hiding')
                      : t('admin.housinger_reports.hide')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRestore(p.uid)}
                    disabled={pendingUid === p.uid}
                    className="px-3 py-1 text-app-base border border-app-text/30 rounded hover:bg-app-text/10 disabled:opacity-50"
                  >
                    {pendingUid === p.uid
                      ? t('admin.housinger_reports.restoring')
                      : t('admin.housinger_reports.restore')}
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
