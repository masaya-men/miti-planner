/**
 * スキル編集ウィザード
 * Step 1: ジョブ選択 → Step 2: スキル選択 → Step 3: 編集フォーム（全フィールド一括）
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../lib/apiClient';
import { showToast } from '../../Toast';

// ---- 型定義 ----------------------------------------------------------------

interface JobDef {
  id: string;
  name: { ja: string; en: string };
  role: 'TANK' | 'HEALER' | 'DPS';
  icon?: string;
}

interface MitigationDef {
  id: string;
  jobId: string;
  name: { ja: string; en: string };
  value: number;
  duration: number;
  recast: number;
  type: 'all' | 'magical' | 'physical';
  scope: 'self' | 'party' | 'target';
  minLevel: number;
  icon?: string;
  valueMagical?: number;
  valuePhysical?: number;
  burstValue?: number;
  burstDuration?: number;
  isInvincible?: boolean;
  requires?: string;
  requiresFairy?: boolean;
  maxCharges?: number;
  resourceCost?: { type: string; amount: number };
  healingIncrease?: number;
  healingIncreaseSelfOnly?: boolean;
  cannotTargetSelf?: boolean;
  shieldPotency?: number;
  shieldStacks?: number;
}

interface SkillsData {
  jobs: JobDef[];
  mitigations: MitigationDef[];
  displayOrder: string[];
}

// 編集フォームの状態
interface EditFormState {
  nameJa: string;
  nameEn: string;
  value: string;
  duration: string;
  recast: string;
  type: string;
  scope: string;
  minLevel: string;
}

type Step = 'jobId' | 'skillId' | 'edit' | 'confirm' | 'done';

// ---- メインコンポーネント -------------------------------------------------

export function SkillEditWizard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isJa = i18n.language.startsWith('ja');

  const [step, setStep] = useState<Step>('jobId');
  const [jobs, setJobs] = useState<JobDef[]>([]);
  const [mitigations, setMitigations] = useState<MitigationDef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [originalData, setOriginalData] = useState<EditFormState | null>(null);
  const [editData, setEditData] = useState<EditFormState>({
    nameJa: '',
    nameEn: '',
    value: '',
    duration: '',
    recast: '',
    type: 'all',
    scope: 'self',
    minLevel: '',
  });

  // スキルデータ取得
  useEffect(() => {
    setIsLoading(true);
    apiFetch('/api/admin?resource=templates&type=skills')
      .then((res) => res.json())
      .then((data: SkillsData) => {
        if (data.jobs) setJobs(data.jobs);
        if (data.mitigations) setMitigations(data.mitigations);
      })
      .catch((err) => {
        console.warn('[SkillEditWizard] データ取得に失敗:', err);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // ジョブのスキル一覧
  const jobSkills = mitigations.filter((m) => m.jobId === selectedJobId);

  // スキル選択時にフォームを初期化
  const handleSelectSkill = useCallback((skill: MitigationDef) => {
    setSelectedSkillId(skill.id);
    const formState: EditFormState = {
      nameJa: skill.name.ja,
      nameEn: skill.name.en,
      value: String(skill.value),
      duration: String(skill.duration),
      recast: String(skill.recast),
      type: skill.type,
      scope: skill.scope,
      minLevel: String(skill.minLevel),
    };
    setOriginalData(formState);
    setEditData(formState);
    setStep('edit');
  }, []);

  // フィールド更新
  const updateField = useCallback((key: keyof EditFormState, value: string) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 変更されたフィールドを計算
  const changedFields = originalData
    ? (Object.keys(editData) as (keyof EditFormState)[]).filter(
        (key) => editData[key] !== originalData[key]
      )
    : [];

  // サブミット処理
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // 最新データを取得
      const res = await apiFetch('/api/admin?resource=templates&type=skills');
      if (!res.ok) throw new Error('スキルデータの取得に失敗しました');
      const skillsData: SkillsData = await res.json();

      // 対象のスキルを更新
      const updatedMitigations = skillsData.mitigations.map((m) => {
        if (m.id !== selectedSkillId) return m;
        return {
          ...m,
          name: {
            ja: editData.nameJa,
            en: editData.nameEn,
          },
          value: Number(editData.value) || 0,
          duration: Number(editData.duration) || 0,
          recast: Number(editData.recast) || 0,
          type: editData.type as 'all' | 'magical' | 'physical',
          scope: editData.scope as 'self' | 'party' | 'target',
          minLevel: Number(editData.minLevel) || 1,
        };
      });

      const saveRes = await apiFetch('/api/admin?resource=templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'skills',
          jobs: skillsData.jobs,
          mitigations: updatedMitigations,
          displayOrder: skillsData.displayOrder,
        }),
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}));
        const msg = (errData as { error?: string }).error ?? '保存に失敗しました';
        showToast(msg, 'error');
        throw new Error(msg);
      }

      showToast(t('admin.wizard_save'));
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedSkillId, editData, t]);

  // ---- レンダリング --------------------------------------------------------

  // 完了画面
  if (step === 'done') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center gap-6 py-16 text-[var(--app-text)]">
          <div className="text-app-6xl font-bold">{t('admin.wizard_success')}</div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setStep('jobId');
                setSelectedJobId('');
                setSelectedSkillId('');
                setOriginalData(null);
                setError(null);
              }}
              className="border border-[var(--app-text)] px-6 py-2 text-app-2xl font-medium hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors"
            >
              {t('admin.wizard_add_another')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="bg-[var(--app-text)] text-[var(--app-bg)] px-6 py-2 text-app-2xl font-medium hover:opacity-80 transition-opacity"
            >
              {t('admin.wizard_back_to_dashboard')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ジョブ選択
  if (step === 'jobId') {
    const grouped: Record<string, JobDef[]> = {};
    for (const job of jobs) {
      if (!grouped[job.role]) grouped[job.role] = [];
      grouped[job.role].push(job);
    }
    const roleOrder = ['TANK', 'HEALER', 'DPS'];

    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <WizardHeader
          title={t('admin.skill_wiz_title')}
          stepLabel={`1 / 3`}
          question={t('admin.skill_wiz_select_job')}
        />

        {isLoading ? (
          <div className="text-app-2xl text-[var(--app-text-muted)] py-4">Loading...</div>
        ) : (
          <div className="flex flex-col gap-4">
            {roleOrder.map((role) => {
              const roleJobs = grouped[role];
              if (!roleJobs || roleJobs.length === 0) return null;
              return (
                <div key={role} className="flex flex-col gap-2">
                  <div className="text-app-lg text-[var(--app-text-muted)] font-semibold uppercase tracking-wider">
                    {role}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {roleJobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          setSelectedJobId(job.id);
                          setStep('skillId');
                        }}
                        className="p-3 border border-[var(--app-text)]/20 text-left hover:border-[var(--app-text)]/60 transition-colors"
                      >
                        <div className="text-app-2xl font-medium">
                          {isJa ? job.name.ja : job.name.en}
                        </div>
                        <div className="text-app-lg text-[var(--app-text-muted)]">{job.id}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <WizardFooter
          onBack={() => navigate('/admin/skill-wizard')}
          backLabel={t('admin.wizard_back')}
          showNext={false}
        />
      </div>
    );
  }

  // スキル選択
  if (step === 'skillId') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <WizardHeader
          title={t('admin.skill_wiz_title')}
          stepLabel={`2 / 3`}
          question={t('admin.skill_wiz_select_skill')}
        />

        <div className="flex flex-col gap-2">
          {jobSkills.length === 0 ? (
            <p className="text-app-2xl text-[var(--app-text-muted)]">
              {isJa ? 'スキルが見つかりません' : 'No skills found'}
            </p>
          ) : (
            jobSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => handleSelectSkill(skill)}
                className="p-3 border border-[var(--app-text)]/20 text-left hover:border-[var(--app-text)]/60 transition-colors"
              >
                <div className="text-app-2xl font-medium">
                  {isJa ? skill.name.ja : skill.name.en}
                </div>
                <div className="text-app-lg text-[var(--app-text-muted)]">{skill.id}</div>
              </button>
            ))
          )}
        </div>

        <WizardFooter
          onBack={() => setStep('jobId')}
          backLabel={t('admin.wizard_back')}
          showNext={false}
        />
      </div>
    );
  }

  // 編集フォーム（Step 3）
  if (step === 'edit') {
    const inputClass =
      'w-full border border-[var(--app-text)]/30 bg-transparent px-3 py-2 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]';
    const labelClass = 'text-app-lg text-[var(--app-text-muted)]';

    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <WizardHeader
          title={t('admin.skill_wiz_title')}
          stepLabel={`3 / 3`}
          question={t('admin.skill_wiz_edit_fields')}
        />

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="col-span-2 flex flex-col gap-1">
            <label className={labelClass}>{isJa ? 'スキル名（日本語）' : 'Name (JA)'}</label>
            <input
              className={inputClass}
              value={editData.nameJa}
              onChange={(e) => updateField('nameJa', e.target.value)}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className={labelClass}>{isJa ? 'スキル名（英語）' : 'Name (EN)'}</label>
            <input
              className={inputClass}
              value={editData.nameEn}
              onChange={(e) => updateField('nameEn', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isJa ? '軽減率 (%)' : 'Mitigation (%)'}</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              className={inputClass}
              value={editData.value}
              onChange={(e) => updateField('value', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isJa ? '効果時間 (s)' : 'Duration (s)'}</label>
            <input
              type="number"
              min={0}
              step={0.1}
              className={inputClass}
              value={editData.duration}
              onChange={(e) => updateField('duration', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isJa ? 'リキャスト (s)' : 'Recast (s)'}</label>
            <input
              type="number"
              min={0}
              step={0.1}
              className={inputClass}
              value={editData.recast}
              onChange={(e) => updateField('recast', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isJa ? '最低レベル' : 'Min Level'}</label>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              className={inputClass}
              value={editData.minLevel}
              onChange={(e) => updateField('minLevel', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isJa ? '軽減種類' : 'Type'}</label>
            <select
              className={inputClass}
              value={editData.type}
              onChange={(e) => updateField('type', e.target.value)}
            >
              <option value="all">{t('admin.skill_wiz_type_all')}</option>
              <option value="magical">{t('admin.skill_wiz_type_magical')}</option>
              <option value="physical">{t('admin.skill_wiz_type_physical')}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isJa ? '効果範囲' : 'Scope'}</label>
            <select
              className={inputClass}
              value={editData.scope}
              onChange={(e) => updateField('scope', e.target.value)}
            >
              <option value="self">{t('admin.skill_wiz_scope_self')}</option>
              <option value="party">{t('admin.skill_wiz_scope_party')}</option>
              <option value="target">{t('admin.skill_wiz_scope_target')}</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="border border-[var(--app-text)] p-3 text-app-2xl mb-4">{error}</div>
        )}

        <WizardFooter
          onBack={() => setStep('skillId')}
          backLabel={t('admin.wizard_back')}
          onNext={() => setStep('confirm')}
          nextLabel={t('admin.wizard_next')}
          showNext={true}
          nextDisabled={!editData.nameJa.trim() || !editData.nameEn.trim()}
        />
      </div>
    );
  }

  // 確認画面
  if (step === 'confirm') {
    const fieldLabels: Record<keyof EditFormState, string> = {
      nameJa: isJa ? 'スキル名（日本語）' : 'Name (JA)',
      nameEn: isJa ? 'スキル名（英語）' : 'Name (EN)',
      value: isJa ? '軽減率 (%)' : 'Mitigation (%)',
      duration: isJa ? '効果時間 (s)' : 'Duration (s)',
      recast: isJa ? 'リキャスト (s)' : 'Recast (s)',
      type: isJa ? '軽減種類' : 'Type',
      scope: isJa ? '効果範囲' : 'Scope',
      minLevel: isJa ? '最低レベル' : 'Min Level',
    };

    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="flex flex-col gap-6 text-[var(--app-text)]">
          <div className="border-b border-[var(--app-text)] pb-3">
            <h2 className="text-app-4xl font-bold">{t('admin.skill_wiz_title')}</h2>
            <p className="text-app-2xl text-[var(--app-text-muted)] mt-1">
              {t('admin.wizard_confirmation')}
            </p>
          </div>

          {changedFields.length === 0 ? (
            <p className="text-app-2xl text-[var(--app-text-muted)]">
              {isJa ? '変更はありません' : 'No changes'}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-app-lg text-[var(--app-text-muted)] font-semibold uppercase tracking-wider mb-1">
                {t('admin.skill_wiz_changes_highlight')}
              </p>
              {changedFields.map((key) => (
                <div
                  key={key}
                  className="border border-[var(--app-text)] p-3 flex flex-col gap-1"
                >
                  <span className="text-app-lg text-[var(--app-text-muted)]">
                    {fieldLabels[key]}
                  </span>
                  <div className="flex items-center gap-2 text-app-2xl">
                    <span className="opacity-40 line-through">
                      {originalData?.[key] ?? '—'}
                    </span>
                    <span className="text-[var(--app-text-muted)]">→</span>
                    <span className="font-medium">{editData[key]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="border border-[var(--app-text)] p-3 text-app-2xl">{error}</div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-[var(--app-text)]">
            <button
              type="button"
              onClick={() => setStep('edit')}
              className="border border-[var(--app-text)] px-5 py-2 text-app-2xl font-medium hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors"
            >
              {t('admin.wizard_back')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || changedFields.length === 0}
              className="bg-[var(--app-text)] text-[var(--app-bg)] px-6 py-2 text-app-2xl font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {isSubmitting ? t('admin.wizard_saving') : t('admin.wizard_save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ---- 共通UIパーツ ---------------------------------------------------------

interface WizardHeaderProps {
  title: string;
  stepLabel: string;
  question: string;
}

function WizardHeader({ title, stepLabel, question }: WizardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-6 text-[var(--app-text)]">
      <div className="border-b border-[var(--app-text)] pb-3">
        <h2 className="text-app-4xl font-bold">{title}</h2>
        <p className="text-app-lg text-[var(--app-text-muted)] mt-1">{stepLabel}</p>
      </div>
      <p className="text-app-2xl text-[var(--app-text-muted)]">{question}</p>
    </div>
  );
}

interface WizardFooterProps {
  onBack: () => void;
  backLabel: string;
  showNext?: boolean;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

function WizardFooter({
  onBack,
  backLabel,
  showNext = false,
  onNext,
  nextLabel,
  nextDisabled = false,
}: WizardFooterProps) {
  return (
    <div className="flex justify-between items-center pt-4 border-t border-[var(--app-text)] mt-6 text-[var(--app-text)]">
      <button
        type="button"
        onClick={onBack}
        className="border border-[var(--app-text)] px-5 py-2 text-app-2xl font-medium hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors"
      >
        {backLabel}
      </button>
      {showNext && onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="bg-[var(--app-text)] text-[var(--app-bg)] px-6 py-2 text-app-2xl font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
