import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../../lib/apiClient';
import { showToast } from '../../../toastBus';
import { WizardFooter, WizardHeader } from './WizardChrome';
import { DoneScreen } from './DoneScreen';
import type { StatsData } from './statsTypes';

// ---- Branch C: レベル設定変更 -----------------------------------------------

type LevelStep = 'edit' | 'confirm' | 'done';

export function LevelBranch({ onBack }: { onBack: () => void }) {
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
      <div className="h-full min-h-0 overflow-auto">
        <div className="max-w-xl mx-auto py-8 px-4">
          <DoneScreen
            onReset={() => {
              setStep('edit');
              setOriginalData(null);
              setError(null);
            }}
          />
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
    </div>
  );
}
