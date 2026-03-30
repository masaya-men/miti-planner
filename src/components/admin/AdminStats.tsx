/**
 * ステータス管理画面
 * Section 1: レベル補正値テーブル（LevelModifiers）
 * Section 2: パッチステータス（PatchStats）
 * GET /api/admin/templates?type=stats で取得
 * PUT /api/admin/templates { type: 'stats', ... } で保存
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../Toast';
import type { LevelModifier, TemplateStats } from '../../types';

interface StatsData {
  levelModifiers: Record<string, LevelModifier>;
  patchStats: Record<string, TemplateStats>;
  defaultStatsByLevel: Record<string, string>;
}

export function AdminStats() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  /** データ取得 */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/admin/templates?type=stats');
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      setData(json);
      setDirty(false);
    } catch {
      setError(t('admin.error_load'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 保存 */
  const handleSave = async () => {
    if (!data) return;
    try {
      setSaving(true);
      const res = await apiFetch('/api/admin/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'stats',
          levelModifiers: data.levelModifiers,
          patchStats: data.patchStats,
          defaultStatsByLevel: data.defaultStatsByLevel,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      showToast('ステータスデータを保存しました');
      setDirty(false);
    } catch {
      showToast(t('admin.error_save'), 'error');
    } finally {
      setSaving(false);
    }
  };

  /** レベル補正値の更新 */
  const updateLevelMod = (level: string, field: keyof LevelModifier, value: number) => {
    if (!data) return;
    setData({
      ...data,
      levelModifiers: {
        ...data.levelModifiers,
        [level]: {
          ...data.levelModifiers[level],
          [field]: value,
        },
      },
    });
    setDirty(true);
  };

  /** パッチステータスの更新 */
  const updatePatchStat = (
    patch: string,
    role: 'tank' | 'other',
    field: 'hp' | 'mainStat' | 'det' | 'wd',
    value: number,
  ) => {
    if (!data) return;
    setData({
      ...data,
      patchStats: {
        ...data.patchStats,
        [patch]: {
          ...data.patchStats[patch],
          [role]: {
            ...data.patchStats[patch][role],
            [field]: value,
          },
        },
      },
    });
    setDirty(true);
  };

  const inputClass =
    'px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text w-full text-right';
  const thClass = 'pb-2 pr-3 text-left text-app-text-muted font-normal';
  const tdClass = 'py-1.5 pr-3';

  // レベルキーをソート（降順）
  const levelKeys = data
    ? Object.keys(data.levelModifiers).sort((a, b) => Number(b) - Number(a))
    : [];

  // パッチキーをソート（降順）
  const patchKeys = data
    ? Object.keys(data.patchStats).sort((a, b) => Number(b) - Number(a))
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">ステータス管理</h1>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-4 py-1.5 text-xs border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : t('admin.save')}
        </button>
      </div>

      {error && <p className="text-xs text-app-text-muted mb-4">{error}</p>}
      {loading && <p className="text-xs text-app-text-muted">...</p>}

      {!loading && data && (
        <div className="space-y-8">
          {/* Section 1: レベル補正値 */}
          <section>
            <h2 className="text-sm font-bold mb-3">レベル補正値 (LevelModifiers)</h2>
            <p className="text-[10px] text-app-text-muted mb-3">
              各レベルのメインステータス・サブステータス・除算・HP補正値
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr className="border-b border-app-text/10">
                    <th className={thClass}>Lv</th>
                    <th className={thClass}>main</th>
                    <th className={thClass}>sub</th>
                    <th className={thClass}>div</th>
                    <th className={thClass}>hp</th>
                  </tr>
                </thead>
                <tbody>
                  {levelKeys.map((lv) => {
                    const mod = data.levelModifiers[lv];
                    return (
                      <tr key={lv} className="border-b border-app-text/5">
                        <td className={`${tdClass} font-mono font-bold`}>Lv{lv}</td>
                        <td className={tdClass}>
                          <input
                            type="number"
                            className={inputClass}
                            value={mod.main}
                            onChange={(e) => updateLevelMod(lv, 'main', Number(e.target.value))}
                          />
                        </td>
                        <td className={tdClass}>
                          <input
                            type="number"
                            className={inputClass}
                            value={mod.sub}
                            onChange={(e) => updateLevelMod(lv, 'sub', Number(e.target.value))}
                          />
                        </td>
                        <td className={tdClass}>
                          <input
                            type="number"
                            className={inputClass}
                            value={mod.div}
                            onChange={(e) => updateLevelMod(lv, 'div', Number(e.target.value))}
                          />
                        </td>
                        <td className={tdClass}>
                          <input
                            type="number"
                            className={inputClass}
                            value={mod.hp}
                            onChange={(e) => updateLevelMod(lv, 'hp', Number(e.target.value))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 2: パッチステータス */}
          <section>
            <h2 className="text-sm font-bold mb-3">パッチステータス (PatchStats)</h2>
            <p className="text-[10px] text-app-text-muted mb-3">
              パッチごとのタンク/その他ロールのデフォルトステータス値
            </p>
            <div className="space-y-4">
              {patchKeys.map((patch) => {
                const ps = data.patchStats[patch];
                return (
                  <div key={patch} className="border border-app-text/10 rounded p-3">
                    <div className="text-xs font-bold mb-2">Patch {patch}</div>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="border-b border-app-text/10">
                            <th className={thClass}>ロール</th>
                            <th className={thClass}>HP</th>
                            <th className={thClass}>mainStat</th>
                            <th className={thClass}>det</th>
                            <th className={thClass}>wd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(['tank', 'other'] as const).map((role) => (
                            <tr key={role} className="border-b border-app-text/5">
                              <td className={`${tdClass} font-mono`}>
                                {role === 'tank' ? 'Tank' : 'Other'}
                              </td>
                              <td className={tdClass}>
                                <input
                                  type="number"
                                  className={inputClass}
                                  value={ps[role].hp}
                                  onChange={(e) =>
                                    updatePatchStat(patch, role, 'hp', Number(e.target.value))
                                  }
                                />
                              </td>
                              <td className={tdClass}>
                                <input
                                  type="number"
                                  className={inputClass}
                                  value={ps[role].mainStat}
                                  onChange={(e) =>
                                    updatePatchStat(patch, role, 'mainStat', Number(e.target.value))
                                  }
                                />
                              </td>
                              <td className={tdClass}>
                                <input
                                  type="number"
                                  className={inputClass}
                                  value={ps[role].det}
                                  onChange={(e) =>
                                    updatePatchStat(patch, role, 'det', Number(e.target.value))
                                  }
                                />
                              </td>
                              <td className={tdClass}>
                                <input
                                  type="number"
                                  className={inputClass}
                                  value={ps[role].wd}
                                  onChange={(e) =>
                                    updatePatchStat(patch, role, 'wd', Number(e.target.value))
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 3: デフォルトステータス対応 */}
          <section>
            <h2 className="text-sm font-bold mb-3">デフォルトステータス対応 (defaultStatsByLevel)</h2>
            <p className="text-[10px] text-app-text-muted mb-3">
              各レベルで使用するデフォルトパッチバージョン
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr className="border-b border-app-text/10">
                    <th className={thClass}>レベル</th>
                    <th className={thClass}>パッチ</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(data.defaultStatsByLevel)
                    .sort((a, b) => Number(b) - Number(a))
                    .map((lv) => (
                      <tr key={lv} className="border-b border-app-text/5">
                        <td className={`${tdClass} font-mono font-bold`}>Lv{lv}</td>
                        <td className={tdClass}>
                          <input
                            className="px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text"
                            value={data.defaultStatsByLevel[lv]}
                            onChange={(e) => {
                              setData({
                                ...data,
                                defaultStatsByLevel: {
                                  ...data.defaultStatsByLevel,
                                  [lv]: e.target.value,
                                },
                              });
                              setDirty(true);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
