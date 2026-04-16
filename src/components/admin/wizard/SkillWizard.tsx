/**
 * スキル管理ウィザード
 * 管理画面からスキル（軽減アクション）を追加するためのウィザード
 * モード選択 → スキル追加 / スキル編集 / ジョブ追加 の3分岐
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useWizard } from './useWizard';
import type { WizardStep } from './useWizard';
import { AdminWizard } from './AdminWizard';
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
  family?: string;
}

interface SkillsData {
  jobs: JobDef[];
  mitigations: MitigationDef[];
  displayOrder: string[];
}

// ---- ステップ定義（スキル追加フロー） ----------------------------------------

const ADD_SKILL_STEPS: WizardStep[] = [
  { id: 'mode',              label: 'admin.skill_wiz_mode',         required: true },
  { id: 'jobId',             label: 'admin.skill_wiz_select_job',   required: true,
    condition: (d) => d.mode === 'add' },
  { id: 'nameJa',            label: 'admin.skill_wiz_name_ja',      required: true,
    condition: (d) => d.mode === 'add' },
  { id: 'nameEn',            label: 'admin.skill_wiz_name_en',      required: true,
    condition: (d) => d.mode === 'add' },
  { id: 'value',             label: 'admin.skill_wiz_value',        required: true,
    condition: (d) => d.mode === 'add' },
  { id: 'hasBurst',          label: 'admin.skill_wiz_burst',        required: true,
    condition: (d) => d.mode === 'add' },
  { id: 'duration',          label: 'admin.skill_wiz_duration',     required: true,
    condition: (d) => d.mode === 'add' },
  { id: 'recast',            label: 'admin.skill_wiz_recast',       required: true,
    condition: (d) => d.mode === 'add' },
  { id: 'type',              label: 'admin.skill_wiz_type',         required: true,
    condition: (d) => d.mode === 'add' },
  { id: 'scope',             label: 'admin.skill_wiz_scope',        required: true,
    condition: (d) => d.mode === 'add' },
  { id: 'cannotTargetSelf',  label: 'admin.skill_wiz_target_self',  required: true,
    condition: (d) => d.mode === 'add' && d.scope === 'target' },
  { id: 'minLevel',          label: 'admin.skill_wiz_min_level',    required: true,
    condition: (d) => d.mode === 'add' },
  { id: 'icon',              label: 'admin.skill_wiz_icon',         required: false,
    condition: (d) => d.mode === 'add' },
  { id: 'family',            label: 'admin.skill_wiz_family',       required: false,
    condition: (d) => d.mode === 'add' },
  { id: 'specials',          label: 'admin.skill_wiz_special',      required: false,
    condition: (d) => d.mode === 'add' },
  { id: 'skillId',           label: 'admin.skill_wiz_id',           required: true,
    condition: (d) => d.mode === 'add' },
];

// ---- ユーティリティ --------------------------------------------------------

function generateSkillId(_jobId: string, nameEn: string): string {
  return nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// ---- メインコンポーネント -------------------------------------------------

export function SkillWizard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isJa = i18n.language.startsWith('ja');

  const [jobs, setJobs] = useState<JobDef[]>([]);
  const [existingMitigations, setExistingMitigations] = useState<MitigationDef[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // ジョブ一覧 + 既存スキルをAPIから取得
  useEffect(() => {
    setIsLoadingJobs(true);
    apiFetch('/api/admin?resource=templates&type=skills')
      .then((res) => res.json())
      .then((data: SkillsData) => {
        if (data.jobs) setJobs(data.jobs);
        if (data.mitigations) setExistingMitigations(data.mitigations);
      })
      .catch((err) => {
        console.warn('[SkillWizard] ジョブ一覧の取得に失敗:', err);
      })
      .finally(() => setIsLoadingJobs(false));
  }, []);

  // サブミット処理
  const handleSubmit = useCallback(async (formData: Record<string, unknown>) => {
    // 最新のスキルデータを取得
    const res = await apiFetch('/api/admin?resource=templates&type=skills');
    if (!res.ok) throw new Error('スキルデータの取得に失敗しました');
    const skillsData: SkillsData = await res.json();

    const nameEn = (formData.nameEn as string) ?? '';
    const jobId = (formData.jobId as string) ?? '';
    const newId = (formData.skillId as string) || generateSkillId(jobId, nameEn);

    // 軽減タイプ処理
    const isSplitType = formData.typeSplit === true;
    const mitigationType = isSplitType ? 'all' : ((formData.type as 'all' | 'magical' | 'physical') ?? 'all');

    // 特殊フラグ
    const specialFlags = (formData.specials as string[]) ?? [];
    const hasSpecial = (flag: string) => specialFlags.includes(flag);

    const newMitigation: MitigationDef = {
      id: newId,
      jobId,
      name: {
        ja: (formData.nameJa as string) ?? '',
        en: nameEn,
      },
      value: Number(formData.value) || 0,
      duration: Number(formData.duration) || 0,
      recast: Number(formData.recast) || 0,
      type: mitigationType,
      scope: (formData.scope as 'self' | 'party' | 'target') ?? 'self',
      minLevel: Number(formData.minLevel) || 1,
    };

    // family
    if (formData.family) {
      newMitigation.family = formData.family as string;
    }

    // バースト軽減
    if (formData.hasBurst === 'yes') {
      newMitigation.burstValue = Number(formData.burstValue) || 0;
      newMitigation.burstDuration = Number(formData.burstDuration) || 0;
    }

    // 分割軽減率
    if (isSplitType) {
      newMitigation.valueMagical = Number(formData.valueMagical) || 0;
      newMitigation.valuePhysical = Number(formData.valuePhysical) || 0;
    }

    // 対象指定: 自分自身に使えないフラグ
    if (formData.scope === 'target' && formData.cannotTargetSelf === 'yes') {
      newMitigation.cannotTargetSelf = true;
    }

    // 特殊フラグ
    if (hasSpecial('isInvincible')) newMitigation.isInvincible = true;
    if (hasSpecial('requiresFairy')) newMitigation.requiresFairy = true;
    if (hasSpecial('maxCharges')) newMitigation.maxCharges = 2;
    if (hasSpecial('healingIncrease')) newMitigation.healingIncrease = 0;
    if (hasSpecial('requires')) newMitigation.requires = '';
    if (hasSpecial('resourceCost')) newMitigation.resourceCost = { type: '', amount: 0 };

    // データを更新
    const updatedMitigations = [...skillsData.mitigations, newMitigation];
    const updatedDisplayOrder = [...(skillsData.displayOrder ?? []), newId];

    const saveRes = await apiFetch('/api/admin?resource=templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'skills',
        jobs: skillsData.jobs,
        mitigations: updatedMitigations,
        displayOrder: updatedDisplayOrder,
      }),
    });

    if (!saveRes.ok) {
      const errData = await saveRes.json().catch(() => ({}));
      const msg = (errData as { error?: string }).error ?? '保存に失敗しました';
      showToast(msg, 'error');
      throw new Error(msg);
    }

    showToast(t('admin.skill_wiz_title'));
  }, [t]);

  const wizard = useWizard({ steps: ADD_SKILL_STEPS, onSubmit: handleSubmit });
  const { data, setField } = wizard;

  // モードが edit / add_job の場合は別ウィザードへナビゲート
  useEffect(() => {
    if (data.mode === 'edit') {
      navigate('/admin/skill-edit');
    } else if (data.mode === 'add_job') {
      navigate('/admin/job-wizard');
    }
  }, [data.mode, navigate]);

  // バリデーション
  const isStepValid = (stepId: string): boolean => {
    switch (stepId) {
      case 'mode':
        return Boolean(data.mode);
      case 'jobId':
        return Boolean(data.jobId);
      case 'nameJa':
        return Boolean((data.nameJa as string)?.trim());
      case 'nameEn':
        return Boolean((data.nameEn as string)?.trim());
      case 'value': {
        const v = Number(data.value);
        return !isNaN(v) && v >= 0 && v <= 100;
      }
      case 'hasBurst':
        return Boolean(data.hasBurst);
      case 'duration': {
        const v = Number(data.duration);
        return !isNaN(v) && v > 0;
      }
      case 'recast': {
        const v = Number(data.recast);
        return !isNaN(v) && v >= 0;
      }
      case 'type':
        return Boolean(data.type) || data.typeSplit === true;
      case 'scope':
        return Boolean(data.scope);
      case 'cannotTargetSelf':
        return Boolean(data.cannotTargetSelf);
      case 'minLevel': {
        const v = Number(data.minLevel);
        return !isNaN(v) && v >= 1 && v <= 100;
      }
      case 'skillId': {
        const id = (data.skillId as string)?.trim();
        if (!id) return false;
        if (!/^[a-z0-9_]+$/.test(id)) return false;
        return !existingMitigations.some((m) => m.id === id);
      }
      case 'family':
        return true; // optional
      default:
        return true;
    }
  };

  // ---- ステップ描画 -------------------------------------------------------

  const renderStep = (stepId: string) => {
    switch (stepId) {
      case 'mode':
        return <StepMode data={data} setField={setField} t={t} isJa={isJa} />;
      case 'jobId':
        return (
          <StepJobId
            data={data}
            setField={setField}
            t={t}
            isJa={isJa}
            jobs={jobs}
            isLoading={isLoadingJobs}
          />
        );
      case 'nameJa':
        return <StepNameJa data={data} setField={setField} t={t} />;
      case 'nameEn':
        return <StepNameEn data={data} setField={setField} t={t} />;
      case 'value':
        return <StepValue data={data} setField={setField} t={t} />;
      case 'hasBurst':
        return <StepHasBurst data={data} setField={setField} t={t} />;
      case 'duration':
        return <StepDuration data={data} setField={setField} t={t} />;
      case 'recast':
        return <StepRecast data={data} setField={setField} t={t} />;
      case 'type':
        return <StepType data={data} setField={setField} t={t} isJa={isJa} />;
      case 'scope':
        return <StepScope data={data} setField={setField} t={t} isJa={isJa} />;
      case 'cannotTargetSelf':
        return <StepCannotTargetSelf data={data} setField={setField} t={t} isJa={isJa} />;
      case 'minLevel':
        return <StepMinLevel data={data} setField={setField} t={t} />;
      case 'icon':
        return <StepIcon data={data} setField={setField} t={t} />;
      case 'family':
        return <StepFamily data={data} setField={setField} t={t} isJa={isJa} existingMitigations={existingMitigations} />;
      case 'specials':
        return <StepSpecials data={data} setField={setField} t={t} isJa={isJa} />;
      case 'skillId':
        return <StepSkillId data={data} setField={setField} t={t} isJa={isJa} existingMitigations={existingMitigations} />;
      default:
        return null;
    }
  };

  // ---- 確認画面 -----------------------------------------------------------

  const renderConfirmation = () => {
    const job = jobs.find((j) => j.id === data.jobId);
    const jobLabel = job
      ? `${isJa ? job.name.ja : job.name.en} (${job.role})`
      : String(data.jobId ?? '—');

    const isSplitType = data.typeSplit === true;
    const typeLabel = isSplitType
      ? t('admin.skill_wiz_type_split')
      : data.type === 'all'
      ? t('admin.skill_wiz_type_all')
      : data.type === 'magical'
      ? t('admin.skill_wiz_type_magical')
      : data.type === 'physical'
      ? t('admin.skill_wiz_type_physical')
      : '—';

    const scopeLabel =
      data.scope === 'self'
        ? t('admin.skill_wiz_scope_self')
        : data.scope === 'party'
        ? t('admin.skill_wiz_scope_party')
        : data.scope === 'target'
        ? t('admin.skill_wiz_scope_target')
        : '—';

    const rows: { stepId: string; label: string; value: string }[] = [
      { stepId: 'jobId',    label: isJa ? 'ジョブ' : 'Job',           value: jobLabel },
      { stepId: 'nameJa',   label: isJa ? 'スキル名（日本語）' : 'Name (JA)', value: String(data.nameJa ?? '—') },
      { stepId: 'nameEn',   label: isJa ? 'スキル名（英語）' : 'Name (EN)',   value: String(data.nameEn ?? '—') },
      { stepId: 'value',    label: isJa ? '軽減率' : 'Mitigation',    value: `${data.value ?? '—'}%` },
      { stepId: 'hasBurst', label: isJa ? '初回追加軽減' : 'Burst',    value: data.hasBurst === 'yes'
          ? `${data.burstValue ?? '?'}% / ${data.burstDuration ?? '?'}s`
          : isJa ? 'なし' : 'None' },
      { stepId: 'duration', label: isJa ? '効果時間' : 'Duration',    value: `${data.duration ?? '—'}s` },
      { stepId: 'recast',   label: isJa ? 'リキャスト' : 'Recast',     value: `${data.recast ?? '—'}s` },
      { stepId: 'type',     label: isJa ? '種類' : 'Type',            value: typeLabel },
      { stepId: 'scope',    label: isJa ? '効果範囲' : 'Scope',        value: scopeLabel },
      { stepId: 'minLevel', label: isJa ? '最低レベル' : 'Min Level',  value: String(data.minLevel ?? '—') },
    ];

    if (data.scope === 'target') {
      rows.push({
        stepId: 'cannotTargetSelf',
        label: isJa ? '自分自身には使えない' : 'Cannot Target Self',
        value: data.cannotTargetSelf === 'yes' ? (isJa ? 'はい' : 'Yes') : (isJa ? 'いいえ' : 'No'),
      });
    }

    if (data.family) {
      rows.push({
        stepId: 'family',
        label: isJa ? 'ジョブ変更マッピング' : 'Family',
        value: String(data.family),
      });
    }

    const specials = (data.specials as string[]) ?? [];
    if (specials.length > 0) {
      rows.push({
        stepId: 'specials',
        label: isJa ? '特殊動作' : 'Specials',
        value: specials.join(', '),
      });
    }

    rows.push({
      stepId: 'skillId',
      label: 'ID',
      value: String(data.skillId ?? generateSkillId(String(data.jobId ?? ''), String(data.nameEn ?? ''))),
    });

    return (
      <div className="flex flex-col gap-3">
        {rows.map(({ stepId, label, value }) => (
          <div
            key={stepId}
            className="flex items-center justify-between border-b border-[var(--app-text)]/10 pb-2 gap-4"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-app-lg text-[var(--app-text-muted)]">{label}</span>
              <span className="text-app-2xl font-medium truncate">{value || '—'}</span>
            </div>
            <button
              type="button"
              onClick={() => wizard.goToStep(stepId)}
              className="shrink-0 text-app-lg border border-[var(--app-text)]/40 px-3 py-1 hover:border-[var(--app-text)] hover:bg-[var(--app-text)]/5 transition-colors"
            >
              {t('admin.wizard_edit')}
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <AdminWizard
        title={t('admin.skill_wiz_title')}
        wizard={wizard}
        renderStep={renderStep}
        renderConfirmation={renderConfirmation}
        isStepValid={isStepValid}
      />
    </div>
  );
}

// ---- サブコンポーネント ---------------------------------------------------

interface StepBaseProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  t: (key: string) => string;
}

interface StepBasePropsWithLang extends StepBaseProps {
  isJa: boolean;
}

// モード選択
function StepMode({ data, setField, t, isJa: _isJa }: StepBasePropsWithLang) {
  const modes = [
    { value: 'add',     labelKey: 'admin.skill_wiz_add' },
    { value: 'edit',    labelKey: 'admin.skill_wiz_edit' },
    { value: 'add_job', labelKey: 'admin.skill_wiz_add_job' },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)] mb-2">{t('admin.skill_wiz_mode')}</p>
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => setField('mode', m.value)}
          className={`p-4 border text-left transition-colors ${
            data.mode === m.value
              ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
              : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
          }`}
        >
          <div className="font-medium">{t(m.labelKey)}</div>
        </button>
      ))}
    </div>
  );
}

// ジョブ選択
interface StepJobIdProps extends StepBasePropsWithLang {
  jobs: JobDef[];
  isLoading: boolean;
}

function StepJobId({ data, setField, isJa, jobs, isLoading }: StepJobIdProps) {
  if (isLoading) {
    return <div className="text-app-2xl text-[var(--app-text-muted)] py-4">Loading...</div>;
  }

  const grouped: Record<string, JobDef[]> = {};
  for (const job of jobs) {
    if (!grouped[job.role]) grouped[job.role] = [];
    grouped[job.role].push(job);
  }

  const roleOrder = ['TANK', 'HEALER', 'DPS'];

  return (
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
                  onClick={() => setField('jobId', job.id)}
                  className={`p-3 border text-left transition-colors ${
                    data.jobId === job.id
                      ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
                      : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
                  }`}
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
  );
}

// スキル名（日本語）
function StepNameJa({ data, setField, t }: StepBaseProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_name_ja')}</p>
      <input
        type="text"
        value={(data.nameJa as string) ?? ''}
        onChange={(e) => setField('nameJa', e.target.value)}
        placeholder="e.g. シェルトロン"
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
    </div>
  );
}

// スキル名（英語）— IDも自動生成
function StepNameEn({ data, setField, t }: StepBaseProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_name_en')}</p>
      <input
        type="text"
        value={(data.nameEn as string) ?? ''}
        onChange={(e) => {
          setField('nameEn', e.target.value);
          setField('skillId', generateSkillId(String(data.jobId ?? ''), e.target.value));
        }}
        placeholder="e.g. Sheltron"
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
    </div>
  );
}

// 軽減率
function StepValue({ data, setField, t }: StepBaseProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_value')}</p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={(data.value as string) ?? ''}
          onChange={(e) => setField('value', e.target.value)}
          placeholder="10"
          className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]"
          autoFocus
        />
        <span className="text-app-2xl text-[var(--app-text-muted)] shrink-0">%</span>
      </div>
    </div>
  );
}

// バースト軽減の有無
function StepHasBurst({ data, setField, t }: StepBaseProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_burst')}</p>
      <div className="flex gap-3">
        {(['yes', 'no'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setField('hasBurst', v)}
            className={`flex-1 p-4 border text-left transition-colors ${
              data.hasBurst === v
                ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
                : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
            }`}
          >
            <div className="font-medium text-center">{v === 'yes' ? 'Yes' : 'No'}</div>
          </button>
        ))}
      </div>

      {/* バーストあり → 追加フィールド */}
      {data.hasBurst === 'yes' && (
        <div className="flex flex-col gap-3 border border-[var(--app-text)]/20 p-4">
          <div className="flex flex-col gap-2">
            <p className="text-app-lg text-[var(--app-text-muted)]">{t('admin.skill_wiz_burst_value')}</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={(data.burstValue as string) ?? ''}
                onChange={(e) => setField('burstValue', e.target.value)}
                placeholder="20"
                className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]"
              />
              <span className="text-app-2xl text-[var(--app-text-muted)] shrink-0">%</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-app-lg text-[var(--app-text-muted)]">{t('admin.skill_wiz_burst_duration')}</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                step={0.1}
                value={(data.burstDuration as string) ?? ''}
                onChange={(e) => setField('burstDuration', e.target.value)}
                placeholder="8"
                className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]"
              />
              <span className="text-app-2xl text-[var(--app-text-muted)] shrink-0">s</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 効果時間
