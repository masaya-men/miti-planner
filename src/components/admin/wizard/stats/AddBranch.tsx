import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard } from '../useWizard';
import type { WizardStep } from '../useWizard';
import { AdminWizard } from '../AdminWizard';
import { apiFetch } from '../../../../lib/apiClient';
import { showToast } from '../../../toastBus';
import type { StatsData } from './statsTypes';

// ---- Branch A: 新規パッチ追加（useWizard） -----------------------------------

 
export function AddBranch({ onBack: _onBack }: { onBack: () => void }) {
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
    <div className="h-full min-h-0 overflow-auto">
      <div className="max-w-xl mx-auto py-8 px-4">
        <AdminWizard
          title={t('admin.stats_wiz_title')}
          wizard={wizard}
          renderStep={renderStep}
          renderConfirmation={renderConfirmation}
          isStepValid={isStepValid}
        />
      </div>
    </div>
  );
}
