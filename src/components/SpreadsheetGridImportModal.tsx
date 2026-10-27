import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader } from './ui/ModalParts';
import { FileSpreadsheet, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { getJobsFromStore, getMitigationsFromStore } from '../hooks/useSkillsData';
import type { SheetImportResult } from '../lib/sheetImport/buildPlanFromSheets';
import { ImportContentSelector } from './ImportContentSelector';
import type { ContentSelectionDefault } from '../lib/contentSelection';
import type { WizardStep, Lang4 } from './gridImport/gridImportModel';
import { GridImportPhaseBar } from './gridImport/GridImportPhaseBar';
import { GridImportMobilePaste } from './gridImport/GridImportMobilePaste';
import { GridImportPcSurface } from './gridImport/GridImportPcSurface';
import { GridImportFooter } from './gridImport/GridImportFooter';
import { PartyAssignmentStep } from './gridImport/PartyAssignmentStep';
import { useGridImportSelection } from './gridImport/useGridImportSelection';
import { useGridImportPaste } from './gridImport/useGridImportPaste';
import { useGridImportParty } from './gridImport/useGridImportParty';
import { useGridImportPreview } from './gridImport/useGridImportPreview';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: SheetImportResult, opts: { contentId: string | null }) => Promise<boolean>;
  defaultSelection: ContentSelectionDefault;
}

