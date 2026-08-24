/**
 * ハウジング NEW リボン手動固定 管理画面 (2026-08-24)
 *
 * 探すページのNEWリボンは通常「投稿から7日以内 (管理画面で日数変更可)」で自動表示されるが、
 * 管理者が任意のお気に入り物件を選んで期限付きで固定表示させたい場合に使う。
 * AdminFeatured.tsx の検索UIパターン (URL/ID入力→検索→操作) を踏襲。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Sparkles, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { buildListingDetailPath } from '../../constants/housing';
import { AdminPage } from './AdminPage';

/** 物件詳細/編集URL、または生の listingId から listingId を抽出する。 */
function extractListingId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/housing\/(?:p|listing)\/([A-Za-z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  return trimmed;
}

interface ListingInfo {
  id: string;
  title: string;
  dc?: string;
  server?: string;
  area?: string;
  ward?: number;
  imageMode?: string;
  ogImageUrl?: string;
  thumbnailPath?: string;
  deletedAt: number | null;
  isHidden: boolean;
  pinnedNewUntil: number | null;
}

function resolveImageSource(l: ListingInfo): string | null {
  if (l.imageMode === 'thumbnail' && l.thumbnailPath) return l.thumbnailPath;
  if (l.imageMode === 'sns' && l.ogImageUrl) return l.ogImageUrl;
  return null;
}

export function AdminHousingNewBadge() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [patching, setPatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<ListingInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const handleSearch = async () => {
    const listingId = extractListingId(input);
    if (!listingId) return;

    setLoading(true);
    setError(null);
    setListing(null);
    setToast(null);

    try {
      const res = await apiFetch(`/api/admin?resource=housing_new_badge&listingId=${encodeURIComponent(listingId)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError(t('admin.housing_new_badge.not_found'));
          return;
        }
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error: ${res.status}`);
        return;
      }
      const data = await res.json();
      setListing(data);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handlePin = async () => {
    if (!listing) return;
    setPatching(true);
    setError(null);
    setToast(null);
    try {
      const res = await apiFetch(
        `/api/admin?resource=housing_new_badge&action=pin&listingId=${encodeURIComponent(listing.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error: ${res.status}`);
        return;
      }
      const result = await res.json();
      setListing({ ...listing, pinnedNewUntil: result.pinnedNewUntil });
      setToast(t('admin.housing_new_badge.pin_success', { days }));
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setPatching(false);
    }
  };

  const handleUnpin = async () => {
    if (!listing) return;
    if (!confirm(t('admin.housing_new_badge.unpin_confirm'))) return;
    setPatching(true);
    setError(null);
    setToast(null);
    try {
      const res = await apiFetch(
        `/api/admin?resource=housing_new_badge&action=unpin&listingId=${encodeURIComponent(listing.id)}`,
        { method: 'PATCH' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error: ${res.status}`);
        return;
      }
      setListing({ ...listing, pinnedNewUntil: null });
      setToast(t('admin.housing_new_badge.unpin_success'));
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setPatching(false);
    }
  };

  const isPinned = !!listing?.pinnedNewUntil && listing.pinnedNewUntil > Date.now();

  return (
    <AdminPage title={t('admin.housing_new_badge.title')}>
      <div className="max-w-2xl">
        <p className="mb-4 text-app-lg text-app-text-muted">
          {t('admin.housing_new_badge.description')}
        </p>
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('admin.housing_new_badge.search_placeholder')}
            className="flex-1 bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text placeholder-app-text-muted focus:border-app-text focus:outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !input.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-app-text text-app-bg font-semibold text-app-lg hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {t('admin.housing_new_badge.search_button')}
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

        {listing && (
          <div className="border border-app-border rounded-lg p-4">
            <div className="flex gap-4 mb-4">
              {resolveImageSource(listing) ? (
                <img
                  src={resolveImageSource(listing)!}
                  alt=""
                  className="w-32 h-32 rounded-lg border border-app-border bg-app-surface2 object-cover shrink-0"
                />
              ) : (
                <div className="w-32 h-32 rounded-lg border border-app-border bg-app-surface2 shrink-0" />
              )}
              <div className="flex-1">
                <table className="w-full text-app-lg">
                  <tbody>
                    <tr>
                      <th className="text-left font-semibold py-1 pr-3 text-app-text-muted w-24">
                        {t('admin.housing_new_badge.field_title')}
                      </th>
                      <td className="py-1">{listing.title || '—'}</td>
                    </tr>
                    <tr>
                      <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                        {t('admin.housing_new_badge.field_address')}
                      </th>
                      <td className="py-1">
                        {[listing.dc, listing.server, listing.area, listing.ward != null ? `${listing.ward}` : null]
                          .filter(Boolean)
                          .join(' / ') || '—'}
                      </td>
                    </tr>
                    <tr>
                      <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">Status</th>
                      <td className="py-1 font-semibold flex flex-wrap gap-2">
                        {isPinned ? (
                          <span className="text-app-yellow flex items-center gap-1">
                            <Sparkles size={14} fill="currentColor" />
                            {t('admin.housing_new_badge.status_pinned', {
                              date: new Date(listing.pinnedNewUntil!).toLocaleString(),
                            })}
                          </span>
                        ) : (
                          <span className="text-app-text-muted">{t('admin.housing_new_badge.status_off')}</span>
                        )}
                        {listing.isHidden && (
                          <span className="text-app-red">{t('admin.popular_hidden_badge')}</span>
                        )}
                        {listing.deletedAt && (
                          <span className="text-app-red">{t('admin.housing_new_badge.status_deleted')}</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-app-border pt-4 flex flex-wrap items-center justify-end gap-2">
              <label className="flex items-center gap-2 text-app-lg text-app-text-muted mr-auto">
                {t('admin.housing_new_badge.days_label')}
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={days}
                  onChange={(e) => setDays(Math.min(90, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-20 bg-app-surface2 border border-app-border rounded-md px-2 py-1 text-app-text focus:border-app-text focus:outline-none"
                />
                {t('admin.housing_new_badge.days_unit')}
              </label>
              {isPinned && (
                <button
                  onClick={handleUnpin}
                  disabled={patching}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold text-app-red border border-app-red-border hover:bg-app-red-dim transition-colors disabled:opacity-40"
                >
                  {t('admin.housing_new_badge.unpin_button')}
                </button>
              )}
              <button
                onClick={handlePin}
                disabled={patching}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold bg-app-blue text-white hover:bg-app-blue-hover transition-colors disabled:opacity-40"
              >
                {patching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {t('admin.housing_new_badge.pin_button')}
              </button>
              <a
                href={buildListingDetailPath(listing.id)}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-md text-app-lg font-semibold text-app-text border border-app-border hover:bg-app-surface2 transition-colors"
              >
                {t('admin.housing_new_badge.view_listing')}
              </a>
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
