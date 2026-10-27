import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalButton, INPUT_CLASS } from './ui/ModalParts';
import { FileSpreadsheet, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, ClipboardPaste, Plus, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { getJobsFromStore, getMitigationsFromStore } from '../hooks/useSkillsData';
import type { SheetImportResult } from '../lib/sheetImport/buildPlanFromSheets';
import { SLOTS_BY_ROLE, type PartySlot } from '../lib/sheetImport/partyAssignment';
import { ImportContentSelector } from './ImportContentSelector';
import type { ContentSelectionDefault } from '../lib/contentSelection';
import type { WizardStep, Lang4 } from './gridImport/gridImportModel';
import { GridView } from './gridImport/GridView';
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

export { setColumnValues, autoAssignSingleSlots, sortResultPartyBySlots } from './gridImport/gridImportModel';

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
              ) : (
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
        </ModalShell>
  );
};
