import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModalButton } from '../ui/ModalParts';
import { CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import type { SheetImportResult } from '../../lib/sheetImport/buildPlanFromSheets';
import type { ImportSheet, SkippedSkill } from '../../lib/sheetImport/types';
import type { ImportSource, WizardStep } from './gridImportModel';

export const GridImportFooter: React.FC<{
  step: WizardStep;
  setStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  onClose: () => void;
  entries: ImportSheet[];
  source: ImportSource;
  resetAll: () => void;
  isGrid: boolean;
  goToParty: () => void;
  isMobile: boolean;
  blockMsg: { text: string; tone: 'red' | 'amber' } | null;
  preview: SheetImportResult | null;
  skipped: SkippedSkill[];
  handleConfirm: () => void;
  canConfirm: boolean;
  showCreateBlock: boolean;
}> = ({ step, setStep, onClose, entries, source, resetAll, isGrid, goToParty, isMobile, blockMsg, preview, skipped, handleConfirm, canConfirm, showCreateBlock }) => {
  const { t } = useTranslation();
  return (
          <div className="px-5 py-3 border-t border-app-border flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between gap-3">
              {/* 左: 戻る/キャンセル + クリア */}
              <div className="flex items-center gap-2">
                {step === 1 ? (
                  <ModalButton variant="secondary" onClick={onClose}>
                    {t('common.cancel')}
                  </ModalButton>
                ) : (
                  <ModalButton variant="secondary" onClick={() => setStep((s) => (s === 3 ? 2 : 1) as WizardStep)}>
                    <ArrowLeft size={16} /> {t('gridImport.back')}
                  </ModalButton>
                )}
                {/* クリア(やり直す): step2/3 で表示。貼った内容を全消去 */}
                {step !== 1 && (entries.length > 0 || source !== 'none') && (
                  <ModalButton variant="secondary" onClick={() => { resetAll(); setStep(2); }}>
                    {t('gridImport.clear')}
                  </ModalButton>
                )}
              </div>

              {/* 右: ステップ別の主アクション */}
              {step === 1 ? (
                <ModalButton variant="primary" onClick={() => setStep(2)}>
                  {t('gridImport.next')} <ArrowRight size={16} />
                </ModalButton>
              ) : step === 2 && !isGrid ? (
                // matrix: 次へ(割当へ)。何も無ければ無効。
                <ModalButton
                  variant="primary"
                  onClick={goToParty}
                  disabled={source === 'none' && entries.length === 0}
                >
                  {t('gridImport.next_to_party')} <ArrowRight size={16} />
                </ModalButton>
              ) : (
                // grid(step2) / matrix(step3): 作成ブロック
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {!isMobile && (blockMsg ? (
                    <span className={clsx('flex items-center gap-1.5 text-app-2xl',
                      blockMsg.tone === 'red' ? 'text-app-red' : 'text-app-amber')}>
                      <AlertCircle size={14} className="shrink-0" /> {blockMsg.text}
                    </span>
                  ) : (
                    <span className="text-app-2xl text-app-text-muted">
                      {preview && t('gridImport.summary', { labels: preview.labels.length, events: preview.timelineEvents.length, mits: preview.timelineMitigations.length })}
                    </span>
                  ))}
                  {!isMobile && skipped.length > 0 && (
                    <span className="text-app-2xl text-app-amber">
                      {t('gridImport.skipped_count', { count: skipped.length })}
                    </span>
                  )}
                  <ModalButton variant="primary" onClick={handleConfirm} disabled={!canConfirm}>
                    <CheckCircle2 size={16} /> {t('gridImport.create')}
                  </ModalButton>
                </div>
              )}
            </div>
            {/* 補足(読めない技の説明=skipped時)+ 権利表記。作成ブロック表示時のみ。スマホは本体スクロール内に移設済み。 */}
            {!isMobile && showCreateBlock && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-app-sm text-app-amber/80 truncate">
                  {skipped.length > 0 ? t('gridImport.unresolved_note') : ''}
                </span>
                <p className="text-app-sm text-app-text-muted/60 shrink-0">{t('gridImport.rights_notice')}</p>
              </div>
            )}
          </div>
  );
};
