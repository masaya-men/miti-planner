/**
 * ハウジング通報管理画面 (2026-05-27 アパート対応と同時にα公開最小範囲で新設)
 *
 * - 通報数の多い順に最大 50 件まで一覧表示
 * - 各物件で「物件を見る」 (別タブ) + 「非表示にする」 が実行可能
 * - 復帰 / BAN / 異議申し立て管理は公開後対応
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/apiClient';
import { showToast } from '../Toast';
import { formatHousingAddress } from '../../lib/housing/formatHousingAddress';
import { buildListingDetailPath } from '../../constants/housing';
import type { HousingArea, HousingSize } from '../../types/housing';

interface ReportedListing {
  id: string;
  ownerUid: string;
  dc: string;
  server: string;
  area: HousingArea;
  ward: number;
  buildingType?: 'house' | 'apartment';
  plot?: number;
  size?: HousingSize;
  apartmentBuilding?: 1 | 2;
  roomNumber?: number;
  imageMode: 'sns' | 'thumbnail' | 'none';
  ogImageUrl?: string;
  thumbnailPath?: string;
  tags: string[];
  description: string;
  createdAt: number;
  isHidden: boolean;
  reportCount: number;
}

function resolveImageSource(l: ReportedListing): string | null {
  if (l.imageMode === 'thumbnail' && l.thumbnailPath) return l.thumbnailPath;
  if (l.imageMode === 'sns' && l.ogImageUrl) return l.ogImageUrl;
  return null;
}

export function AdminHousingReports() {
  const { t, i18n } = useTranslation();
  const [listings, setListings] = useState<ReportedListing[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/admin?resource=housing_reports');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setListings(json.listings ?? []);
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
    if (!confirm(t('admin.housing_reports.hide_confirm'))) return;
    setHidingId(id);
    try {
      const res = await apiFetch(
        `/api/admin?resource=housing_reports&action=hide&listingId=${encodeURIComponent(id)}`,
        { method: 'PATCH' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(t('admin.housing_reports.hide_success'));
      await fetchData();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'failed', 'error');
    } finally {
      setHidingId(null);
    }
  };

  const handleRestore = async (id: string) => {
    if (!confirm(t('admin.housing_reports.restore_confirm'))) return;
    setRestoringId(id);
    try {
      const res = await apiFetch(
        `/api/admin?resource=housing_reports&action=restore&listingId=${encodeURIComponent(id)}`,
        { method: 'PATCH' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(t('admin.housing_reports.restore_success'));
      await fetchData();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'failed', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div>
      <h1 className="text-app-3xl font-bold mb-2">{t('admin.housing_reports.title')}</h1>
      <p className="text-app-base text-app-text-muted mb-4">
        {t('admin.housing_reports.description')}
      </p>

      {error && (
        <p className="text-app-base text-app-red mb-4">{error}</p>
      )}

      {loading && (
        <p className="text-app-base text-app-text-muted">{t('admin.loading')}</p>
      )}

      {!loading && listings?.length === 0 && (
        <p className="text-app-base text-app-text-muted">
          {t('admin.housing_reports.empty')}
        </p>
      )}

      {!loading && listings && listings.length > 0 && (
        <div className="flex flex-col gap-3">
          {listings.map((l) => {
            const imgSrc = resolveImageSource(l);
            return (
              <div
                key={l.id}
                className="border border-app-text/10 rounded p-3 flex gap-3 items-start"
              >
                {imgSrc && (
                  <img
                    src={imgSrc}
                    alt=""
                    className="w-24 h-24 object-cover rounded shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-app-lg font-bold">
                      {formatHousingAddress(l, i18n.language)}
                    </span>
                    <span className="text-app-sm text-app-red border border-app-red/40 px-2 py-0.5 rounded">
                      {t('admin.housing_reports.report_count', { count: l.reportCount })}
                    </span>
                    {l.isHidden && (
                      <span className="text-app-sm text-app-text-muted border border-app-text/20 px-2 py-0.5 rounded">
                        {t('admin.housing_reports.hidden_badge')}
                      </span>
                    )}
                  </div>
                  <div className="text-app-sm text-app-text-muted truncate">
                    {l.dc} / {l.server}
                    {l.tags.length > 0 && <> · {l.tags.join(', ')}</>}
                  </div>
                  {l.description && (
                    <p className="text-app-base mt-1 line-clamp-2">{l.description}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Link
                    to={buildListingDetailPath(l.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-app-base border border-app-text/30 rounded hover:bg-app-text/10 text-center"
                  >
                    {t('admin.housing_reports.view')}
                  </Link>
                  {l.isHidden ? (
                    <button
                      type="button"
                      onClick={() => handleRestore(l.id)}
                      disabled={restoringId === l.id}
                      className="px-3 py-1 text-app-base bg-app-blue text-white rounded disabled:opacity-50"
                    >
                      {restoringId === l.id
                        ? t('admin.housing_reports.restoring')
                        : t('admin.housing_reports.restore')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleHide(l.id)}
                      disabled={hidingId === l.id}
                      className="px-3 py-1 text-app-base bg-app-red text-white rounded disabled:opacity-50"
                    >
                      {hidingId === l.id
                        ? t('admin.housing_reports.hiding')
                        : t('admin.housing_reports.hide')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
