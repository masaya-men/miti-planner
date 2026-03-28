/**
 * テンプレート管理画面
 * テンプレートの一覧表示・JSONアップロード・削除
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../Toast';

interface TemplateItem {
  contentId: string;
  source: string;
  eventCount: number;
  phaseCount: number;
  locked: boolean;
  updatedAt: string;
}

export function AdminTemplates() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // アップロードフォーム
  const [uploadContentId, setUploadContentId] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** テンプレート一覧を取得 */
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = await user?.getIdToken();
      const res = await apiFetch('/api/admin/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch {
      setError(t('admin.error_load'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  /** JSONファイルをアップロード */
  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !uploadContentId) return;

    try {
      setUploading(true);
      const text = await file.text();
      const json = JSON.parse(text);

      const token = await user?.getIdToken();
      const res = await apiFetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId: uploadContentId,
          timelineEvents: json.timelineEvents ?? json,
          phases: json.phases ?? [],
          source: json.source ?? 'admin_upload',
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      showToast(t('admin.templates_uploaded'));
      setUploadContentId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchTemplates();
    } catch {
      showToast(t('admin.error_save'));
    } finally {
      setUploading(false);
    }
  };

  /** テンプレートを削除 */
  const handleDelete = async (item: TemplateItem) => {
    const ok = window.confirm(
      t('admin.templates_delete_confirm', { name: item.contentId }),
    );
    if (!ok) return;
    try {
      const token = await user?.getIdToken();
      const res = await apiFetch(`/api/admin/templates?contentId=${item.contentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.statusText);
      showToast(t('admin.templates_deleted'));
      await fetchTemplates();
    } catch {
      showToast(t('admin.error_save'));
    }
  };

  const inputClass =
    'px-2 py-1.5 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">{t('admin.templates_title')}</h1>

      {/* アップロードフォーム */}
      <div className="mb-6 p-4 border border-app-text/10 rounded flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] text-app-text-muted mb-1">
            {t('admin.contents_id')}
          </label>
          <input
            className={inputClass}
            value={uploadContentId}
            onChange={(e) => setUploadContentId(e.target.value)}
            placeholder="e.g. m5s"
          />
        </div>
        <div>
          <label className="block text-[10px] text-app-text-muted mb-1">
            {t('admin.templates_upload')}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="text-xs text-app-text-muted file:mr-2 file:px-2 file:py-1 file:text-xs file:border file:border-app-text/20 file:rounded file:bg-transparent file:text-app-text file:cursor-pointer"
          />
        </div>
        <button
          onClick={handleUpload}
          disabled={uploading || !uploadContentId}
          className="px-3 py-1.5 text-xs border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
        >
          {uploading ? '...' : t('admin.upload')}
        </button>
      </div>

      {/* エラー */}
      {error && (
        <p className="text-xs text-app-text-muted mb-4">{error}</p>
      )}

      {/* ローディング */}
      {loading && (
        <p className="text-xs text-app-text-muted">...</p>
      )}

      {/* テーブル */}
      {!loading && templates.length === 0 && (
        <p className="text-xs text-app-text-muted">{t('admin.no_data')}</p>
      )}

      {!loading && templates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-app-text/10 text-left text-app-text-muted">
                <th className="pb-2 pr-4">{t('admin.contents_id')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_source')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_events')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_phases')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_locked')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_last_updated')}</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((item) => (
                <tr
                  key={item.contentId}
                  className="border-b border-app-text/5 hover:bg-app-text/5 transition-colors"
                >
                  <td className="py-2 pr-4 font-mono">{item.contentId}</td>
                  <td className="py-2 pr-4">{item.source}</td>
                  <td className="py-2 pr-4">{item.eventCount}</td>
                  <td className="py-2 pr-4">{item.phaseCount}</td>
                  <td className="py-2 pr-4">
                    {item.locked ? t('admin.templates_locked') : t('admin.templates_unlocked')}
                  </td>
                  <td className="py-2 pr-4 text-app-text-muted">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-app-text-muted hover:text-app-text transition-colors"
                    >
                      {t('admin.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
