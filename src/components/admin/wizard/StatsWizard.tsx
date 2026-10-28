/**
 * ステータス更新ウィザード
 * Branch A: 新しいパッチのステータスを追加（useWizard）
 * Branch B: 既存のステータスを修正（useState直接）
 * Branch C: レベル設定を変更（useState直接）
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { WizardFooter, WizardHeader } from './stats/WizardChrome';
import { AddBranch } from './stats/AddBranch';
import { EditBranch } from './stats/EditBranch';
import { LevelBranch } from './stats/LevelBranch';
import type { TopMode } from './stats/statsTypes';

// ---- メインコンポーネント ----------------------------------------------------

export function StatsWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<TopMode | null>(null);

  // モード選択画面
  if (!mode) {
    return (
      <div className="h-full min-h-0 overflow-auto">
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
