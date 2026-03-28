/**
 * 管理画面ダッシュボード
 * コンテンツ数・テンプレート数の統計カードを表示
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';

export function AdminDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [contentCount, setContentCount] = useState<number | null>(null);
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await user?.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [cRes, tRes] = await Promise.all([
          apiFetch('/api/admin/contents', { headers }),
          apiFetch('/api/admin/templates', { headers }),
        ]);
        if (cancelled) return;
        if (cRes.ok) {
          const cData = await cRes.json();
          setContentCount(Array.isArray(cData) ? cData.length : 0);
        }
        if (tRes.ok) {
          const tData = await tRes.json();
          setTemplateCount(Array.isArray(tData) ? tData.length : 0);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const cardClass =
    'border border-app-text/10 rounded p-4 flex flex-col items-center justify-center min-w-[120px]';

  return (
    <div>
      <h1 className="text-lg font-bold mb-6">{t('admin.dashboard')}</h1>

      {error && (
        <p className="text-xs text-app-text-muted mb-4">{t('admin.error_load')}</p>
      )}

      <div className="flex gap-4">
        {/* コンテンツ数 */}
        <div className={cardClass}>
          <span className="text-2xl font-bold">
            {contentCount !== null ? contentCount : '-'}
          </span>
          <span className="text-[10px] text-app-text-muted mt-1">
            {t('admin.stats_contents')}
          </span>
        </div>

        {/* テンプレート数 */}
        <div className={cardClass}>
          <span className="text-2xl font-bold">
            {templateCount !== null ? templateCount : '-'}
          </span>
          <span className="text-[10px] text-app-text-muted mt-1">
            {t('admin.stats_templates')}
          </span>
        </div>
      </div>
    </div>
  );
}
