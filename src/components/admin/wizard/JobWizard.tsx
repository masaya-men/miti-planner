/**
 * ジョブ追加ウィザード
 * Step 1: jobId → Step 2: nameJa → Step 3: nameEn → Step 4: role → Step 5: icon（任意）→ 確認 → 完了
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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

interface SkillsData {
  jobs: JobDef[];
  mitigations: unknown[];
  displayOrder: string[];
}

// ---- ステップ定義 ----------------------------------------------------------

const JOB_WIZARD_STEPS: WizardStep[] = [
  { id: 'jobId',   label: 'admin.job_wiz_id',      required: true },
  { id: 'nameJa',  label: 'admin.job_wiz_name_ja',  required: true },
  { id: 'nameEn',  label: 'admin.job_wiz_name_en',  required: true },
  { id: 'role',    label: 'admin.job_wiz_role',      required: true },
  { id: 'icon',    label: 'admin.job_wiz_icon',      required: false },
];

// ---- メインコンポーネント -------------------------------------------------

export function JobWizard() {
  const { t, i18n } = useTranslation();
  const isJa = i18n.language.startsWith('ja');

  // サブミット処理
  const handleSubmit = useCallback(async (formData: Record<string, unknown>) => {
    // 最新データを取得
    const res = await apiFetch('/api/admin?resource=templates&type=skills');
    if (!res.ok) throw new Error('スキルデータの取得に失敗しました');
    const skillsData: SkillsData = await res.json();

    const newJob: JobDef = {
      id: (formData.jobId as string).trim().toLowerCase(),
      name: {
        ja: (formData.nameJa as string).trim(),
        en: (formData.nameEn as string).trim(),
      },
      role: (formData.role as 'TANK' | 'HEALER' | 'DPS'),
    };

    if (formData.icon) {
      newJob.icon = formData.icon as string;
    }

    // 重複チェック
    if (skillsData.jobs.some((j) => j.id === newJob.id)) {
      throw new Error(
        isJa
          ? `ジョブID "${newJob.id}" は既に存在します`
          : `Job ID "${newJob.id}" already exists`
      );
    }

    const updatedJobs = [...skillsData.jobs, newJob];

    const saveRes = await apiFetch('/api/admin?resource=templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'skills',
        jobs: updatedJobs,
        mitigations: skillsData.mitigations,
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
  }, [isJa, t]);

  const wizard = useWizard({ steps: JOB_WIZARD_STEPS, onSubmit: handleSubmit });
  const { data, setField } = wizard;

  // バリデーション
  const isStepValid = (stepId: string): boolean => {
    switch (stepId) {
      case 'jobId': {
        const v = (data.jobId as string)?.trim() ?? '';
        return v.length > 0 && /^[a-z0-9_]+$/i.test(v);
      }
      case 'nameJa':
        return Boolean((data.nameJa as string)?.trim());
      case 'nameEn':
        return Boolean((data.nameEn as string)?.trim());
      case 'role':
        return ['TANK', 'HEALER', 'DPS'].includes(data.role as string);
      default:
        return true;
    }
  };

  // ---- ステップ描画 -------------------------------------------------------

  const renderStep = (stepId: string) => {
    const inputClass =
      'w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-sm focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]';
    const questionClass = 'text-sm text-[var(--app-text-muted)] mb-3';

    switch (stepId) {
      case 'jobId':
        return (
          <div className="flex flex-col gap-3">
            <p className={questionClass}>{t('admin.job_wiz_id')}</p>
            <input
              type="text"
              value={(data.jobId as string) ?? ''}
              onChange={(e) => setField('jobId', e.target.value)}
              placeholder="e.g. vpr"
              className={inputClass}
              autoFocus
            />
            <p className="text-xs text-[var(--app-text-muted)]">
              {isJa
                ? '半角英数字・アンダースコアのみ使用可。例: pld, war, ast'
                : 'Alphanumeric and underscores only. e.g. pld, war, ast'}
            </p>
          </div>
        );

      case 'nameJa':
        return (
          <div className="flex flex-col gap-3">
            <p className={questionClass}>{t('admin.job_wiz_name_ja')}</p>
            <input
              type="text"
              value={(data.nameJa as string) ?? ''}
              onChange={(e) => setField('nameJa', e.target.value)}
              placeholder={isJa ? 'e.g. ヴァイパー' : 'e.g. ヴァイパー'}
              className={inputClass}
              autoFocus
            />
          </div>
        );

      case 'nameEn':
        return (
          <div className="flex flex-col gap-3">
            <p className={questionClass}>{t('admin.job_wiz_name_en')}</p>
            <input
              type="text"
              value={(data.nameEn as string) ?? ''}
              onChange={(e) => setField('nameEn', e.target.value)}
              placeholder="e.g. Viper"
              className={inputClass}
              autoFocus
            />
          </div>
        );

      case 'role':
        return <StepRole data={data} setField={setField} t={t} />;

      case 'icon':
        return <StepIcon data={data} setField={setField} t={t} />;

      default:
        return null;
    }
  };

  // ---- 確認画面 -----------------------------------------------------------

  const renderConfirmation = () => {
    const rows: { label: string; value: string }[] = [
      { label: isJa ? 'ジョブID'          : 'Job ID',      value: String(data.jobId ?? '—') },
      { label: isJa ? 'ジョブ名（日本語）' : 'Name (JA)',   value: String(data.nameJa ?? '—') },
      { label: isJa ? 'ジョブ名（英語）'   : 'Name (EN)',   value: String(data.nameEn ?? '—') },
      { label: isJa ? 'ロール'             : 'Role',        value: String(data.role ?? '—') },
      { label: isJa ? 'アイコン'           : 'Icon',        value: data.icon ? (isJa ? '設定済み' : 'Set') : (isJa ? 'なし' : 'None') },
    ];

    return (
      <div className="flex flex-col gap-3">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-[var(--app-text)]/10 pb-2 gap-4"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs text-[var(--app-text-muted)]">{label}</span>
              <span className="text-sm font-medium truncate">{value || '—'}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <AdminWizard
        title={t('admin.job_wiz_title')}
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

// ロール選択
function StepRole({ data, setField, t }: StepBaseProps) {
  const roles = [
    { value: 'TANK',   labelJa: 'タンク',   labelEn: 'Tank' },
    { value: 'HEALER', labelJa: 'ヒーラー', labelEn: 'Healer' },
    { value: 'DPS',    labelJa: 'DPS',      labelEn: 'DPS' },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--app-text-muted)] mb-2">{t('admin.job_wiz_role')}</p>
      <div className="grid grid-cols-3 gap-3">
        {roles.map((role) => (
          <button
            key={role.value}
            type="button"
            onClick={() => setField('role', role.value)}
            className={`p-4 border text-center font-medium transition-colors ${
              data.role === role.value
                ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
                : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
            }`}
          >
            <div className="text-sm">{role.value}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// アイコン選択
function StepIcon({ data, setField, t }: StepBaseProps) {
  const [preview, setPreview] = useState<string | null>(
    (data.icon as string) ?? null
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setPreview(result);
      setField('icon', result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--app-text-muted)]">{t('admin.job_wiz_icon')}</p>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="text-sm text-[var(--app-text)] file:mr-3 file:border file:border-[var(--app-text)]/30 file:bg-transparent file:px-4 file:py-2 file:text-sm file:text-[var(--app-text)] hover:file:border-[var(--app-text)] file:cursor-pointer"
      />
      {preview && (
        <div className="flex items-center gap-3">
          <img src={preview} alt="icon preview" className="w-12 h-12 object-contain" />
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setField('icon', null);
            }}
            className="text-xs text-[var(--app-text-muted)] underline hover:text-[var(--app-text)] transition-colors"
          >
            {t('admin.wizard_skip')}
          </button>
        </div>
      )}
    </div>
  );
}
