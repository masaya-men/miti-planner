import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { parseMitigationSheet } from '../lib/sheetImport/parseMitigationSheet';
import { buildPlanFromSheets } from '../lib/sheetImport/buildPlanFromSheets';
import type { SheetImportResult } from '../lib/sheetImport/buildPlanFromSheets';
import type { ParsedSheet } from '../lib/sheetImport/types';
import { getMitigationsFromStore, getJobsFromStore } from '../hooks/useSkillsData';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: SheetImportResult, mode: 'new' | 'replace_current') => void;
}

function resetState() {
  return {
    includeMitigations: true as boolean,
    draft: '' as string,
    sheets: [] as ParsedSheet[],
    parseError: false as boolean,
  };
}

export const SpreadsheetImportModal: React.FC<Props> = ({ isOpen, onClose, onImport }) => {
  useEscapeClose(isOpen, onClose);
  const { t } = useTranslation();

  const [includeMitigations, setIncludeMitigations] = useState(true);
  const [draft, setDraft] = useState('');
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [parseError, setParseError] = useState(false);

  const handleClose = useCallback(() => {
    const s = resetState();
    setIncludeMitigations(s.includeMitigations);
    setDraft(s.draft);
    setSheets(s.sheets);
    setParseError(s.parseError);
    onClose();
  }, [onClose]);

  const handleAddPhase = useCallback(() => {
    const result = parseMitigationSheet(draft);
    if (!result) {
      setParseError(true);
      return;
    }
    setParseError(false);
    setSheets((prev) => [...prev, result]);
    setDraft('');
  }, [draft]);

  // preview は sheets / includeMitigations のみに依存。draft 入力の再レンダーで
  // 重い buildPlanFromSheets を再計算しないよう memo 化（大きな貼り付け対策）。
  const preview = useMemo<SheetImportResult | null>(
    () =>
      sheets.length > 0
        ? buildPlanFromSheets(
            sheets,
            { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() },
            { includeMitigations },
          )
        : null,
    [sheets, includeMitigations],
  );

  const canConfirm = preview !== null && preview.timelineEvents.length > 0;

  const handleConfirm = useCallback(() => {
    if (!preview) return;
    onImport(preview, 'new');
    handleClose();
  }, [preview, onImport, handleClose]);

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        onClick={handleClose}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-[201] w-full max-w-lg glass-tier3 shadow-sm rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
          style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-app-border bg-app-surface2 flex items-center justify-between shrink-0">
            <h2 className="text-app-3xl font-bold text-app-text flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-app-text" />
              {t('sheetImport.title')}
            </h2>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Step 1: Mode */}
            <div className="space-y-2">
              {(['with_mitigations', 'timeline_only'] as const).map((mode) => {
                const checked = mode === 'with_mitigations' ? includeMitigations : !includeMitigations;
                return (
                  <label
                    key={mode}
                    className={clsx(
                      'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all duration-200 text-app-2xl',
                      checked
                        ? 'border-app-text bg-app-text/5 text-app-text'
                        : 'border-app-border text-app-text-muted hover:border-app-text/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="sheet-import-mode"
                      checked={checked}
                      onChange={() => setIncludeMitigations(mode === 'with_mitigations')}
                      className="accent-app-text"
                    />
                    <span>
                      {mode === 'with_mitigations'
                        ? t('sheetImport.mode_with_mitigations')
                        : t('sheetImport.mode_timeline_only')}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Step 2: Paste area */}
            <div className="space-y-2">
              <label className="text-app-lg text-app-text-muted block">
                {t('sheetImport.paste_label')}
              </label>
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (parseError) setParseError(false);
                }}
                className="w-full h-40 bg-app-surface2 border border-app-border rounded-xl p-3 text-[16px] md:text-app-2xl font-mono text-app-text focus:outline-none focus:border-app-text resize-none placeholder:text-app-text-muted"
                spellCheck={false}
              />

              {parseError && (
                <div className="flex items-start gap-2 text-app-red bg-app-red-dim p-3 rounded-lg border border-app-red-border text-app-2xl">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p>{t('sheetImport.parse_failed')}</p>
                </div>
              )}

              <button
                onClick={handleAddPhase}
                disabled={!draft.trim()}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-app-2xl font-bold transition-all duration-200',
                  draft.trim()
                    ? 'bg-app-toggle text-app-toggle-text hover:opacity-80 cursor-pointer active:scale-95'
                    : 'bg-app-surface2 text-app-text-muted cursor-not-allowed',
                )}
              >
                {t('sheetImport.add_phase')}
              </button>
            </div>

            {/* Added phases list */}
            {sheets.length > 0 && (
              <div className="space-y-1">
                {sheets.map((sheet, i) => {
                  const phaseNames = [...new Set(sheet.rows.map((r) => r.phaseLabel).filter(Boolean))];
                  const phaseName = phaseNames.join(' / ') || `Phase ${i + 1}`;
                  const events = sheet.rows.length;
                  const mits = sheet.rows.reduce((acc, r) => acc + r.trueColumnIndexes.length, 0);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-app-text/5 border border-app-border text-app-2xl text-app-text"
                    >
                      <CheckCircle2 size={14} className="shrink-0 text-app-text-muted" />
                      <span>
                        {t('sheetImport.detected_phase', { name: phaseName, events, mits })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div className="space-y-3 pt-1">
                {/* Summary */}
                <div className="p-3 rounded-xl bg-app-text/5 border border-app-border text-app-2xl text-app-text">
                  {t('sheetImport.preview_summary', {
                    phases: preview.phases.length,
                    events: preview.timelineEvents.length,
                    mits: preview.timelineMitigations.length,
                    party: preview.party.length,
                  })}
                </div>

                {/* Party */}
                {preview.party.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-app-lg text-app-text-muted uppercase tracking-wider">
                      {t('sheetImport.party_label')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {preview.party.map((p) => (
                        <span
                          key={p.slot}
                          className="px-2 py-1 rounded-md bg-app-surface2 border border-app-border text-app-2xl text-app-text font-mono"
                        >
                          {p.slot}: {p.jobId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skipped */}
                {preview.skipped.length > 0 && (
                  <details className="rounded-lg border border-amber-500/30 overflow-hidden">
                    <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-app-2xl text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 transition-colors select-none">
                      <ChevronDown size={14} className="shrink-0" />
                      {t('sheetImport.skipped_label', { count: preview.skipped.length })}
                    </summary>
                    <ul className="px-4 py-2 space-y-1">
                      {preview.skipped.map((s, i) => (
                        <li key={i} className="text-app-lg text-amber-400/80 font-mono">
                          {s.job} / {s.skillName}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {/* Rights notice */}
            <p className="text-app-lg text-app-text-muted/60">
              {t('sheetImport.rights_notice')}
            </p>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-app-border bg-app-surface2 flex justify-end gap-3 shrink-0">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-app-2xl font-bold text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-95"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={clsx(
                'flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold uppercase transition-all duration-300',
                canConfirm
                  ? 'bg-app-toggle text-app-toggle-text hover:opacity-80 cursor-pointer active:scale-95'
                  : 'bg-app-surface2 text-app-text-muted cursor-not-allowed',
              )}
            >
              <CheckCircle2 size={16} />
              {t('sheetImport.confirm')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
