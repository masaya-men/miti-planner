import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModalButton } from '../ui/ModalParts';
import { ClipboardPaste } from 'lucide-react';
import { getMitigationsFromStore } from '../../hooks/useSkillsData';
import type { Job, TimelineEvent } from '../../types';
import type { GridTable } from '../../lib/sheetImport/gridTypes';
import type { CarryTarget } from '../../lib/sheetImport/carryOverTargets';
import type { ImportSource, Lang4 } from './gridImportModel';
import { GridView } from './GridView';

export const GridImportPcSurface: React.FC<{
  pasteSurfaceRef: React.RefObject<HTMLDivElement | null>;
  handleGridPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  table: GridTable;
  setTable: (t: GridTable) => void;
  mitigations: ReturnType<typeof getMitigationsFromStore>;
  jobs: Job[];
  source: ImportSource;
  byColumnMode: boolean;
  onColumnPaste: (colIndex: number, text: string) => void;
  displayedPreviewEvents: TimelineEvent[];
  templateEvents: TimelineEvent[];
  targetOverrides: Record<string, CarryTarget | 'none'>;
  setTargetOverrides: React.Dispatch<React.SetStateAction<Record<string, CarryTarget | 'none'>>>;
  gridLang: Lang4;
  isGridEmpty: boolean;
  handlePasteFromClipboard: () => void;
  pasteError: boolean;
}> = ({ pasteSurfaceRef, handleGridPaste, table, setTable, mitigations, jobs, source, byColumnMode, onColumnPaste, displayedPreviewEvents, templateEvents, targetOverrides, setTargetOverrides, gridLang, isGridEmpty, handlePasteFromClipboard, pasteError }) => {
  const { t } = useTranslation();
  return (
                <div
                  ref={pasteSurfaceRef}
                  tabIndex={0}
                  onPaste={handleGridPaste}
                  className="flex-1 overflow-auto focus:outline-none focus:ring-2 focus:ring-app-blue/40"
                  aria-label={t('gridImport.paste_prompt')}
                >
                  <GridView
                    table={table} setTable={setTable} deps={{ mitigations, jobs }}
                    source={source}
                    byColumnMode={byColumnMode && source !== 'matrix'}
                    onColumnPaste={onColumnPaste}
                    previewEvents={[...displayedPreviewEvents].sort((a, b) => a.time - b.time)}
                    templateEvents={templateEvents}
                    targetOverrides={targetOverrides}
                    onTargetOverride={(key, value) => setTargetOverrides((prev) => ({ ...prev, [key]: value }))}
                    gridLang={gridLang}
                  />
                  {/* 空状態: グリッド本体エリアに大きく貼り付けプロンプトを出す */}
                  {isGridEmpty && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 px-5 text-center select-none">
                      <ClipboardPaste size={36} className="text-app-text-muted" />
                      <p className="text-app-3xl font-bold text-app-text">{t('gridImport.paste_prompt')}</p>
                      <p className="text-app-lg text-app-text-muted">{t('gridImport.paste_hint')}</p>
                      {/* スマホでも確実に貼り付けられるボタン(div の onPaste は iOS で出ないため) */}
                      <ModalButton variant="primary" onClick={handlePasteFromClipboard} className="select-none">
                        <ClipboardPaste size={18} /> {t('gridImport.paste_button')}
                      </ModalButton>
                      {pasteError && (
                        <p className="text-app-lg text-app-amber">{t('gridImport.paste_error')}</p>
                      )}
                      <p className="text-app-lg text-app-text-muted/70">{t('gridImport.format_hint')}</p>
                    </div>
                  )}
                </div>
  );
};
