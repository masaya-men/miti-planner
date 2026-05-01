/**
 * Featured 設定ページ
 * 既定: 野良主流ビュー（PopularBrowseView）
 * 補助: URL 検索ビュー（共有 URL から shareId を抽出して直接操作）
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { Search, Star, Loader2 } from 'lucide-react';
import { PopularBrowseView } from './PopularBrowseView';

/** 共有URLまたはshareIdからshareId部分を抽出 */
function extractShareId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/share\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return trimmed;
}

interface PlanInfo {
  shareId: string;
  title: string;
  contentId: string | null;
  createdAt: number | null;
  featured: boolean;
  hidden: boolean;
  copyCount: number;
  imageHash: string | null;
}

function getOgpUrl(plan: PlanInfo): string {
  return plan.imageHash
    ? `/og/${plan.imageHash}.png`
    : `/api/og?id=${encodeURIComponent(plan.shareId)}`;
}

function PopularSearchView() {
  const { t } = useTranslation();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [patching, setPatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleSearch = async () => {
    const shareId = extractShareId(input);
    if (!shareId) return;

    setLoading(true);
    setError(null);
    setPlan(null);
    setToast(null);

    try {
      const res = await apiFetch(`/api/admin?resource=ugc&shareId=${encodeURIComponent(shareId)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError(t('admin.featured_not_found'));
          return;
        }
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error: ${res.status}`);
        return;
      }
      const data = await res.json();
      setPlan({
        shareId: data.shareId,
        title: data.title || '',
        contentId: data.contentId || null,
        createdAt: data.createdAt || null,
        featured: data.featured === true,
        hidden: data.hidden === true,
        copyCount: data.copyCount || 0,
        imageHash: data.imageHash || null,
      });
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handlePatch = async (body: Record<string, unknown>, successMsgKey: string) => {
    if (!plan) return;
    setPatching(true);
    setError(null);
    setToast(null);
    try {
      const res = await apiFetch('/api/popular', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: plan.shareId, ...body }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.error || `Error: ${res.status}`);
        return;
      }
      const result = await res.json();
      setPlan({
        ...plan,
        featured: typeof result.featured === 'boolean' ? result.featured : plan.featured,
        hidden: typeof result.hidden === 'boolean' ? result.hidden : plan.hidden,
      });
      setToast(t(successMsgKey));
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setPatching(false);
    }
  };

  const handleToggleFeatured = async (next: boolean) => {
    if (!plan) return;
    const contentIdStr = plan.contentId || '(未設定)';
    const confirmMsg = next
      ? t('admin.featured_confirm_set', { content: contentIdStr })
      : t('admin.featured_confirm_unset');
    if (!confirm(confirmMsg)) return;
    await handlePatch({ featured: next }, next ? 'admin.featured_set_success' : 'admin.featured_unset_success');
  };

  const handleToggleHidden = async (next: boolean) => {
    if (!plan) return;
    const confirmMsg = t(next ? 'admin.popular_hide_confirm' : 'admin.popular_unhide_confirm', {
      title: plan.title || plan.shareId,
    });
    if (!confirm(confirmMsg)) return;
    await handlePatch({ hidden: next }, next ? 'admin.popular_hide_success' : 'admin.popular_unhide_success');
  };

  return (
    <div className="max-w-2xl">
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={t('admin.featured_url_placeholder')}
          className="flex-1 bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text placeholder-app-text-muted focus:border-app-text focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !input.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-app-text text-app-bg font-semibold text-app-lg hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {t('admin.featured_search')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-app-red-dim border border-app-red-border text-app-red text-app-lg">
          {error}
        </div>
      )}

      {toast && (
        <div className="mb-4 p-3 rounded-lg bg-app-blue-dim border border-app-blue-border text-app-blue text-app-lg">
          {toast}
        </div>
      )}

      {plan && (
        <div className="border border-app-border rounded-lg p-4">
          <div className="flex gap-4 mb-4">
            <img
              src={getOgpUrl(plan)}
              alt=""
              className="w-48 h-auto rounded-lg border border-app-border bg-app-surface2"
              style={{ aspectRatio: '1200 / 630', objectFit: 'cover' }}
            />
            <div className="flex-1">
              <table className="w-full text-app-lg">
                <tbody>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted w-28">
                      {t('admin.featured_current_content')}
                    </th>
                    <td className="py-1">{plan.contentId || '—'}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                      {t('admin.featured_plan_title')}
                    </th>
                    <td className="py-1">{plan.title || '—'}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                      {t('admin.featured_copy_count')}
                    </th>
                    <td className="py-1">{plan.copyCount}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                      {t('admin.featured_created')}
                    </th>
                    <td className="py-1">{plan.createdAt ? new Date(plan.createdAt).toLocaleString() : '—'}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">Status</th>
                    <td className="py-1 font-semibold flex flex-wrap gap-2">
                      {plan.featured && (
                        <span className="text-app-yellow flex items-center gap-1">
                          <Star size={14} fill="currentColor" />
                          {t('admin.featured_status_on')}
                        </span>
                      )}
                      {plan.hidden && (
                        <span className="text-app-red">{t('admin.popular_hidden_badge')}</span>
                      )}
                      {!plan.featured && !plan.hidden && (
                        <span className="text-app-text-muted">
                          {t('admin.featured_status_off')}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-app-border pt-4 flex flex-wrap justify-end gap-2">
            <button
              onClick={() => handleToggleFeatured(!plan.featured)}
              disabled={patching}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold transition-colors disabled:opacity-40 ${
                plan.featured
                  ? 'text-app-red hover:bg-app-red-dim'
                  : 'bg-app-blue text-white hover:bg-app-blue-hover'
              }`}
            >
              {patching ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} fill={plan.featured ? 'currentColor' : 'none'} />}
              {plan.featured ? t('admin.featured_unset_button') : t('admin.featured_set_button')}
            </button>
            <button
              onClick={() => handleToggleHidden(!plan.hidden)}
              disabled={patching}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold transition-colors disabled:opacity-40 ${
                plan.hidden
                  ? 'text-app-text border border-app-text hover:bg-app-surface2'
                  : 'text-app-red border border-app-red-border hover:bg-app-red-dim'
              }`}
            >
              {plan.hidden ? t('admin.popular_unhide_button') : t('admin.popular_hide_button')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminFeatured() {
  const { t } = useTranslation();
  const [view, setView] = useState<'browse' | 'search'>('browse');

  return (
    <div>
      {/* セグメントコントロール */}
      <div className="inline-flex p-1 bg-app-surface2 rounded-lg border border-app-border mb-4">
        {(['browse', 'search'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-md text-app-lg font-semibold transition-colors ${
              view === v
                ? 'bg-app-text text-app-bg'
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            {t(v === 'browse' ? 'admin.popular_view_tab' : 'admin.popular_search_tab')}
          </button>
        ))}
      </div>

      {view === 'browse' ? <PopularBrowseView /> : <PopularSearchView />}
    </div>
  );
}