function StepDuration({ data, setField, t }: StepBaseProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_duration')}</p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0.1}
          max={999}
          step={0.1}
          value={(data.duration as string) ?? ''}
          onChange={(e) => setField('duration', e.target.value)}
          placeholder="15"
          className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]"
          autoFocus
        />
        <span className="text-app-2xl text-[var(--app-text-muted)] shrink-0">s</span>
      </div>
    </div>
  );
}

// リキャスト
function StepRecast({ data, setField, t }: StepBaseProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_recast')}</p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={999}
          step={1}
          value={(data.recast as string) ?? ''}
          onChange={(e) => setField('recast', e.target.value)}
          placeholder="60"
          className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]"
          autoFocus
        />
        <span className="text-app-2xl text-[var(--app-text-muted)] shrink-0">s</span>
      </div>
    </div>
  );
}

// 軽減種類
function StepType({ data, setField, t, isJa: _isJa }: StepBasePropsWithLang) {
  const isSplit = data.typeSplit === true;
  const typeOptions = [
    { value: 'all',      labelKey: 'admin.skill_wiz_type_all' },
    { value: 'magical',  labelKey: 'admin.skill_wiz_type_magical' },
    { value: 'physical', labelKey: 'admin.skill_wiz_type_physical' },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_type')}</p>

      {/* 分割チェックボックス */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isSplit}
          onChange={(e) => {
            setField('typeSplit', e.target.checked);
            if (!e.target.checked) setField('type', undefined);
          }}
          className="w-4 h-4 border border-[var(--app-text)]/30 bg-transparent"
        />
        <span className="text-app-2xl">{t('admin.skill_wiz_type_split')}</span>
      </label>

      {!isSplit && (
        <div className="flex flex-col gap-2">
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField('type', opt.value)}
              className={`p-4 border text-left transition-colors ${
                data.type === opt.value
                  ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
                  : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
              }`}
            >
              <div className="font-medium">{t(opt.labelKey)}</div>
            </button>
          ))}
        </div>
      )}

      {isSplit && (
        <div className="flex flex-col gap-3 border border-[var(--app-text)]/20 p-4">
          <div className="flex flex-col gap-2">
            <p className="text-app-lg text-[var(--app-text-muted)]">
              {t('admin.skill_wiz_type_magical')} %
            </p>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={(data.valueMagical as string) ?? ''}
              onChange={(e) => setField('valueMagical', e.target.value)}
              placeholder="10"
              className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-app-lg text-[var(--app-text-muted)]">
              {t('admin.skill_wiz_type_physical')} %
            </p>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={(data.valuePhysical as string) ?? ''}
              onChange={(e) => setField('valuePhysical', e.target.value)}
              placeholder="10"
              className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// 効果範囲
function StepScope({ data, setField, t, isJa: _isJa }: StepBasePropsWithLang) {
  const scopeOptions = [
    { value: 'self',   labelKey: 'admin.skill_wiz_scope_self' },
    { value: 'party',  labelKey: 'admin.skill_wiz_scope_party' },
    { value: 'target', labelKey: 'admin.skill_wiz_scope_target' },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_scope')}</p>
      {scopeOptions.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setField('scope', opt.value)}
          className={`p-4 border text-left transition-colors ${
            data.scope === opt.value
              ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
              : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
          }`}
        >
          <div className="font-medium">{t(opt.labelKey)}</div>
        </button>
      ))}
    </div>
  );
}

