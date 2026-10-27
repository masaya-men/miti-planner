import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModalButton, INPUT_CLASS } from '../ui/ModalParts';
import { CheckCircle2, Plus } from 'lucide-react';
import type { ImportSheet } from '../../lib/sheetImport/types';
import type { ImportSource } from './gridImportModel';

export const GridImportPhaseBar: React.FC<{
  source: ImportSource;
  phaseName: string;
  setPhaseName: (v: string) => void;
  commitPendingDraft: () => void;
  entries: ImportSheet[];
  perPhaseMits: number[];
}> = ({ source, phaseName, setPhaseName, commitPendingDraft, entries, perPhaseMits }) => {
  const { t } = useTranslation();
  return (
                <div className="px-5 py-2 border-b border-app-border bg-app-surface2/40 flex flex-wrap items-center gap-2 shrink-0">
                  {source === 'matrix' && (
                    <>
                      <span className="text-app-lg text-app-text-muted shrink-0">{t('gridImport.phase_name_label')}</span>
                      <input
                        type="text"
                        value={phaseName}
                        onChange={(e) => setPhaseName(e.target.value)}
                        placeholder={t('gridImport.phase_name_placeholder')}
                        className={`${INPUT_CLASS} !w-auto min-w-[180px]`}
                        spellCheck={false}
                        aria-label={t('gridImport.phase_name_label')}
                      />
                      <ModalButton variant="primary" onClick={commitPendingDraft} className="shrink-0">
                        <Plus size={16} /> {t('gridImport.add_phase_next')}
                      </ModalButton>
                    </>
                  )}
                  {/* 追加済みフェーズ✓チップ(右寄せ・横並び・draft を消しても残る) */}
                  {entries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                      {entries.map((entry, i) => {
                        const name = entry.phaseName || `Phase ${i + 1}`;
                        const events = entry.parsed.rows.length;
                        const mits = perPhaseMits[i] ?? 0;
                        return (
                          <span
                            key={i}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-app-text/5 border border-app-border text-app-lg text-app-text shrink-0"
                            title={t('gridImport.detected_phase', { name, events, mits })}
                          >
                            <CheckCircle2 size={14} className="shrink-0 text-app-text-muted" />
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
  );
};
