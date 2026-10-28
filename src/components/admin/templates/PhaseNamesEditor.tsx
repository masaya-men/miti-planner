/**
 * テンプレートエディター — フェーズ名編集欄(時刻は固定、名前のみ編集可能)
 */
import { useTranslation } from 'react-i18next';
import type { LocalizedString } from '../../../types';
import type { TemplateData } from '../../../types/template';
import { formatTime } from '../../../utils/templateConversions';

interface PhaseNamesEditorProps {
  phases: TemplateData['phases'];
  onUpdatePhaseName: (phaseId: number, name: LocalizedString) => void;
}

export function PhaseNamesEditor({ phases, onUpdatePhaseName }: PhaseNamesEditorProps) {
  const { t } = useTranslation();

  return (
      <div className="mb-4 border border-app-text/10 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-app-surface2 border-b border-app-text/10">
          <span className="text-app-lg font-medium text-app-text">{t('admin.tpl_phase_names_title', 'フェーズ名')}</span>
        </div>
        <div className="divide-y divide-app-text/5">
          {phases.map((phase, i) => {
            const nameObj: LocalizedString = phase.name
              ? (typeof phase.name === 'string' ? { ja: '', en: phase.name } : phase.name as LocalizedString)
              : { ja: '', en: '' };
            return (
              <div key={phase.id} className="px-3 py-2 flex items-center gap-3">
                <span className="text-app-base text-app-text-muted shrink-0 w-[80px]">
                  P{i + 1} ({formatTime(phase.startTimeSec)})
                </span>
                <input
                  type="text"
                  value={nameObj.ja}
                  onChange={(e) => onUpdatePhaseName(phase.id, { ...nameObj, ja: e.target.value })}
                  placeholder="JA"
                  className="flex-1 min-w-0 px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text"
                />
                <input
                  type="text"
                  value={nameObj.en}
                  onChange={(e) => onUpdatePhaseName(phase.id, { ...nameObj, en: e.target.value })}
                  placeholder="EN"
                  className="flex-1 min-w-0 px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text"
                />
                <input
                  type="text"
                  value={nameObj.zh ?? ''}
                  onChange={(e) => onUpdatePhaseName(phase.id, { ...nameObj, zh: e.target.value || undefined })}
                  placeholder="ZH"
                  className="flex-1 min-w-0 px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text"
                />
                <input
                  type="text"
                  value={nameObj['zh-Hant'] ?? ''}
                  onChange={(e) => onUpdatePhaseName(phase.id, { ...nameObj, 'zh-Hant': e.target.value || undefined })}
                  placeholder="ZH-Hant"
                  className="flex-1 min-w-0 px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text"
                />
                <input
                  type="text"
                  value={nameObj.ko ?? ''}
                  onChange={(e) => onUpdatePhaseName(phase.id, { ...nameObj, ko: e.target.value || undefined })}
                  placeholder="KO"
                  className="flex-1 min-w-0 px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text"
                />
              </div>
            );
          })}
        </div>
      </div>
  );
}
