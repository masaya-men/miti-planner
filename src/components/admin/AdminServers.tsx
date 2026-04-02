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
import { showToast } from '../Toast';
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

  const inputClass =
    'px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text w-full';
  const labelClass = 'block text-app-base text-app-text-muted mb-0.5';

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

  /** ハウジングエリアのフィールドを更新 */
  const updateHousingArea = (
    areaKey: string,
    field: 'name_jp' | 'apartment_name' | 'aliases',
    value: string | string[],
  ) => {
    if (!data) return;
    setData({
      ...data,
      housingAreas: {
        ...data.housingAreas,
        [areaKey]: {
          ...data.housingAreas[areaKey],
          [field]: value,
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

  /** カンマ区切り文字列 ↔ 配列のヘルパー */
  const toCommaSeparated = (arr: string[]) => arr.join(', ');
  const fromCommaSeparated = (str: string) =>
    str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-app-3xl font-bold">{t('admin.servers')}</h1>
          <p className="text-app-base text-app-text-muted mt-1">
            DC: {dcCount} / {t('admin.servers_server_count')}: {serverCount}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-4 py-1.5 text-app-lg border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : t('admin.save')}
        </button>
      </div>

      {error && <p className="text-app-lg text-app-text-muted mb-4">{error}</p>}
      {loading && <p className="text-app-lg text-app-text-muted">...</p>}

      {!loading && data && (
        <>
          {/* タブナビゲーション */}
          <div className="flex gap-0 border-b border-app-text/10 mb-4">
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

          {/* DC タブ */}
          {activeTab === 'dc' && (
            <div className="flex gap-4">
              {/* 左パネル: DC一覧 */}
              <div className="w-48 shrink-0 border border-app-text/10 rounded">
                <div className="p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
                  {t('admin.servers_dc')}
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {Object.entries(data.datacenters).map(([dcKey, dc]) => {
                    const count = Object.keys(dc.servers).length;
                    return (
                      <button
                        key={dcKey}
                        onClick={() => {
                          setSelectedDc(dcKey);
                          setExpandedServer(null);
                        }}
                        className={`w-full text-left px-3 py-2 text-app-lg border-b border-app-text/5 transition-colors ${
                          selectedDc === dcKey
                            ? 'bg-app-text/10 font-bold'
                            : 'hover:bg-app-text/5'
                        }`}
                      >
                        <span>{dcKey}</span>
                        <span className="ml-1 text-app-text-muted">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 右パネル: 選択DCのサーバー一覧 */}
              <div className="flex-1 border border-app-text/10 rounded">
                <div className="p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
                  {selectedDc
                    ? `${selectedDc} (${Object.keys(data.datacenters[selectedDc]?.servers ?? {}).length})`
                    : 'DCを選択してください'}
                </div>

                {selectedDc && data.datacenters[selectedDc] && (
                  <>
                    {/* DCエイリアス */}
                    <div className="px-3 py-2 border-b border-app-text/10">
                      <label className={labelClass}>
                        DC {t('admin.servers_aliases')}
                      </label>
                      <input
                        className={inputClass}
                        value={toCommaSeparated(data.datacenters[selectedDc].aliases)}
                        onChange={(e) =>
                          updateDcAliases(selectedDc, fromCommaSeparated(e.target.value))
                        }
                        placeholder="alias1, alias2"
                      />
                    </div>

                    {/* サーバーリスト */}
                    <div className="max-h-[60vh] overflow-y-auto">
                      {Object.entries(data.datacenters[selectedDc].servers).length === 0 && (
                        <p className="p-4 text-app-lg text-app-text-muted">
                          {t('admin.no_data')}
                        </p>
                      )}
                      {Object.entries(data.datacenters[selectedDc].servers).map(
                        ([serverKey, aliases]) => (
                          <div key={serverKey} className="border-b border-app-text/5">
                            <button
                              onClick={() =>
                                setExpandedServer(
                                  expandedServer === serverKey ? null : serverKey,
                                )
                              }
                              className="w-full text-left px-3 py-2 text-app-lg hover:bg-app-text/5 transition-colors flex items-center gap-3"
                            >
                              <span className="flex-1">{serverKey}</span>
                              <span className="text-app-text-muted text-app-base">
                                {t('admin.servers_aliases')}: {aliases.length}
                              </span>
                              <span className="text-app-text-muted text-app-base">
                                {expandedServer === serverKey ? '▲' : '▼'}
                              </span>
                            </button>

                            {expandedServer === serverKey && (
                              <div className="px-3 pb-3 pt-1 bg-app-text/5">
                                <label className={labelClass}>
                                  {t('admin.servers_aliases')}
                                </label>
                                <input
                                  className={inputClass}
                                  value={toCommaSeparated(aliases)}
                                  onChange={(e) =>
                                    updateServerAliases(
                                      selectedDc,
                                      serverKey,
                                      fromCommaSeparated(e.target.value),
                                    )
                                  }
                                  placeholder="alias1, alias2"
                                />
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ハウジングエリア タブ */}
          {activeTab === 'housing' && (
            <div className="border border-app-text/10 rounded">
              <div className="p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
                {t('admin.servers_housing')} ({Object.keys(data.housingAreas).length})
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {Object.entries(data.housingAreas).map(([areaKey, area]) => (
                  <div
                    key={areaKey}
                    className="px-3 py-3 border-b border-app-text/5"
                  >
                    <div className="text-app-lg font-bold mb-2">{areaKey}</div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className={labelClass}>name_jp</label>
                        <input
                          className={inputClass}
                          value={area.name_jp}
                          onChange={(e) =>
                            updateHousingArea(areaKey, 'name_jp', e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>apartment_name</label>
                        <input
                          className={inputClass}
                          value={area.apartment_name}
                          onChange={(e) =>
                            updateHousingArea(areaKey, 'apartment_name', e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>{t('admin.servers_aliases')}</label>
                        <input
                          className={inputClass}
                          value={toCommaSeparated(area.aliases)}
                          onChange={(e) =>
                            updateHousingArea(
                              areaKey,
                              'aliases',
                              fromCommaSeparated(e.target.value),
                            )
                          }
                          placeholder="alias1, alias2"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* サイズ タブ */}
          {activeTab === 'sizes' && (
            <div className="border border-app-text/10 rounded">
              <div className="p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
                {t('admin.servers_sizes')} ({data.housingSizes.length})
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {data.housingSizes.map((size, index) => (
                  <div
                    key={size.id}
                    className="px-3 py-3 border-b border-app-text/5"
                  >
                    <div className="text-app-lg font-bold mb-2 font-mono text-app-text-muted">
                      {size.id}
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className={labelClass}>label</label>
                        <input
                          className={inputClass}
                          value={size.label}
                          onChange={(e) =>
                            updateHousingSize(index, 'label', e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>{t('admin.servers_aliases')}</label>
                        <input
                          className={inputClass}
                          value={toCommaSeparated(size.aliases)}
                          onChange={(e) =>
                            updateHousingSize(
                              index,
                              'aliases',
                              fromCommaSeparated(e.target.value),
                            )
                          }
                          placeholder="alias1, alias2"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* タグ タブ */}
          {activeTab === 'tags' && (
            <div className="border border-app-text/10 rounded">
              <div className="p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
                {t('admin.servers_tags')} ({Object.keys(data.tags).length})
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {Object.entries(data.tags).map(([category, tagList]) => (
                  <div
                    key={category}
                    className="px-3 py-3 border-b border-app-text/5"
                  >
                    <div className="text-app-lg font-bold mb-2">{category}</div>
                    <div>
                      <label className={labelClass}>{t('admin.servers_tags')}</label>
                      <input
                        className={inputClass}
                        value={toCommaSeparated(tagList)}
                        onChange={(e) =>
                          updateTags(category, fromCommaSeparated(e.target.value))
                        }
                        placeholder="tag1, tag2, tag3"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