export const SpreadsheetGridImportModal: React.FC<Props> = ({ isOpen, onClose, onImport, defaultSelection }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ja';
  // gridRowsFromResult / ジョブ名表示には zh-Hant を含む5言語を正確に渡す(ImportContentSelector 向けの 2 値 lang とは別)。
  // zh-Hant は "zh" で始まるため zh より先に判定する(MitigationSheetPreview.tsx と同じ判定順)。
  const gridLang: Lang4 = i18n.language.startsWith('ja') ? 'ja'
    : (i18n.language === 'zh-Hant' || i18n.language.toLowerCase().startsWith('zh-hant')) ? 'zh-Hant'
    : i18n.language.startsWith('zh') ? 'zh'
    : i18n.language.startsWith('ko') ? 'ko'
    : i18n.language.startsWith('en') ? 'en'
    : 'ja';
  const jobs = useMemo(() => getJobsFromStore(), []);
  const mitigations = useMemo(() => getMitigationsFromStore(), []);

  // ── ウィザードステップ(1=コンテンツ選択 / 2=グリッド) ──
  const [step, setStep] = useState<WizardStep>(1);

  const sel = useGridImportSelection({ isOpen, defaultSelection });
  const { selLevel, setSelLevel, selCategory, setSelCategory, selBoss, setSelBoss, selTitle, setSelTitle, selectedContentId, templateEvents, targetOverrides, setTargetOverrides, toOverridesById } = sel;
  const paste = useGridImportPaste({ t, isOpen, step, setStep, jobs, mitigations, gridLang, setTargetOverrides });
  const { table, setTable, source, matrixParsed, parseFailed, byColumnMode, setByColumnMode, phaseName, setPhaseName, pasteBuffer, mobileCopyHintOpen, setMobileCopyHintOpen, entries, assignment, setAssignment, pasteSurfaceRef, resetAll, handleGridPaste, pasteError, handlePasteFromClipboard, isMobile, handleMobilePasteChange, onColumnPaste, commitPendingDraft, goToParty } = paste;
  const party = useGridImportParty({ jobs, source, table, setTable, entries, matrixParsed, setAssignment });
  const { setMobileColumnSlot, mobileMemberColumns, detectedByRole, handleSlotChange } = party;
  const previewState = useGridImportPreview({ t, step, jobs, mitigations, source, table, entries, matrixParsed, phaseName, assignment, detectedByRole, onImport, onClose, selectedContentId, templateEvents, toOverridesById });
  const { isGrid, preview, displayedPreviewEvents, mobileEventCount, perPhaseMits, skipped, canConfirm, handleConfirm, isGridEmpty, showCreateBlock, blockMsg } = previewState;

  if (!isOpen) return null;

  return (
        <ModalShell
          isOpen
          onClose={onClose}
          backdropOptions={{ dirty: step > 1 || source !== 'none' }}
          className="w-[96vw] max-w-[1280px] h-[88dvh]">
          {/* ヘッダー(ステップ表示をタイトル行へ集約=モック v2 準拠・独立行を廃止してグリッドを広げる) */}
          <ModalHeader
            icon={<FileSpreadsheet size={18} />}
            title={t('gridImport.title')}
            extra={
              <span className="text-app-lg text-app-text-muted truncate">
                {step}/3 · {t(step === 1 ? 'gridImport.step_content' : step === 2 ? 'gridImport.step_grid' : 'gridImport.step_party')}
              </span>
            }
            onClose={onClose}
            closeLabel={t('common.close')}
          />

          {/* ── Step 1: コンテンツ選択 ── */}
          {step === 1 && (
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <ImportContentSelector
                selLevel={selLevel} setSelLevel={setSelLevel}
                selCategory={selCategory} setSelCategory={setSelCategory}
                selBoss={selBoss} setSelBoss={setSelBoss}
                selTitle={selTitle} setSelTitle={setSelTitle}
                lang={lang}
              />
            </div>
          )}

          {/* ── Step 2: スプシ風グリッド(本体が貼り付けサーフェス)。全操作をこの面に集約(右パネル廃止) ── */}
          {step === 2 && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* ③ フェーズ・バー(1行・モック準拠): ラベル + フェーズ名入力 + 主ボタン + ✓チップ(右寄せ)。
                  matrix 貼付中 or 追加済みありのとき表示。自作は phase 列で帯を作るため入力欄は不要。
                  チップは ml-auto で右へ寄せ、draft を消した後も進捗として残す。 */}
              {(source === 'matrix' || entries.length > 0) && (
                <GridImportPhaseBar source={source} phaseName={phaseName} setPhaseName={setPhaseName} commitPendingDraft={commitPendingDraft} entries={entries} perPhaseMits={perPhaseMits} />
              )}

              {/* ③ flow(Ctrl+A 導線・1行) + 列ごと貼り付けトグル。スマホでは非表示。standalone help 行は畳み(この列は? の title へ寄せた)。 */}
              {!isMobile && (
                <div className="px-5 py-1.5 border-b border-app-border bg-app-surface2/60 flex items-center justify-between gap-3 shrink-0">
                  <p className="text-app-lg text-app-text-muted truncate">{t('gridImport.flow_hint')}</p>
                  <button
                    className={clsx('px-3 py-1 rounded-lg text-app-lg font-bold shrink-0',
                      byColumnMode ? 'bg-app-toggle text-app-toggle-text' : 'border border-app-border text-app-text')}
                    onClick={() => setByColumnMode((v) => !v)}
                  >
                    {t('gridImport.paste_by_column')}
                  </button>
                </div>
              )}

              {parseFailed && (
                <div className="px-5 py-2 shrink-0">
                  <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-2 rounded-lg border border-app-amber-border text-app-2xl">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <p>{t('gridImport.parse_failed')}</p>
                  </div>
                </div>
              )}

              {/* グリッド本体: スマホ=textarea 貼付+確認サマリー / PC=従来の GridView */}
              {isMobile ? (
                <GridImportMobilePaste mobileCopyHintOpen={mobileCopyHintOpen} setMobileCopyHintOpen={setMobileCopyHintOpen} pasteBuffer={pasteBuffer} handleMobilePasteChange={handleMobilePasteChange} source={source} mobileEventCount={mobileEventCount} mobileMemberColumns={mobileMemberColumns} jobs={jobs} gridLang={gridLang} setMobileColumnSlot={setMobileColumnSlot} blockMsg={blockMsg} skipped={skipped} />
              ) : (
                <GridImportPcSurface pasteSurfaceRef={pasteSurfaceRef} handleGridPaste={handleGridPaste} table={table} setTable={setTable} mitigations={mitigations} jobs={jobs} source={source} byColumnMode={byColumnMode} onColumnPaste={onColumnPaste} displayedPreviewEvents={displayedPreviewEvents} templateEvents={templateEvents} targetOverrides={targetOverrides} setTargetOverrides={setTargetOverrides} gridLang={gridLang} isGridEmpty={isGridEmpty} handlePasteFromClipboard={handlePasteFromClipboard} pasteError={pasteError} />
              )}
            </div>
          )}

          {/* ── Step 3: パーティ割当 ── */}
          {step === 3 && (
            <PartyAssignmentStep
              assignment={assignment}
              detectedByRole={detectedByRole}
              jobs={jobs}
              onSlotChange={handleSlotChange}
              gridLang={gridLang}
            />
          )}

          {/* フッター */}
          <GridImportFooter step={step} setStep={setStep} onClose={onClose} entries={entries} source={source} resetAll={resetAll} isGrid={isGrid} goToParty={goToParty} isMobile={isMobile} blockMsg={blockMsg} preview={preview} skipped={skipped} handleConfirm={handleConfirm} canConfirm={canConfirm} showCreateBlock={showCreateBlock} />
        </ModalShell>
  );
};
