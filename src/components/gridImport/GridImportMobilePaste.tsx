import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { Job } from '../../types';
import type { SkippedSkill } from '../../lib/sheetImport/types';
import type { GridColumn } from '../../lib/sheetImport/gridTypes';
import { SLOTS_BY_ROLE, type PartySlot, type SlotRole } from '../../lib/sheetImport/partyAssignment';
import type { ImportSource, Lang4 } from './gridImportModel';

export const GridImportMobilePaste: React.FC<{
  mobileCopyHintOpen: boolean;
  setMobileCopyHintOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pasteBuffer: string;
  handleMobilePasteChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  source: ImportSource;
  mobileEventCount: number;
  mobileMemberColumns: { col: GridColumn; ci: number; role: SlotRole | undefined }[];
  jobs: Job[];
  gridLang: Lang4;
  setMobileColumnSlot: (ci: number, slot: PartySlot | null) => void;
  blockMsg: { text: string; tone: 'red' | 'amber' } | null;
  skipped: SkippedSkill[];
}> = ({ mobileCopyHintOpen, setMobileCopyHintOpen, pasteBuffer, handleMobilePasteChange, source, mobileEventCount, mobileMemberColumns, jobs, gridLang, setMobileColumnSlot, blockMsg, skipped }) => {
  const { t } = useTranslation();
  return (
                <div className="flex-1 overflow-auto px-5 py-5 flex flex-col gap-4">
                  {/* コピー手順(折りたたみ・短文のみ) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setMobileCopyHintOpen((o) => !o)}
                      className="flex items-center gap-1.5 text-app-lg text-app-text-muted"
                    >
                      <ChevronRight size={14} className={clsx('transition-transform duration-200', mobileCopyHintOpen && 'rotate-90')} />
                      {t('gridImport.mobile_copy_hint_toggle')}
                    </button>
                    {mobileCopyHintOpen && (
                      <p className="mt-2 text-app-lg text-app-text-muted leading-relaxed">{t('gridImport.mobile_copy_hint')}</p>
                    )}
                  </div>

                  {/* 貼付 textarea(長押し→ペースト) */}
                  <textarea
                    value={pasteBuffer}
                    onChange={handleMobilePasteChange}
                    placeholder={t('gridImport.mobile_paste_placeholder')}
                    aria-label={t('gridImport.mobile_paste_label')}
                    rows={4}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="w-full rounded-xl border border-app-border bg-app-surface2 px-4 py-3 text-app-2xl text-app-text focus:outline-none focus:border-app-text placeholder:text-app-text-muted"
                  />

                  {/* 確認サマリー or 未貼付メッセージ */}
                  {source !== 'none' ? (
                    <div className="flex items-center gap-2 text-app-2xl text-app-text">
                      <CheckCircle2 size={16} className="text-app-text-muted shrink-0" />
                      {t('gridImport.mobile_read_ok', { events: mobileEventCount })}
                    </div>
                  ) : (
                    <p className="text-app-lg text-app-text-muted">{t('gridImport.mobile_paste_empty')}</p>
                  )}

                  {/* スマホ grid: メンバー列ごとに枠(MT/ST/H1…)を割り当てるリスト */}
                  {source === 'grid' && mobileMemberColumns.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-app-2xl font-bold text-app-text">{t('gridImport.mobile_assign_party')}</p>
                      {mobileMemberColumns.map(({ col, ci, role }) => {
                        const job = jobs.find((j) => j.id === col.jobId);
                        const jobLabel = job ? (job.name[gridLang as keyof typeof job.name] ?? job.name.ja) : (col.jobId ?? col.header);
                        return (
                          <div key={ci} className="flex items-center gap-3">
                            <span className="flex-1 truncate text-app-2xl text-app-text">{jobLabel}</span>
                            <select
                              value={col.slot ?? ''}
                              aria-label={t('gridImport.assign_slot')}
                              onChange={(e) => setMobileColumnSlot(ci, (e.target.value as PartySlot) || null)}
                              className="appearance-none bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text focus:outline-none"
                            >
                              <option value="">{t('gridImport.slot_empty')}</option>
                              {role && SLOTS_BY_ROLE[role].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* スマホ grid: フッターの冗長ステータスをスクロール本体に移設(フッターを最小高さに保つ) */}
                  {source === 'grid' && (
                    <div className="flex flex-col gap-1.5">
                      {blockMsg && (
                        <span className={clsx('flex items-start gap-1.5 text-app-2xl', blockMsg.tone === 'red' ? 'text-app-red' : 'text-app-amber')}>
                          <AlertCircle size={14} className="shrink-0 mt-0.5" /> {blockMsg.text}
                        </span>
                      )}
                      {skipped.length > 0 && (
                        <>
                          <span className="text-app-2xl text-app-amber">{t('gridImport.skipped_count', { count: skipped.length })}</span>
                          <span className="text-app-sm text-app-amber/80">{t('gridImport.unresolved_note')}</span>
                        </>
                      )}
                      <p className="text-app-sm text-app-text-muted/60">{t('gridImport.rights_notice')}</p>
                    </div>
                  )}
                </div>
  );
};
