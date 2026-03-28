/**
 * 管理画面 — 設定（閾値など）
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../Toast';

export function AdminConfig() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [threshold, setThreshold] = useState(20);
  const [multiplier, setMultiplier] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();
      const res = await apiFetch('/api/admin/templates?type=config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.promotionThreshold !== undefined) setThreshold(data.promotionThreshold);
        if (data.promotionMultiplier !== undefined) setMultiplier(data.promotionMultiplier);
      }
    } catch {
      showToast(t('admin.error_load'), 'error');
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await user?.getIdToken();
      const res = await apiFetch('/api/admin/templates', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'config',
          promotionThreshold: threshold,
          promotionMultiplier: multiplier,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      showToast(t('admin.config_saved'));
    } catch {
      showToast(t('admin.error_save'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'px-2 py-1.5 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text w-32';

  if (loading) {
    return (
      <div>
        <h1 className="text-lg font-bold mb-4">{t('admin.config_title')}</h1>
        <p className="text-xs text-app-text-muted">...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">{t('admin.config_title')}</h1>

      <div className="p-4 border border-app-text/10 rounded space-y-4 max-w-md">
        <div>
          <label className="block text-xs text-app-text-muted mb-1">
            {t('admin.promotion_threshold')}
          </label>
          <input
            type="number"
            className={inputClass}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            min={1}
          />
        </div>

        <div>
          <label className="block text-xs text-app-text-muted mb-1">
            {t('admin.promotion_multiplier')}
          </label>
          <input
            type="number"
            className={inputClass}
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
            min={1}
            step={0.1}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-xs border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : t('admin.config_save')}
        </button>
      </div>
    </div>
  );
}
