/**
 * スキル管理画面（統合版）
 * - ジョブ一覧 + スキル一覧
 * - 「+スキル追加」ボタンで追加モーダル
 * - スキルクリックで編集モーダル
 * - 全フィールド対応（zh/ko含む）
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../Toast';
import { SkillFormModal } from './SkillFormModal';
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

    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    // モーダル状態
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSkill, setEditingSkill] = useState<Mitigation | null>(null);

    /** データ取得 */
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const res = await apiFetch('/api/admin?resource=templates&type=skills');
            if (!res.ok) throw new Error(res.statusText);
            const json = await res.json();
            setData(json);
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

    /** 保存（全データ一括） */
    const handleSave = async (updatedData?: SkillsData) => {
        const d = updatedData ?? data;
        if (!d) return;
        try {
            setSaving(true);
            const res = await apiFetch('/api/admin?resource=templates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'skills',
                    jobs: d.jobs,
                    mitigations: d.mitigations,
                    displayOrder: d.displayOrder,
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

    /** モーダルからのスキル保存 */
    const handleSkillSave = async (skill: Mitigation, isNew: boolean) => {
        if (!data) return;

        let newMitigations: Mitigation[];
        let newDisplayOrder = [...data.displayOrder];

        if (isNew) {
            newMitigations = [...data.mitigations, skill];
            newDisplayOrder.push(skill.id);
        } else {
            newMitigations = data.mitigations.map(m => m.id === skill.id ? skill : m);
        }

        const newData = { ...data, mitigations: newMitigations, displayOrder: newDisplayOrder };
        setData(newData);
        setDirty(true);

        // 即座に保存
        await handleSave(newData);
        setModalOpen(false);
        setEditingSkill(null);
    };

    /** スキル削除 */
    const handleDelete = async (skillId: string) => {
        if (!data) return;
        if (!confirm('このスキルを削除しますか？')) return;

        const newData = {
            ...data,
            mitigations: data.mitigations.filter(m => m.id !== skillId),
            displayOrder: data.displayOrder.filter(id => id !== skillId),
        };
        setData(newData);
        setDirty(true);
        await handleSave(newData);
    };

    // 新規追加モーダルを開く
    const openAddModal = () => {
        setEditingSkill(null);
        setModalOpen(true);
    };

    // 編集モーダルを開く
    const openEditModal = (skill: Mitigation) => {
        setEditingSkill(skill);
        setModalOpen(true);
    };

    const jobSkills = data?.mitigations.filter((m) => m.jobId === selectedJobId) ?? [];
    const jobCount = data?.jobs.length ?? 0;
    const skillCount = data?.mitigations.length ?? 0;
    const selectedJob = data?.jobs.find(j => j.id === selectedJobId);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-app-3xl font-bold">スキル管理</h1>
                    <p className="text-app-base text-app-text-muted mt-1">
                        ジョブ: {jobCount} / スキル: {skillCount}
                    </p>
                </div>
                <div className="flex gap-2">
                    {dirty && (
                        <button
                            onClick={() => handleSave()}
                            disabled={saving}
                            className="px-4 py-1.5 text-app-lg border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
                        >
                            {saving ? '...' : t('admin.save')}
                        </button>
                    )}
                </div>
            </div>

            {error && <p className="text-app-lg text-app-text-muted mb-4">{error}</p>}
            {loading && <p className="text-app-lg text-app-text-muted">...</p>}

            {!loading && data && (
                <div className="flex gap-4">
                    {/* 左パネル: ジョブ一覧 */}
                    <div className="w-48 shrink-0 border border-app-text/10 rounded">
                        <div className="p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
                            ジョブ一覧
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto">
                            {data.jobs.map((job) => {
                                const count = data.mitigations.filter((m) => m.jobId === job.id).length;
                                return (
                                    <button
                                        key={job.id}
                                        onClick={() => setSelectedJobId(job.id)}
                                        className={`w-full text-left px-3 py-2 text-app-lg border-b border-app-text/5 transition-colors ${selectedJobId === job.id
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
                        <div className="p-2 border-b border-app-text/10 flex items-center justify-between">
                            <span className="text-app-base text-app-text-muted font-bold">
                                {selectedJob
                                    ? `${selectedJob.name.ja} のスキル (${jobSkills.length})`
                                    : 'ジョブを選択してください'}
                            </span>
                            {selectedJobId && (
                                <button
                                    onClick={openAddModal}
                                    className="px-3 py-1 text-app-lg bg-app-text text-app-bg rounded hover:opacity-90 transition-opacity font-bold"
                                >
                                    + スキル追加
                                </button>
                            )}
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto">
                            {jobSkills.length === 0 && selectedJobId && (
                                <div className="p-8 text-center">
                                    <p className="text-app-lg text-app-text-muted mb-3">スキルがありません</p>
                                    <button onClick={openAddModal}
                                        className="px-4 py-2 text-app-lg border border-app-text/20 rounded hover:bg-app-text/10 transition-colors">
                                        最初のスキルを追加する
                                    </button>
                                </div>
                            )}
                            {jobSkills.map((skill) => (
                                <div key={skill.id} className="border-b border-app-text/5 flex items-center hover:bg-app-text/5 transition-colors">
                                    <button
                                        onClick={() => openEditModal(skill)}
                                        className="flex-1 text-left px-3 py-2.5 text-app-lg flex items-center gap-3"
                                    >
                                        {skill.icon ? (
                                            <img src={skill.icon} alt="" className="w-6 h-6 object-contain"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        ) : (
                                            <div className="w-6 h-6 rounded border border-dashed border-app-text/20 flex items-center justify-center text-app-text-muted text-[10px]">?</div>
                                        )}
                                        <span className="flex-1 font-medium">{skill.name.ja}</span>
                                        <span className="text-app-text-muted text-app-base">{skill.name.en}</span>
                                        <span className="text-app-text-muted w-12 text-right">{skill.value}%</span>
                                        <span className="text-app-text-muted w-10 text-right">{skill.duration}s</span>
                                        <span className="text-app-text-muted w-12 text-right">{skill.recast}s</span>
                                        <span className="text-app-text-muted w-14 text-right text-app-base">{skill.scope ?? 'party'}</span>
                                        {/* バッジ */}
                                        {skill.isInvincible && <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">無敵</span>}
                                        {skill.isShield && <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">バリア</span>}
                                        {skill.burstValue && <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">バースト</span>}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(skill.id)}
                                        className="px-3 py-2.5 text-app-text-muted hover:text-red-400 transition-colors text-app-lg"
                                        title="削除"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* スキル追加/編集モーダル */}
            {data && (
                <SkillFormModal
                    isOpen={modalOpen}
                    onClose={() => { setModalOpen(false); setEditingSkill(null); }}
                    onSave={handleSkillSave}
                    skill={editingSkill}
                    jobId={selectedJobId ?? data.jobs[0]?.id ?? ''}
                    jobs={data.jobs}
                    allMitigations={data.mitigations}
                />
            )}
        </div>
    );
}
