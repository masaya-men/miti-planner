/**
 * UGC管理ページ
 * 共有URLからshareIdを抽出して検索 → ロゴ画像の確認・削除
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { Search, Trash2, Loader2 } from 'lucide-react';

/** 共有URLまたはshareIdからshareId部分を抽出 */
function extractShareId(input: string): string {
  const trimmed = input.trim();
  // URL形式: https://lopoly.app/share/AbCd1234 or http://localhost:5173/share/AbCd1234
  const urlMatch = trimmed.match(/\/share\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  // shareIdそのまま（英数字+ハイフン+アンダースコアのみ）
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return trimmed;
}

interface SharedPlanInfo {
  shareId: string;
  title: string;
  contentId: string | null;
  createdAt: number | null;
  type: string;
  hasLogo: boolean;
  logoBase64: string | null;
}

export function AdminUgc() {
  const { t } = useTranslation();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<SharedPlanInfo | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const handleSearch = async () => {
    const shareId = extractShareId(input);
    if (!shareId) return;

    setLoading(true);
    setError(null);
    setPlan(null);
    setDeleteSuccess(false);

    try {
      const res = await apiFetch(`/api/admin?resource=ugc&shareId=${encodeURIComponent(shareId)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error: ${res.status}`);
        return;
      }
      setPlan(await res.json());
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!plan || !confirm(t('admin.ugc_delete_confirm'))) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/admin?resource=ugc&shareId=${encodeURIComponent(plan.shareId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error: ${res.status}`);
        return;
      }
      setPlan({ ...plan, hasLogo: false, logoBase64: null });
      setDeleteSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-app-3xl font-bold mb-4">{t('admin.ugc_title')}</h1>
      <p className="text-app-lg text-app-text-muted mb-4">{t('admin.ugc_description')}</p>

      {/* 検索バー */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={t('admin.ugc_placeholder')}
          className="flex-1 bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text placeholder-app-text-muted focus:border-app-text focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !input.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-app-text text-app-bg font-semibold text-app-lg hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {t('admin.ugc_search')}
        </button>
      </div>

      {/* エラー */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-app-red-dim border border-app-red-border text-app-red text-app-lg">
          {error}
        </div>
      )}

      {/* 検索結果 */}
      {plan && (
        <div className="border border-app-border rounded-lg p-4">
          <table className="w-full text-app-lg mb-4">
            <tbody>
              <tr className="border-b border-app-border/50">
                <th className="text-left font-semibold py-2 pr-4 text-app-text-muted w-32">shareId</th>
                <td className="py-2 font-mono">{plan.shareId}</td>
              </tr>
              <tr className="border-b border-app-border/50">
                <th className="text-left font-semibold py-2 pr-4 text-app-text-muted">{t('admin.ugc_content')}</th>
                <td className="py-2">{plan.contentId || '—'}</td>
              </tr>
              <tr className="border-b border-app-border/50">
                <th className="text-left font-semibold py-2 pr-4 text-app-text-muted">{t('admin.ugc_plan_title')}</th>
                <td className="py-2">{plan.title || '—'}</td>
              </tr>
              <tr className="border-b border-app-border/50">
                <th className="text-left font-semibold py-2 pr-4 text-app-text-muted">{t('admin.ugc_created')}</th>
                <td className="py-2">{plan.createdAt ? new Date(plan.createdAt).toLocaleString() : '—'}</td>
              </tr>
              <tr>
                <th className="text-left font-semibold py-2 pr-4 text-app-text-muted">{t('admin.ugc_type')}</th>
                <td className="py-2">{plan.type === 'bundle' ? 'Bundle' : 'Single'}</td>
              </tr>
            </tbody>
          </table>

          {/* ロゴセクション */}
          <div className="border-t border-app-border pt-4">
            <h3 className="text-app-2xl font-semibold mb-3">{t('admin.ugc_logo')}</h3>
            {plan.hasLogo && plan.logoBase64 ? (
              <div className="flex items-start gap-4">
                <img
                  src={plan.logoBase64}
                  alt="Logo"
                  className="w-24 h-24 rounded-lg object-contain border border-app-border bg-app-surface2"
                />
                <button
                  onClick={handleDeleteLogo}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-app-lg font-semibold text-app-red hover:bg-app-red-dim transition-colors"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {t('admin.ugc_delete_logo')}
                </button>
              </div>
            ) : (
              <p className="text-app-lg text-app-text-muted">
                {deleteSuccess ? t('admin.ugc_delete_success') : t('admin.ugc_no_logo')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
