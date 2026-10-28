import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../../lib/apiClient';
import { showToast } from '../../../toastBus';
import { WizardFooter, WizardHeader } from './WizardChrome';
import { DoneScreen } from './DoneScreen';
import type { StatsData } from './statsTypes';

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

export function EditBranch({ onBack }: { onBack: () => void }) {
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
      <div className="h-full min-h-0 overflow-auto">
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
      </div>
    );
  }

  if (step === 'selectPatch') {
    return (
      <div className="h-full min-h-0 overflow-auto">
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
      </div>
    );
  }

  if (step === 'edit') {
    return (
      <div className="h-full min-h-0 overflow-auto">
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
      </div>
    );
  }

  // confirm
  return (
    <div className="h-full min-h-0 overflow-auto">
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
    </div>
  );
}
