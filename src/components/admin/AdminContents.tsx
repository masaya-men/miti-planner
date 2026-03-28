/**
 * コンテンツ管理画面
 * コンテンツの一覧表示・追加・編集・削除
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../Toast';
import { AdminContentForm, emptyContent, type ContentData } from './AdminContentForm';

export function AdminContents() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [contents, setContents] = useState<ContentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // フォーム状態: null=非表示, ContentData=編集/新規
  const [editing, setEditing] = useState<ContentData | null>(null);
  const [showForm, setShowForm] = useState(false);

  /** コンテンツ一覧を取得 */
  const fetchContents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = await user?.getIdToken();
      const res = await apiFetch('/api/admin/contents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setContents(data);
    } catch {
      setError(t('admin.error_load'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  /** 保存（新規 or 更新） */
  const handleSave = async (data: ContentData) => {
    try {
      setSaving(true);
      const token = await user?.getIdToken();
      const isNew = !editing?.id;
      const res = await apiFetch(
        isNew ? '/api/admin/contents' : `/api/admin/contents/${data.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error(res.statusText);
      showToast(t('admin.contents_saved'));
      setShowForm(false);
      setEditing(null);
      await fetchContents();
    } catch {
      showToast(t('admin.error_save'));
    } finally {
      setSaving(false);
    }
  };

  /** 削除 */
  const handleDelete = async (item: ContentData) => {
    const ok = window.confirm(t('admin.contents_delete_confirm', { name: item.nameJa }));
    if (!ok) return;
    try {
      const token = await user?.getIdToken();
      const res = await apiFetch(`/api/admin/contents/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.statusText);
      showToast(t('admin.contents_deleted'));
      await fetchContents();
    } catch {
      showToast(t('admin.error_save'));
    }
  };

  /** 新規追加を開始 */
  const startAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  /** 編集を開始 */
  const startEdit = (item: ContentData) => {
    setEditing(item);
    setShowForm(true);
  };

  /** フォームを閉じる */
  const cancelForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">{t('admin.contents_title')}</h1>
        <button
          onClick={startAdd}
          className="px-3 py-1.5 text-xs border border-app-text/30 rounded hover:bg-app-text/10 transition-colors"
        >
          + {t('admin.contents_add')}
        </button>
      </div>

      {/* フォーム */}
      {showForm && (
        <div className="mb-6 p-4 border border-app-text/10 rounded">
          <AdminContentForm
            initial={editing ?? emptyContent()}
            onSave={handleSave}
            onCancel={cancelForm}
            saving={saving}
          />
        </div>
      )}

      {/* エラー */}
      {error && (
        <p className="text-xs text-app-text-muted mb-4">{error}</p>
      )}

      {/* ローディング */}
      {loading && (
        <p className="text-xs text-app-text-muted">...</p>
      )}

      {/* テーブル */}
      {!loading && contents.length === 0 && (
        <p className="text-xs text-app-text-muted">{t('admin.no_data')}</p>
      )}

      {!loading && contents.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-app-text/10 text-left text-app-text-muted">
                <th className="pb-2 pr-4">{t('admin.contents_id')}</th>
                <th className="pb-2 pr-4">{t('admin.contents_name_ja')}</th>
                <th className="pb-2 pr-4">{t('admin.contents_category')}</th>
                <th className="pb-2 pr-4">{t('admin.contents_level')}</th>
                <th className="pb-2 pr-4">{t('admin.contents_patch')}</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {contents.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-app-text/5 hover:bg-app-text/5 transition-colors"
                >
                  <td className="py-2 pr-4 font-mono">{item.id}</td>
                  <td className="py-2 pr-4">{item.nameJa}</td>
                  <td className="py-2 pr-4">{item.category}</td>
                  <td className="py-2 pr-4">{item.level}</td>
                  <td className="py-2 pr-4">{item.patch}</td>
                  <td className="py-2 text-right space-x-2">
                    <button
                      onClick={() => startEdit(item)}
                      className="text-app-text-muted hover:text-app-text transition-colors"
                    >
                      {t('admin.edit')}
                    </button>
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
