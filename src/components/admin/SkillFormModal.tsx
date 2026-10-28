/**
 * スキル追加/編集モーダル
 * 全フィールドを1画面で表示し、重要度で3段階に分けて整理
 * - 必須: 名前、効果時間、リキャスト、軽減率、タイプ、範囲
 * - よく使う: バースト、シールド、無敵、レベル制限、アイコン
 * - 詳細: ファミリー、前提スキル、妖精、リソースコスト等
 */
import { useState, useEffect } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { SkillFormRequiredSection } from './skillForm/SkillFormRequiredSection';
import { SkillFormCommonSection } from './skillForm/SkillFormCommonSection';
import { SkillFormAdvancedSection } from './skillForm/SkillFormAdvancedSection';
import { createDefaultSkill, slugify } from './skillForm/skillFormHelpers';
import { showToast } from '../toastBus';
import type { Job, Mitigation } from '../../types';

interface SkillFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (skill: Mitigation, isNew: boolean) => void;
    /** 編集対象（nullなら新規追加） */
    skill: Mitigation | null;
    /** 新規追加時のジョブID */
    jobId: string;
    /** 全ジョブ一覧（ジョブ選択用） */
    jobs: Job[];
    /** 全スキル一覧（前提スキル選択用） */
    allMitigations: Mitigation[];
}

export function SkillFormModal({ isOpen, onClose, onSave, skill, jobId, jobs, allMitigations }: SkillFormModalProps) {
    const isNew = !skill;
    const [form, setForm] = useState<Mitigation>(createDefaultSkill(jobId));
    const [showCommon, setShowCommon] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [uploading, setUploading] = useState(false);

    // モーダルが開いたときにフォームを初期化
    useEffect(() => {
        if (isOpen) {
            if (skill) {
                setForm({ ...skill });
                // 編集時: 値があるセクションは開いておく
                setShowCommon(!!(skill.burstValue || skill.isShield || skill.isInvincible || skill.minLevel));
                setShowAdvanced(!!(skill.family || skill.requires || skill.requiresFairy || skill.resourceCost || skill.maxCharges));
            } else {
                setForm(createDefaultSkill(jobId));
                setShowCommon(false);
                setShowAdvanced(false);
            }
        }
    }, [isOpen, skill, jobId]);

    if (!isOpen) return null;

    const update = <K extends keyof Mitigation>(key: K, value: Mitigation[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const updateName = (lang: 'ja' | 'en' | 'zh' | 'zh-Hant' | 'ko', value: string) => {
        setForm(prev => ({ ...prev, name: { ...prev.name, [lang]: value } }));
    };

    const handleIconUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) return;
        try {
            setUploading(true);
            const ext = file.name.split('.').pop() || 'png';
            const id = form.id || `${form.jobId}_${slugify(form.name.en || form.name.ja || 'skill')}_${Date.now()}`;
            const filename = `${id}.${ext}`;
            const storageRef = ref(storage, `icons/${filename}`);
            await uploadBytes(storageRef, file, {
                contentType: file.type,
                cacheControl: 'public, max-age=31536000, immutable',
            });
            update('icon', `/icons/${filename}`);
            showToast('アイコンをアップロードしました');
        } catch {
            showToast('アイコンのアップロードに失敗', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = () => {
        // バリデーション
        if (!form.name.ja.trim()) { showToast('日本語名を入力してください', 'error'); return; }
        if (!form.name.en.trim()) { showToast('英語名を入力してください', 'error'); return; }
        if (form.duration <= 0) { showToast('効果時間を入力してください', 'error'); return; }
        if (form.recast <= 0) { showToast('リキャストを入力してください', 'error'); return; }

        // 新規の場合はIDを自動生成
        const finalSkill = { ...form };
        if (isNew) {
            finalSkill.id = `${form.jobId}_${slugify(form.name.en)}_${Date.now().toString(36)}`;
        }

        onSave(finalSkill, isNew);
    };

    const selectedJob = jobs.find(j => j.id === form.jobId);

    // 同じジョブのスキル一覧（前提スキル選択用）
    const sameJobSkills = allMitigations.filter(m => m.jobId === form.jobId && m.id !== form.id);


    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="bg-app-bg border border-app-text/20 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="sticky top-0 z-10 bg-app-bg border-b border-app-text/10 px-5 py-3 flex items-center justify-between">
                    <h2 className="text-app-xl font-bold">
                        {isNew ? 'スキル追加' : `${form.name.ja} を編集`}
                    </h2>
                    <button onClick={onClose} className="text-app-text-muted hover:text-app-text text-app-2xl leading-none">&times;</button>
                </div>

                <div className="px-5 py-4 space-y-5">

                    <SkillFormRequiredSection
                        form={form}
                        update={update}
                        updateName={updateName}
                        jobs={jobs}
                        selectedJob={selectedJob}
                        isNew={isNew}
                        uploading={uploading}
                        handleIconUpload={handleIconUpload}
                    />

                    <SkillFormCommonSection
                        form={form}
                        update={update}
                        showCommon={showCommon}
                        setShowCommon={setShowCommon}
                    />

                    <SkillFormAdvancedSection
                        form={form}
                        update={update}
                        sameJobSkills={sameJobSkills}
                        showAdvanced={showAdvanced}
                        setShowAdvanced={setShowAdvanced}
                    />
                </div>

                {/* フッター */}
                <div className="sticky bottom-0 bg-app-bg border-t border-app-text/10 px-5 py-3 flex items-center justify-between">
                    <button onClick={onClose}
                        className="px-4 py-1.5 text-app-lg border border-app-text/20 rounded hover:bg-app-text/10 transition-colors">
                        キャンセル
                    </button>
                    <button onClick={handleSubmit}
                        className="px-6 py-1.5 text-app-lg bg-app-toggle text-app-toggle-text rounded hover:opacity-90 transition-opacity font-bold">
                        {isNew ? 'スキルを追加' : '変更を保存'}
                    </button>
                </div>
            </div>
        </div>
    );
}
