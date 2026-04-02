/**
 * ステータス更新ウィザード
 * Branch A: 新しいパッチのステータスを追加（useWizard）
 * Branch B: 既存のステータスを修正（useState直接）
 * Branch C: レベル設定を変更（useState直接）
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

interface PatchStatEntry {
  hp: number;
  mainStat: number;
  det: number;
  wd: number;
}

interface StatsData {
  levelModifiers: Record<string, { hpMultiplier: number; [key: string]: number }>;
  patchStats: Record<string, {
    tank: PatchStatEntry;
    other: PatchStatEntry;
  }>;
  defaultStatsByLevel: Record<string, string>;
}

type TopMode = 'add' | 'edit' | 'level';

// ---- 共通UIパーツ -----------------------------------------------------------

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

// ---- 完了画面 ---------------------------------------------------------------

interface DoneScreenProps {
  onReset: () => void;
}

function DoneScreen({ onReset }: DoneScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-[var(--app-text)]">
      <div className="text-app-6xl font-bold">{t('admin.wizard_success')}</div>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onReset}
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
  );
}

// ---- Branch B: 既存パッチ編集 -----------------------------------------------

type EditStep = 'selectPatch' | 'edit' | 'confirm' | 'done';

interface EditFormState {
  tankHp: string;
  tankMain: string;
  tankDet: string;
  tankWd: string;
  otherHp: string;
  otherMain: string;
  otherDet: string;
  otherWd: string;
}

function EditBranch({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<EditStep>('selectPatch');
  const [patchList, setPatchList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatch, setSelectedPatch] = useState<string>('');
  const [originalData, setOriginalData] = useState<EditFormState | null>(null);
  const [editData, setEditData] = useState<EditFormState>({
    tankHp: '',
    tankMain: '',
    tankDet: '',
    tankWd: '',
    otherHp: '',
    otherMain: '',
    otherDet: '',
    otherWd: '',
  });

  useEffect(() => {
    setIsLoading(true);
    apiFetch('/api/admin?resource=templates&type=stats')
      .then((res) => res.json())
      .then((data: StatsData) => {
        if (data.patchStats) {
          // パッチ番号を降順ソート
          const keys = Object.keys(data.patchStats).sort((a, b) =>
            parseFloat(b) - parseFloat(a)
          );
          setPatchList(keys);
        }
      })
      .catch(() => {
        setError('データの取得に失敗しました');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelectPatch = useCallback(
    async (patch: string) => {
      setIsLoading(true);
      try {
        const res = await apiFetch('/api/admin?resource=templates&type=stats');
        const data: StatsData = await res.json();
        const entry = data.patchStats[patch];
        if (!entry) throw new Error('パッチデータが見つかりません');
        const form: EditFormState = {
          tankHp: String(entry.tank.hp),
          tankMain: String(entry.tank.mainStat),
          tankDet: String(entry.tank.det),
          tankWd: String(entry.tank.wd),
          otherHp: String(entry.other.hp),
          otherMain: String(entry.other.mainStat),
          otherDet: String(entry.other.det),
          otherWd: String(entry.other.wd),
        };
        setSelectedPatch(patch);
        setOriginalData(form);
        setEditData(form);
        setStep('edit');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateField = useCallback((key: keyof EditFormState, value: string) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const changedFields = originalData
    ? (Object.keys(editData) as (keyof EditFormState)[]).filter(
        (key) => editData[key] !== originalData[key]
      )
    : [];

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin?resource=templates&type=stats');
      if (!res.ok) throw new Error('データの取得に失敗しました');
      const data: StatsData = await res.json();

      const updated: StatsData = {
        ...data,
        patchStats: {
          ...data.patchStats,
          [selectedPatch]: {
            tank: {
              hp: Number(editData.tankHp) || 0,
              mainStat: Number(editData.tankMain) || 0,
              det: Number(editData.tankDet) || 0,
              wd: Number(editData.tankWd) || 0,
            },
            other: {
              hp: Number(editData.otherHp) || 0,
              mainStat: Number(editData.otherMain) || 0,
              det: Number(editData.otherDet) || 0,
              wd: Number(editData.otherWd) || 0,
            },
          },
        },
      };

      const saveRes = await apiFetch('/api/admin?resource=templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'stats', ...updated }),
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
  }, [selectedPatch, editData, t]);

  const inputClass =
    'w-full border border-[var(--app-text)]/30 bg-transparent px-3 py-2 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]';
  const labelClass = 'text-app-lg text-[var(--app-text-muted)]';

  const fieldLabels: Record<keyof EditFormState, string> = {
    tankHp: t('admin.stats_wiz_tank_hp'),
    tankMain: t('admin.stats_wiz_tank_main'),
    tankDet: t('admin.stats_wiz_tank_det'),
    tankWd: t('admin.stats_wiz_tank_wd'),
    otherHp: t('admin.stats_wiz_other_hp'),
    otherMain: t('admin.stats_wiz_other_main'),
    otherDet: t('admin.stats_wiz_other_det'),
    otherWd: t('admin.stats_wiz_other_wd'),
  };

  if (step === 'done') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <DoneScreen
          onReset={() => {
            setStep('selectPatch');
            setSelectedPatch('');
            setOriginalData(null);
            setError(null);
          }}
        />
      </div>
    );
  }

  if (step === 'selectPatch') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <WizardHeader
          title={t('admin.stats_wiz_title')}
          stepLabel="1 / 3"
          question={t('admin.stats_wiz_select_patch')}
        />
        {isLoading ? (
          <div className="text-app-2xl text-[var(--app-text-muted)] py-4">Loading...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {patchList.map((patch) => (
              <button
                key={patch}
                type="button"
                onClick={() => handleSelectPatch(patch)}
                className="p-3 border border-[var(--app-text)]/20 text-left hover:border-[var(--app-text)]/60 transition-colors text-app-2xl font-medium text-[var(--app-text)]"
              >
                Patch {patch}
              </button>
            ))}
          </div>
        )}
        {error && (
          <div className="border border-[var(--app-text)] p-3 text-app-2xl mt-4">{error}</div>
        )}
        <WizardFooter onBack={onBack} backLabel={t('admin.wizard_back')} />
      </div>
    );
  }

  if (step === 'edit') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <WizardHeader
          title={t('admin.stats_wiz_title')}
          stepLabel="2 / 3"
          question={`Patch ${selectedPatch}`}
        />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="col-span-2 text-app-lg font-semibold uppercase tracking-wider text-[var(--app-text-muted)] pt-2">
            Tank
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('admin.stats_wiz_tank_hp')}</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={editData.tankHp}
              onChange={(e) => updateField('tankHp', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('admin.stats_wiz_tank_main')}</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={editData.tankMain}
              onChange={(e) => updateField('tankMain', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('admin.stats_wiz_tank_det')}</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={editData.tankDet}
              onChange={(e) => updateField('tankDet', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('admin.stats_wiz_tank_wd')}</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={editData.tankWd}
              onChange={(e) => updateField('tankWd', e.target.value)}
            />
          </div>
          <div className="col-span-2 text-app-lg font-semibold uppercase tracking-wider text-[var(--app-text-muted)] pt-2">
            Other
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('admin.stats_wiz_other_hp')}</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={editData.otherHp}
              onChange={(e) => updateField('otherHp', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('admin.stats_wiz_other_main')}</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={editData.otherMain}
              onChange={(e) => updateField('otherMain', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('admin.stats_wiz_other_det')}</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={editData.otherDet}
              onChange={(e) => updateField('otherDet', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('admin.stats_wiz_other_wd')}</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={editData.otherWd}
              onChange={(e) => updateField('otherWd', e.target.value)}
            />
          </div>
        </div>
        {error && (
          <div className="border border-[var(--app-text)] p-3 text-app-2xl mb-4">{error}</div>
        )}
        <WizardFooter
          onBack={() => setStep('selectPatch')}
          backLabel={t('admin.wizard_back')}
          onNext={() => setStep('confirm')}
          nextLabel={t('admin.wizard_next')}
          showNext={true}
        />
      </div>
    );
  }

  // confirm
  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="flex flex-col gap-6 text-[var(--app-text)]">
        <div className="border-b border-[var(--app-text)] pb-3">
          <h2 className="text-app-4xl font-bold">{t('admin.stats_wiz_title')}</h2>
          <p className="text-app-2xl text-[var(--app-text-muted)] mt-1">
            {t('admin.wizard_confirmation')}
          </p>
        </div>
        {changedFields.length === 0 ? (
          <p className="text-app-2xl text-[var(--app-text-muted)]">
            {t('admin.skill_wiz_changes_highlight') === t('admin.skill_wiz_changes_highlight') ? (i18n.language.startsWith('ja') ? '変更はありません' : 'No changes') : ''}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
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

// ---- Branch C: レベル設定変更 -----------------------------------------------

type LevelStep = 'edit' | 'confirm' | 'done';

function LevelBranch({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<LevelStep>('edit');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patchList, setPatchList] = useState<string[]>([]);
  const [levelKeys, setLevelKeys] = useState<string[]>([]);
  const [originalData, setOriginalData] = useState<Record<string, string> | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch('/api/admin?resource=templates&type=stats')
      .then((res) => res.json())
      .then((data: StatsData) => {
        const patches = Object.keys(data.patchStats ?? {}).sort(
          (a, b) => parseFloat(b) - parseFloat(a)
        );
        setPatchList(patches);
        const defaults = data.defaultStatsByLevel ?? {};
        const levels = Object.keys(defaults).sort((a, b) => Number(b) - Number(a));
        setLevelKeys(levels);
        setOriginalData(defaults);
        setEditData({ ...defaults });
      })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setIsLoading(false));
  }, []);

  const updateLevel = useCallback((level: string, value: string) => {
    setEditData((prev) => ({ ...prev, [level]: value }));
  }, []);

  const changedLevels = originalData
    ? levelKeys.filter((lv) => editData[lv] !== originalData[lv])
    : [];

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin?resource=templates&type=stats');
      if (!res.ok) throw new Error('データの取得に失敗しました');
      const data: StatsData = await res.json();

      const saveRes = await apiFetch('/api/admin?resource=templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'stats',
          levelModifiers: data.levelModifiers,
          patchStats: data.patchStats,
          defaultStatsByLevel: editData,
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
  }, [editData, t]);

  const selectClass =
    'w-full border border-[var(--app-text)]/30 bg-transparent px-3 py-2 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]';
  const labelClass = 'text-app-lg text-[var(--app-text-muted)]';

  if (step === 'done') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <DoneScreen
          onReset={() => {
            setStep('edit');
            setOriginalData(null);
            setError(null);
          }}
        />
      </div>
    );
  }

  if (step === 'edit') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <WizardHeader
          title={t('admin.stats_wiz_title')}
          stepLabel="1 / 2"
          question={t('admin.stats_wiz_level')}
        />
        {isLoading ? (
          <div className="text-app-2xl text-[var(--app-text-muted)] py-4">Loading...</div>
        ) : (
          <div className="flex flex-col gap-4 mb-6">
            {levelKeys.map((lv) => (
              <div key={lv} className="flex flex-col gap-1">
                <label className={labelClass}>Lv {lv}</label>
                <select
                  className={selectClass}
                  value={editData[lv] ?? ''}
                  onChange={(e) => updateLevel(lv, e.target.value)}
                >
                  {patchList.map((patch) => (
                    <option key={patch} value={patch}>
                      Patch {patch}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="border border-[var(--app-text)] p-3 text-app-2xl mb-4">{error}</div>
        )}
        <WizardFooter
          onBack={onBack}
          backLabel={t('admin.wizard_back')}
          onNext={() => setStep('confirm')}
          nextLabel={t('admin.wizard_next')}
          showNext={!isLoading}
        />
      </div>
    );
  }

  // confirm
  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="flex flex-col gap-6 text-[var(--app-text)]">
        <div className="border-b border-[var(--app-text)] pb-3">
          <h2 className="text-app-4xl font-bold">{t('admin.stats_wiz_title')}</h2>
          <p className="text-app-2xl text-[var(--app-text-muted)] mt-1">
            {t('admin.wizard_confirmation')}
          </p>
        </div>
        {changedLevels.length === 0 ? (
          <p className="text-app-2xl text-[var(--app-text-muted)]">
            {t('admin.skill_wiz_changes_highlight') === t('admin.skill_wiz_changes_highlight') ? (i18n.language.startsWith('ja') ? '変更はありません' : 'No changes') : ''}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {changedLevels.map((lv) => (
              <div
                key={lv}
                className="border border-[var(--app-text)] p-3 flex flex-col gap-1"
              >
                <span className="text-app-lg text-[var(--app-text-muted)]">Lv {lv}</span>
                <div className="flex items-center gap-2 text-app-2xl">
                  <span className="opacity-40 line-through">
                    {originalData?.[lv] ?? '—'}
                  </span>
                  <span className="text-[var(--app-text-muted)]">→</span>
                  <span className="font-medium">{editData[lv]}</span>
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
            disabled={isSubmitting || changedLevels.length === 0}
            className="bg-[var(--app-text)] text-[var(--app-bg)] px-6 py-2 text-app-2xl font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {isSubmitting ? t('admin.wizard_saving') : t('admin.wizard_save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Branch A: 新規パッチ追加（useWizard） -----------------------------------

function AddBranch({ onBack: _onBack }: { onBack: () => void }) {
  const { t } = useTranslation();

  const steps: WizardStep[] = [
    { id: 'patch', label: 'admin.stats_wiz_patch', required: true },
    { id: 'tankHp', label: 'admin.stats_wiz_tank_hp', required: true },
    { id: 'tankMain', label: 'admin.stats_wiz_tank_main', required: true },
    { id: 'tankDet', label: 'admin.stats_wiz_tank_det', required: true },
    { id: 'tankWd', label: 'admin.stats_wiz_tank_wd', required: true },
    { id: 'otherHp', label: 'admin.stats_wiz_other_hp', required: true },
    { id: 'otherMain', label: 'admin.stats_wiz_other_main', required: true },
    { id: 'otherDet', label: 'admin.stats_wiz_other_det', required: true },
    { id: 'otherWd', label: 'admin.stats_wiz_other_wd', required: true },
  ];

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    const res = await apiFetch('/api/admin?resource=templates&type=stats');
    if (!res.ok) throw new Error('データの取得に失敗しました');
    const statsData: StatsData = await res.json();

    const patch = String(data.patch ?? '');
    const updated: StatsData = {
      ...statsData,
      patchStats: {
        ...statsData.patchStats,
        [patch]: {
          tank: {
            hp: Number(data.tankHp) || 0,
            mainStat: Number(data.tankMain) || 0,
            det: Number(data.tankDet) || 0,
            wd: Number(data.tankWd) || 0,
          },
          other: {
            hp: Number(data.otherHp) || 0,
            mainStat: Number(data.otherMain) || 0,
            det: Number(data.otherDet) || 0,
            wd: Number(data.otherWd) || 0,
          },
        },
      },
    };

    const saveRes = await apiFetch('/api/admin?resource=templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'stats', ...updated }),
    });

    if (!saveRes.ok) {
      const errData = await saveRes.json().catch(() => ({}));
      const msg = (errData as { error?: string }).error ?? '保存に失敗しました';
      showToast(msg, 'error');
      throw new Error(msg);
    }

    showToast(t('admin.wizard_save'));
  }, [t]);

  const wizard = useWizard({ steps, onSubmit: handleSubmit });
  const { data, setField } = wizard;

  const isStepValid = useCallback(
    (stepId: string) => {
      const val = data[stepId];
      if (stepId === 'patch') return String(val ?? '').trim().length > 0;
      return val !== undefined && val !== '' && !isNaN(Number(val));
    },
    [data]
  );

  const inputClass =
    'w-full border border-[var(--app-text)]/30 bg-transparent px-3 py-2 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)]';

  const renderStep = useCallback(
    (stepId: string) => {
      const label = t(`admin.stats_wiz_${stepId === 'patch' ? 'patch' : stepId.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}`);
      const isTextStep = stepId === 'patch';

      return (
        <div className="flex flex-col gap-4">
          <p className="text-app-2xl font-medium text-[var(--app-text)]">{label}</p>
          <input
            type={isTextStep ? 'text' : 'number'}
            min={isTextStep ? undefined : 0}
            className={inputClass}
            value={String(data[stepId] ?? '')}
            onChange={(e) => setField(stepId, e.target.value)}
            placeholder={isTextStep ? 'e.g. 7.2' : ''}
            autoFocus
          />
        </div>
      );
    },
    [data, setField, t, inputClass]
  );

  // タンク / その他 を横に並べた確認テーブル
  const renderConfirmation = useCallback(() => {
    const tankRows = [
      { label: t('admin.stats_wiz_tank_hp'), value: data.tankHp },
      { label: t('admin.stats_wiz_tank_main'), value: data.tankMain },
      { label: t('admin.stats_wiz_tank_det'), value: data.tankDet },
      { label: t('admin.stats_wiz_tank_wd'), value: data.tankWd },
    ];
    const otherRows = [
      { label: t('admin.stats_wiz_other_hp'), value: data.otherHp },
      { label: t('admin.stats_wiz_other_main'), value: data.otherMain },
      { label: t('admin.stats_wiz_other_det'), value: data.otherDet },
      { label: t('admin.stats_wiz_other_wd'), value: data.otherWd },
    ];

    return (
      <div className="flex flex-col gap-4 text-[var(--app-text)]">
        <p className="text-app-2xl">
          <span className="text-[var(--app-text-muted)]">Patch: </span>
          <span className="font-bold">{String(data.patch ?? '')}</span>
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-app-lg font-semibold uppercase tracking-wider text-[var(--app-text-muted)] mb-2">
              Tank
            </p>
            <table className="w-full text-app-2xl border-collapse">
              <tbody>
                {tankRows.map((row) => (
                  <tr key={row.label} className="border-b border-[var(--app-text)]/10">
                    <td className="py-1.5 pr-2 text-[var(--app-text-muted)] text-app-lg">{row.label}</td>
                    <td className="py-1.5 font-medium text-right">{String(row.value ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="text-app-lg font-semibold uppercase tracking-wider text-[var(--app-text-muted)] mb-2">
              Other
            </p>
            <table className="w-full text-app-2xl border-collapse">
              <tbody>
                {otherRows.map((row) => (
                  <tr key={row.label} className="border-b border-[var(--app-text)]/10">
                    <td className="py-1.5 pr-2 text-[var(--app-text-muted)] text-app-lg">{row.label}</td>
                    <td className="py-1.5 font-medium text-right">{String(row.value ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }, [data, t]);

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <AdminWizard
        title={t('admin.stats_wiz_title')}
        wizard={wizard}
        renderStep={renderStep}
        renderConfirmation={renderConfirmation}
        isStepValid={isStepValid}
      />
    </div>
  );
}

// ---- メインコンポーネント ----------------------------------------------------

export function StatsWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<TopMode | null>(null);

  // モード選択画面
  if (!mode) {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <WizardHeader
          title={t('admin.stats_wiz_title')}
          stepLabel="1 / —"
          question={t('admin.stats_wiz_mode')}
        />
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMode('add')}
            className="p-4 border border-[var(--app-text)]/20 text-left hover:border-[var(--app-text)]/60 transition-colors text-[var(--app-text)]"
          >
            <div className="text-app-2xl font-medium">{t('admin.stats_wiz_add')}</div>
          </button>
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="p-4 border border-[var(--app-text)]/20 text-left hover:border-[var(--app-text)]/60 transition-colors text-[var(--app-text)]"
          >
            <div className="text-app-2xl font-medium">{t('admin.stats_wiz_edit')}</div>
          </button>
          <button
            type="button"
            onClick={() => setMode('level')}
            className="p-4 border border-[var(--app-text)]/20 text-left hover:border-[var(--app-text)]/60 transition-colors text-[var(--app-text)]"
          >
            <div className="text-app-2xl font-medium">{t('admin.stats_wiz_level')}</div>
          </button>
        </div>
        <WizardFooter
          onBack={() => navigate('/admin')}
          backLabel={t('admin.wizard_back')}
        />
      </div>
    );
  }

  if (mode === 'add') {
    return <AddBranch onBack={() => setMode(null)} />;
  }

  if (mode === 'edit') {
    return <EditBranch onBack={() => setMode(null)} />;
  }

  // level
  return <LevelBranch onBack={() => setMode(null)} />;
}