// 対象指定: 自分自身にも使えるか
function StepCannotTargetSelf({ data, setField, t, isJa: _isJa }: StepBasePropsWithLang) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_target_self')}</p>
      <div className="flex gap-3">
        {(['yes', 'no'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setField('cannotTargetSelf', v)}
            className={`flex-1 p-4 border text-left transition-colors ${
              data.cannotTargetSelf === v
                ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
                : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
            }`}
          >
            <div className="font-medium text-center">{v === 'yes' ? 'Yes' : 'No'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// 最低レベル
function StepMinLevel({ data, setField, t }: StepBaseProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_min_level')}</p>
      <input
        type="number"
        min={1}
        max={100}
        step={1}
        value={(data.minLevel as string) ?? ''}
        onChange={(e) => setField('minLevel', e.target.value)}
        placeholder="50"
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]"
        autoFocus
      />
    </div>
  );
}

// アイコン選択（任意）
function StepIcon({ data, setField, t }: StepBaseProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_icon')}</p>
      <input
        type="text"
        value={(data.icon as string) ?? ''}
        onChange={(e) => setField('icon', e.target.value)}
        placeholder="https://..."
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
    </div>
  );
}

// 特殊動作チェックリスト
const SPECIAL_FLAGS = [
  { id: 'isInvincible',   labelKey: 'admin.skill_wiz_special_invincible' },
  { id: 'requires',       labelKey: 'admin.skill_wiz_special_requires' },
  { id: 'requiresFairy',  labelKey: 'admin.skill_wiz_special_fairy' },
  { id: 'maxCharges',     labelKey: 'admin.skill_wiz_special_charges' },
  { id: 'resourceCost',   labelKey: 'admin.skill_wiz_special_resource' },
  { id: 'healingIncrease', labelKey: 'admin.skill_wiz_special_healing' },
] as const;

