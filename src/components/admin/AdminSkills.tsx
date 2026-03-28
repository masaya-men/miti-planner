/**
 * スキル管理画面
 * ジョブ一覧 + スキル一覧のインライン編集UI
 * GET /api/admin/templates?type=skills で取得
 * PUT /api/admin/templates { type: 'skills', ... } で保存
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../Toast';
import type { Job, Mitigation } from '../../types';

interface SkillsData {
  jobs: Job[];
  mitigations: Mitigation[];
  displayOrder: string[];
}
export function AdminSkills() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // 選択中のジョブID
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  // 展開中のスキルID（インライン編集）
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  /** データ取得 */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = await user?.getIdToken();
      const res = await apiFetch('/api/admin/templates?type=skills', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      setData(json);
      // 最初のジョブを選択
      if (json.jobs?.length > 0 && !selectedJobId) {
        setSelectedJobId(json.jobs[0].id);
      }
      setDirty(false);
    } catch {
      setError(t('admin.error_load'));
    } finally {
      setLoading(false);
    }
  }, [user, t, selectedJobId]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 保存 */
  const handleSave = async () => {
    if (!data) return;
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
          type: 'skills',
          jobs: data.jobs,
          mitigations: data.mitigations,
          displayOrder: data.displayOrder,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      showToast('スキルデータを保存しました');
      setDirty(false);
    } catch {
      showToast(t('admin.error_save'), 'error');
    } finally {
      setSaving(false);
    }
  };

  /** スキルのフィールドを更新 */
  const updateSkill = (skillId: string, field: string, value: any) => {
    if (!data) return;
    setData({
      ...data,
      mitigations: data.mitigations.map((m) => {
        if (m.id !== skillId) return m;
        if (field === 'nameJa') return { ...m, name: { ...m.name, ja: value } };
        if (field === 'nameEn') return { ...m, name: { ...m.name, en: value } };
        return { ...m, [field]: value };
      }),
    });
    setDirty(true);
  };

  // 選択中ジョブのスキル
  const jobSkills = data?.mitigations.filter((m) => m.jobId === selectedJobId) ?? [];
  const jobCount = data?.jobs.length ?? 0;
  const skillCount = data?.mitigations.length ?? 0;

  const inputClass =
    'px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text w-full';
  const labelClass = 'block text-[10px] text-app-text-muted mb-0.5';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">スキル管理</h1>
          <p className="text-[10px] text-app-text-muted mt-1">
            ジョブ: {jobCount} / スキル: {skillCount}
          </p>
        </div>
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
        <div className="flex gap-4">
          {/* 左パネル: ジョブ一覧 */}
          <div className="w-48 shrink-0 border border-app-text/10 rounded">
            <div className="p-2 border-b border-app-text/10 text-[10px] text-app-text-muted font-bold">
              ジョブ一覧
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {data.jobs.map((job) => {
                const count = data.mitigations.filter((m) => m.jobId === job.id).length;
                return (
                  <button
                    key={job.id}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setExpandedSkillId(null);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs border-b border-app-text/5 transition-colors ${
                      selectedJobId === job.id
                        ? 'bg-app-text/10 font-bold'
                        : 'hover:bg-app-text/5'
                    }`}
                  >
                    <span>{job.name.ja}</span>
                    <span className="ml-1 text-app-text-muted">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右パネル: スキル一覧 */}
          <div className="flex-1 border border-app-text/10 rounded">
            <div className="p-2 border-b border-app-text/10 text-[10px] text-app-text-muted font-bold">
              {selectedJobId
                ? `${data.jobs.find((j) => j.id === selectedJobId)?.name.ja ?? selectedJobId} のスキル (${jobSkills.length})`
                : 'ジョブを選択してください'}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {jobSkills.length === 0 && (
                <p className="p-4 text-xs text-app-text-muted">スキルがありません</p>
              )}
              {jobSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="border-b border-app-text/5"
                >
                  {/* スキル行（クリックで展開） */}
                  <button
                    onClick={() =>
                      setExpandedSkillId(expandedSkillId === skill.id ? null : skill.id)
                    }
                    className="w-full text-left px-3 py-2 text-xs hover:bg-app-text/5 transition-colors flex items-center gap-3"
                  >
                    <span className="font-mono text-app-text-muted w-24 truncate">{skill.id}</span>
                    <span className="flex-1">{skill.name.ja}</span>
                    <span className="text-app-text-muted">{skill.value}%</span>
                    <span className="text-app-text-muted">{skill.duration}s</span>
                    <span className="text-app-text-muted text-[10px]">
                      {expandedSkillId === skill.id ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* インライン編集フォーム */}
                  {expandedSkillId === skill.id && (
                    <div className="px-3 pb-3 pt-1 bg-app-text/5">
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                        <div>
                          <label className={labelClass}>名前（日本語）</label>
                          <input
                            className={inputClass}
                            value={skill.name.ja}
                            onChange={(e) => updateSkill(skill.id, 'nameJa', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>名前（英語）</label>
                          <input
                            className={inputClass}
                            value={skill.name.en}
                            onChange={(e) => updateSkill(skill.id, 'nameEn', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>効果時間 (秒)</label>
                          <input
                            type="number"
                            className={inputClass}
                            value={skill.duration}
                            onChange={(e) => updateSkill(skill.id, 'duration', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>リキャスト (秒)</label>
                          <input
                            type="number"
                            className={inputClass}
                            value={skill.recast}
                            onChange={(e) => updateSkill(skill.id, 'recast', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>軽減率 (%)</label>
                          <input
                            type="number"
                            className={inputClass}
                            value={skill.value}
                            onChange={(e) => updateSkill(skill.id, 'value', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>タイプ</label>
                          <select
                            className={`${inputClass} bg-app-bg [&>option]:bg-app-bg [&>option]:text-app-text`}
                            value={skill.type}
                            onChange={(e) => updateSkill(skill.id, 'type', e.target.value)}
                          >
                            <option value="all">全体 (all)</option>
                            <option value="magical">魔法 (magical)</option>
                            <option value="physical">物理 (physical)</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>範囲</label>
                          <select
                            className={`${inputClass} bg-app-bg [&>option]:bg-app-bg [&>option]:text-app-text`}
                            value={skill.scope ?? 'party'}
                            onChange={(e) => updateSkill(skill.id, 'scope', e.target.value)}
                          >
                            <option value="self">自分 (self)</option>
                            <option value="party">パーティ (party)</option>
                            <option value="target">対象 (target)</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>最低レベル</label>
                          <input
                            type="number"
                            className={inputClass}
                            value={skill.minLevel ?? ''}
                            onChange={(e) =>
                              updateSkill(
                                skill.id,
                                'minLevel',
                                e.target.value ? Number(e.target.value) : undefined,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
