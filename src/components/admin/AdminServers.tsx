/**
 * サーバー管理画面
 * DC/ハウジングエリア/サイズ/タグの管理UI
 * GET /api/admin?resource=templates&type=servers で取得
 * PUT /api/admin/templates { type: 'servers', ... } で保存
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../toastBus';
import { AdminPage } from './AdminPage';
import { ServersDcTab } from './servers/ServersDcTab';
import { ServersHousingTab } from './servers/ServersHousingTab';
import { ServersSizesTab } from './servers/ServersSizesTab';
import { ServersTagsTab } from './servers/ServersTagsTab';
import type { MasterServers } from '../../types';

type TabKey = 'dc' | 'housing' | 'sizes' | 'tags';

export function AdminServers() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [data, setData] = useState<MasterServers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // タブ
  const [activeTab, setActiveTab] = useState<TabKey>('dc');
  // DC タブ: 選択中のDC
  const [selectedDc, setSelectedDc] = useState<string | null>(null);
  // DC タブ: 展開中のサーバー
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  /** データ取得 */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/admin?resource=templates&type=servers');
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      setData(json);
      // 最初のDCを選択
      const dcKeys = Object.keys(json.datacenters ?? {});
      if (dcKeys.length > 0 && !selectedDc) {
        setSelectedDc(dcKeys[0]);
      }
      setDirty(false);
    } catch {
      setError(t('admin.error_load'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- user が変わった時にコールバックを作り直し、呼び出し側の effect で再取得させる
  }, [user, t, selectedDc]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 保存 */
  const handleSave = async () => {
    if (!data) return;
    try {
      setSaving(true);
      const res = await apiFetch('/api/admin?resource=templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'servers',
          datacenters: data.datacenters,
          housingAreas: data.housingAreas,
          housingSizes: data.housingSizes,
          tags: data.tags,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      showToast('サーバーデータを保存しました');
      setDirty(false);
    } catch {
      showToast(t('admin.error_save'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // 集計
  const dcCount = data ? Object.keys(data.datacenters).length : 0;
  const serverCount = data
    ? Object.values(data.datacenters).reduce(
        (sum, dc) => sum + Object.keys(dc.servers).length,
        0,
      )
    : 0;


  const tabs: { key: TabKey; labelKey: string }[] = [
    { key: 'dc', labelKey: 'admin.servers_dc' },
    { key: 'housing', labelKey: 'admin.servers_housing' },
    { key: 'sizes', labelKey: 'admin.servers_sizes' },
    { key: 'tags', labelKey: 'admin.servers_tags' },
  ];

  /** DC内のサーバーエイリアスを更新 */
  const updateServerAliases = (dcKey: string, serverKey: string, aliases: string[]) => {
    if (!data) return;
    setData({
      ...data,
      datacenters: {
        ...data.datacenters,
        [dcKey]: {
          ...data.datacenters[dcKey],
          servers: {
            ...data.datacenters[dcKey].servers,
            [serverKey]: aliases,
          },
        },
      },
    });
    setDirty(true);
  };

  /** DCエイリアスを更新 */
  const updateDcAliases = (dcKey: string, aliases: string[]) => {
    if (!data) return;
    setData({
      ...data,
      datacenters: {
        ...data.datacenters,
        [dcKey]: {
          ...data.datacenters[dcKey],
          aliases,
        },
      },
    });
    setDirty(true);
  };

  /** ハウジングエリアの aliases を更新 */
  const updateHousingAreaAliases = (areaKey: string, aliases: string[]) => {
    if (!data) return;
    setData({
      ...data,
      housingAreas: {
        ...data.housingAreas,
        [areaKey]: {
          ...data.housingAreas[areaKey],
          aliases,
        },
      },
    });
    setDirty(true);
  };

  /**
   * ハウジングエリアの多言語フィールド (name / apartment_name) の特定言語値を更新。
   * 2026-05-27 多言語化対応。
   */
  const updateHousingAreaLocalized = (
    areaKey: string,
    field: 'name' | 'apartment_name',
    lang: 'ja' | 'en' | 'ko' | 'zh',
    value: string,
  ) => {
    if (!data) return;
    const current = data.housingAreas[areaKey];
    if (!current) return;
    setData({
      ...data,
      housingAreas: {
        ...data.housingAreas,
        [areaKey]: {
          ...current,
          [field]: {
            ...current[field],
            [lang]: value,
          },
        },
      },
    });
    setDirty(true);
  };

  /** ハウジングサイズのフィールドを更新 */
  const updateHousingSize = (
    index: number,
    field: 'label' | 'aliases',
    value: string | string[],
  ) => {
    if (!data) return;
    const updated = [...data.housingSizes];
    updated[index] = { ...updated[index], [field]: value };
    setData({ ...data, housingSizes: updated });
    setDirty(true);
  };

  /** タグを更新 */
  const updateTags = (category: string, tags: string[]) => {
    if (!data) return;
    setData({
      ...data,
      tags: { ...data.tags, [category]: tags },
    });
    setDirty(true);
  };


  const metaNode = (
    <span className="text-app-base text-app-text-muted">
      DC: {dcCount} / {t('admin.servers_server_count')}: {serverCount}
    </span>
  );

  const actionsNode = (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={handleSave}
        disabled={saving || !dirty}
        className="px-4 py-1.5 text-app-lg border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
      >
        {saving ? '...' : t('admin.save')}
      </button>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`px-4 py-2 text-app-lg transition-colors border-b-2 ${
            activeTab === tab.key
              ? 'border-app-text font-bold'
              : 'border-transparent hover:bg-app-text/5 text-app-text-muted'
          }`}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );

  return (
    <AdminPage
      title={t('admin.servers')}
      meta={metaNode}
      actions={actionsNode}
    >
      {error && <p className="text-app-lg text-app-text-muted mb-4">{error}</p>}
      {loading && <p className="text-app-lg text-app-text-muted">...</p>}

      {!loading && data && (
        <div className="flex flex-col h-full min-h-0">
          {/* DC タブ */}
          {activeTab === 'dc' && (
            <ServersDcTab
              data={data}
              selectedDc={selectedDc}
              setSelectedDc={setSelectedDc}
              expandedServer={expandedServer}
              setExpandedServer={setExpandedServer}
              updateDcAliases={updateDcAliases}
              updateServerAliases={updateServerAliases}
            />
          )}

          {/* ハウジングエリア タブ */}
          {activeTab === 'housing' && (
            <ServersHousingTab
              data={data}
              updateHousingAreaLocalized={updateHousingAreaLocalized}
              updateHousingAreaAliases={updateHousingAreaAliases}
            />
          )}

          {/* サイズ タブ */}
          {activeTab === 'sizes' && (
            <ServersSizesTab data={data} updateHousingSize={updateHousingSize} />
          )}

          {/* タグ タブ */}
          {activeTab === 'tags' && (
            <ServersTagsTab data={data} updateTags={updateTags} />
          )}
        </div>
      )}
    </AdminPage>
  );
}