// family選択（ジョブ変更時のマッピング用）
interface StepFamilyProps extends StepBasePropsWithLang {
  existingMitigations: MitigationDef[];
}

function StepFamily({ data, setField, t: _t, isJa, existingMitigations }: StepFamilyProps) {
  // 既存スキルからfamily一覧を抽出（同じロールのスキルを優先表示）
  const familyMap = new Map<string, string[]>();
  for (const m of existingMitigations) {
    if (!m.family) continue;
    const names = familyMap.get(m.family) ?? [];
    const name = isJa ? m.name.ja : m.name.en;
    if (!names.includes(name)) names.push(name);
    familyMap.set(m.family, names);
  }

  const families = Array.from(familyMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const current = (data.family as string) ?? '';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">
        {isJa ? 'ジョブ変更マッピング（family）' : 'Job Migration Family'}
      </p>
      <p className="text-app-lg text-[var(--app-text-muted)]">
        {isJa
          ? 'ジョブ変更時にスキルを自動変換するためのグループ。同じfamilyのスキル同士が変換対象になります。任意入力です。'
          : 'Group for auto-mapping skills when changing jobs. Skills with the same family are mapped to each other. Optional.'}
      </p>
      <input
        type="text"
        value={current}
        onChange={(e) => setField('family', e.target.value)}
        placeholder={isJa ? '例: ph_180_big' : 'e.g. ph_180_big'}
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
        {families.map(([fam, names]) => (
          <button
            key={fam}
            type="button"
            onClick={() => setField('family', fam)}
            className={`text-left px-3 py-2 border transition-colors ${
              current === fam
                ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
                : 'border-[var(--app-text)]/10 hover:border-[var(--app-text)]/30'
            }`}
          >
            <div className="text-app-2xl font-medium font-mono">{fam}</div>
            <div className="text-app-lg text-[var(--app-text-muted)] truncate">
              {names.slice(0, 3).join(', ')}{names.length > 3 ? ` +${names.length - 3}` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// スキルID確認・編集
interface StepSkillIdProps extends StepBasePropsWithLang {
  existingMitigations: MitigationDef[];
}

function StepSkillId({ data, setField, isJa, existingMitigations }: StepSkillIdProps) {
  const autoId = generateSkillId(String(data.jobId ?? ''), String(data.nameEn ?? ''));
  const currentId = (data.skillId as string) ?? autoId;
  const isDuplicate = existingMitigations.some((m) => m.id === currentId);
  const isInvalidFormat = currentId.length > 0 && !/^[a-z0-9_]+$/.test(currentId);

  // 初回表示時にIDが未設定なら自動生成値をセット
  useEffect(() => {
    if (!data.skillId) {
      setField('skillId', autoId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">
        {isJa ? 'スキルID（自動生成・編集可能）' : 'Skill ID (auto-generated, editable)'}
      </p>
      <input
        type="text"
        value={currentId}
        onChange={(e) => setField('skillId', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
        className={`w-full border bg-transparent px-4 py-3 text-app-2xl font-mono focus:outline-none text-[var(--app-text)] ${
          isDuplicate || isInvalidFormat
            ? 'border-red-500 focus:border-red-500'
            : 'border-[var(--app-text)]/30 focus:border-[var(--app-text)]'
        }`}
        autoFocus
      />
      {isDuplicate && (
        <p className="text-app-lg text-red-500">
          {isJa ? 'このIDは既に使われています' : 'This ID is already in use'}
        </p>
      )}
      {isInvalidFormat && (
        <p className="text-app-lg text-red-500">
          {isJa ? '英小文字・数字・アンダースコアのみ使用できます' : 'Only lowercase letters, numbers, and underscores allowed'}
        </p>
      )}
      <p className="text-app-lg text-[var(--app-text-muted)]">
        {isJa
          ? '英語名から自動生成されます。特別な理由がなければそのままでOKです。'
          : 'Auto-generated from the English name. Leave as-is unless you have a specific reason to change it.'}
      </p>
    </div>
  );
}

function StepSpecials({ data, setField, t, isJa: _isJa }: StepBasePropsWithLang) {
  const selected = (data.specials as string[]) ?? [];

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    setField('specials', next);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-app-2xl text-[var(--app-text-muted)]">{t('admin.skill_wiz_special')}</p>
      {SPECIAL_FLAGS.map((flag) => (
        <label
          key={flag.id}
          className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors select-none ${
            selected.includes(flag.id)
              ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
              : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(flag.id)}
            onChange={() => toggle(flag.id)}
            className="w-4 h-4 border border-[var(--app-text)]/30 bg-transparent shrink-0"
          />
          <span className="text-app-2xl">{t(flag.labelKey)}</span>
        </label>
      ))}
    </div>
  );
}
