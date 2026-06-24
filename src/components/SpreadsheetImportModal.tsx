import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronDown, ArrowLeft, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { parseMitigationSheet } from '../lib/sheetImport/parseMitigationSheet';
import { buildPlanFromSheets } from '../lib/sheetImport/buildPlanFromSheets';
import type { SheetImportResult } from '../lib/sheetImport/buildPlanFromSheets';
import type { ImportSheet } from '../lib/sheetImport/types';
import { getMitigationsFromStore, getJobsFromStore } from '../hooks/useSkillsData';
import {
  SLOTS_BY_ROLE, emptyAssignment, assignSlot,
  groupByRole, autoFillSingles, isAssignmentComplete, buildPartyOverride, isSlotRequired,
  type PartyAssignment, type PartySlot, type SlotRole,
} from '../lib/sheetImport/partyAssignment';
import { detectUsedJobIds } from '../lib/sheetImport/detectUsedJobIds';
import { importBlockReason } from '../lib/sheetImport/importBlockReason';
import { applyTemplateTargetsToResult } from '../lib/sheetImport/applyTemplateTargets';
import {
  type WizardStep, wizardHasPartyStep, wizardTotalSteps, wizardStepPosition,
  wizardCanAdvance, wizardNextStep, wizardPrevStep, wizardClampStep, resolvePhaseName,
} from '../lib/sheetImport/importWizard';
import { deriveContentId, resolveInitialSelection } from '../lib/contentSelection';
import type { ContentSelectionDefault } from '../lib/contentSelection';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';
import { ImportContentSelector } from './ImportContentSelector';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: SheetImportResult, opts: { contentId: string | null }) => Promise<boolean>;
  defaultSelection: ContentSelectionDefault;
}

const STEP_TITLE_KEY: Record<WizardStep, string> = {
  1: 'sheetImport.step_title_setup',
  2: 'sheetImport.step_title_paste',
  3: 'sheetImport.step_title_party',
  4: 'sheetImport.step_title_confirm',
};

/** 進捗ドット + 現在ステップ名（party無しのとき step4 は 3番目として表示）。 */
const WizardProgress: React.FC<{ step: WizardStep; hasPartyStep: boolean }> = ({ step, hasPartyStep }) => {
  const { t } = useTranslation();
  const total = wizardTotalSteps(hasPartyStep);
  const position = wizardStepPosition(step, hasPartyStep);
  return (
    <div className="px-5 py-2.5 border-b border-app-border bg-app-surface2 flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'h-1.5 rounded-full transition-all duration-200',
              i + 1 === position
                ? 'w-5 bg-app-text'
                : i + 1 < position
                  ? 'w-1.5 bg-app-text/60'
                  : 'w-1.5 bg-app-border',
            )}
          />
        ))}
      </div>
      <span className="text-app-lg text-app-text-muted">
        {position}/{total} · {t(STEP_TITLE_KEY[step])}
      </span>
    </div>
  );
};

/** 貼り方ガイド（常時表示・スプレッドシート手順）。 */
const HowToPasteGuide: React.FC = () => {
  const { t } = useTranslation();
  const steps = ['howto_step1', 'howto_step2', 'howto_step3', 'howto_step4'] as const;
  return (
    <div className="rounded-xl border border-app-border bg-app-text/5 p-3 space-y-2">
      <p className="text-app-lg font-bold text-app-text">{t('sheetImport.howto_title')}</p>
      <ol className="flex flex-col gap-1.5">
        {steps.map((k, i) => (
          <li key={k} className="flex items-center gap-2 text-app-2xl text-app-text">
            <span className="shrink-0 w-5 h-5 rounded-full bg-app-text/10 text-app-text text-app-lg font-bold flex items-center justify-center">
              {i + 1}
            </span>
            {t(`sheetImport.${k}`)}
          </li>
        ))}
      </ol>
      <p className="text-app-lg text-app-text-muted/70">{t('sheetImport.howto_mac_note')}</p>
    </div>
  );
};

function resetState() {
  return {
    includeMitigations: true as boolean,
    draft: '' as string,
    phaseName: '' as string,
    entries: [] as ImportSheet[],
    parseError: false as boolean,
  };
}

export const SpreadsheetImportModal: React.FC<Props> = ({ isOpen, onClose, onImport, defaultSelection }) => {
  useEscapeClose(isOpen, onClose);
  const { t, i18n } = useTranslation();

  const [includeMitigations, setIncludeMitigations] = useState(true);
  const [draft, setDraft] = useState('');
  const [phaseName, setPhaseName] = useState('');
  const [entries, setEntries] = useState<ImportSheet[]>([]);
  const [parseError, setParseError] = useState(false);
  const [assignment, setAssignment] = useState<PartyAssignment>(emptyAssignment());

  const [selLevel, setSelLevel] = useState<ContentLevel | null>(null);
  const [selCategory, setSelCategory] = useState<ContentCategory | null>(null);
  const [selBoss, setSelBoss] = useState<ContentDefinition | null>(null);
  const [selTitle, setSelTitle] = useState('');

  const [step, setStep] = useState<WizardStep>(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    const s = resetState();
    setIncludeMitigations(s.includeMitigations);
    setDraft(s.draft);
    setPhaseName(s.phaseName);
    setEntries(s.entries);
    setParseError(s.parseError);
    setAssignment(emptyAssignment());
    setSelLevel(null);
    setSelCategory(null);
    setSelBoss(null);
    setSelTitle('');
    setStep(1);
    onClose();
  }, [onClose]);

  const handleAddPhase = useCallback(() => {
    const result = parseMitigationSheet(draft);
    if (!result) {
      setParseError(true);
      return;
    }
    setParseError(false);
    setEntries((prev) => [...prev, { parsed: result, phaseName: resolvePhaseName(phaseName, prev.length) }]);
    setDraft('');
    setPhaseName('');
  }, [draft, phaseName]);

  const jobs = useMemo(() => getJobsFromStore(), []);
  const roleOf = useCallback(
    (id: string) => jobs.find((j) => j.id === id)?.role as SlotRole | undefined,
    [jobs],
  );
  const detectedJobIds = useMemo(
    () => (includeMitigations ? detectUsedJobIds(entries.map((e) => e.parsed)) : []),
    [entries, includeMitigations],
  );
  const detectedByRole = useMemo(() => groupByRole(detectedJobIds, roleOf), [detectedJobIds, roleOf]);
  const jobName = useCallback(
    (id: string) => {
      const name = jobs.find((j) => j.id === id)?.name;
      if (!name) return id;
      return (name[i18n.language as keyof typeof name] ?? name.ja) || id;
    },
    [jobs, i18n.language],
  );

  useEffect(() => {
    setAssignment(emptyAssignment());
  }, [detectedJobIds]);

  // 初期選択の復元は「モーダルを開いた瞬間だけ」行う。
  // defaultSelection は Timeline の useMemo 由来で、開いている最中でも
  // 自動保存/同期(saveSilently・pullFromFirestore)が updatePlan→plans 配列を
  // 再生成すると currentPlan 参照が変わり新しい object になる。これを dep に置くと
  // ユーザーが選び直したコンテンツが操作中に初期値へ巻き戻る（再選択バグ）。
  // よって dep は [isOpen] のみとし、最新値は ref 経由で開いた瞬間に読む。
  const defaultSelectionRef = useRef(defaultSelection);
  defaultSelectionRef.current = defaultSelection;
  useEffect(() => {
    if (!isOpen) return;
    const init = resolveInitialSelection(defaultSelectionRef.current);
    setSelLevel(init.level);
    setSelCategory(init.category);
    setSelBoss(init.boss);
    setSelTitle(init.title);
    setStep(1);
  }, [isOpen]);

  const handleSlotChange = useCallback(
    (slot: PartySlot, jobId: string | null) => {
      setAssignment((prev) => autoFillSingles(assignSlot(prev, slot, jobId), detectedByRole));
    },
    [detectedByRole],
  );

  // preview は entries / includeMitigations のみに依存。draft 入力の再レンダーで
  // 重い buildPlanFromSheets を再計算しないよう memo 化（大きな貼り付け対策）。
  const preview = useMemo<SheetImportResult | null>(
    () =>
      entries.length > 0
        ? buildPlanFromSheets(
            entries,
            { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() },
            { includeMitigations },
          )
        : null,
    [entries, includeMitigations],
  );

  // 各フェーズチップの「軽減N件」は実際の配置数（連続TRUEを1回に畳んだ後）を出す。
  // 生の TRUE セル数だと「効果時間中ずっと TRUE」仕様で実配置数より大きく出て誤解を招くため。
  const perSheetMits = useMemo<number[]>(
    () =>
      includeMitigations
        ? entries.map(
            (e) =>
              buildPlanFromSheets(
                [e],
                { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() },
                { includeMitigations: true },
              ).timelineMitigations.length,
          )
        : entries.map(() => 0),
    [entries, includeMitigations],
  );

  const lang = i18n.language === 'en' ? 'en' : 'ja';
  const selectedContentId = deriveContentId(selBoss, selCategory, selTitle);

  const partyComplete = !includeMitigations || isAssignmentComplete(assignment, detectedByRole);
  const hasPendingDraft = draft.trim() !== '';
  const blockReason = importBlockReason({
    hasPreviewEvents: preview !== null && preview.timelineEvents.length > 0,
    partyComplete,
    hasPendingDraft,
  });
  const canConfirm = blockReason === null;

  // ── ウィザード遷移 ──
  const hasPartyStep = wizardHasPartyStep(includeMitigations, detectedJobIds.length);
  const canAdvance = wizardCanAdvance(step, {
    entriesCount: entries.length,
    hasPendingDraft,
    partyComplete,
  });
  const goNext = useCallback(() => {
    setStep((s) => wizardNextStep(s, wizardHasPartyStep(includeMitigations, detectedJobIds.length)));
  }, [includeMitigations, detectedJobIds.length]);
  const goBack = useCallback(() => {
    setStep((s) => wizardPrevStep(s, wizardHasPartyStep(includeMitigations, detectedJobIds.length)));
  }, [includeMitigations, detectedJobIds.length]);

  // Step3 が消えるレース対策（party無しなのに step3 → 4 へクランプ）。
  useEffect(() => {
    setStep((s) => wizardClampStep(s, hasPartyStep));
  }, [hasPartyStep]);

  // ステップ移動時は本文先頭へスクロール（happy-dom 等 scrollTo 未実装環境を考慮し optional call）。
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 });
  }, [step]);

  const nextLabelKey =
    step === 1
      ? 'sheetImport.next_to_paste'
      : step === 2
        ? hasPartyStep
          ? 'sheetImport.next_to_party'
          : 'sheetImport.next_to_confirm'
        : 'sheetImport.next_to_confirm';

  const handleConfirm = useCallback(async () => {
    if (entries.length === 0) return;
    const partyOverride = includeMitigations ? buildPartyOverride(assignment) : undefined;
    const result = buildPlanFromSheets(
      entries,
      { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() },
      { includeMitigations, partyOverride },
    );
    // 取込先テンプレが在れば攻撃の対象(MT/ST)を補完(無ければ素通り)
    const finalResult = await applyTemplateTargetsToResult(result, selectedContentId);
    const committed = await onImport(finalResult, { contentId: selectedContentId });
    if (committed) handleClose();
  }, [entries, includeMitigations, assignment, onImport, handleClose, selectedContentId]);

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

          {/* Progress */}
          <WizardProgress step={step} hasPartyStep={hasPartyStep} />

          {/* Scrollable Content（step 出し分け） */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="p-5 space-y-5"
              >
                {/* ── Step 1: 設定（取込先 + モード） ── */}
                {step === 1 && (
                  <>
                    {/* 取り込み先コンテンツ選択（ImportContentSelector に抽出済み） */}
                    <ImportContentSelector
                      selLevel={selLevel}
                      setSelLevel={setSelLevel}
                      selCategory={selCategory}
                      setSelCategory={setSelCategory}
                      selBoss={selBoss}
                      setSelBoss={setSelBoss}
                      selTitle={selTitle}
                      setSelTitle={setSelTitle}
                      lang={lang}
                    />

                    {/* Mode */}
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
                  </>
                )}

                {/* ── Step 2: フェーズを貼り付け（ループ） ── */}
                {step === 2 && (
                  <>
                    <HowToPasteGuide />

                    <div className="space-y-2">
                      <label className="text-app-lg text-app-text-muted block">
                        {t('sheetImport.phase_name_label')}
                      </label>
                      <input
                        type="text"
                        value={phaseName}
                        onChange={(e) => setPhaseName(e.target.value)}
                        placeholder={t('sheetImport.phase_name_placeholder')}
                        className="w-full bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text focus:outline-none focus:border-app-text placeholder:text-app-text-muted"
                        spellCheck={false}
                      />
                      <label className="text-app-lg text-app-text-muted block pt-1">
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
                    {entries.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-app-lg text-app-text-muted">{t('sheetImport.added_phases_label')}</p>
                        {entries.map((entry, i) => {
                          const phaseNameDisp = entry.phaseName || `Phase ${i + 1}`;
                          const events = entry.parsed.rows.length;
                          const mits = perSheetMits[i] ?? 0;
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-app-text/5 border border-app-border text-app-2xl text-app-text"
                            >
                              <CheckCircle2 size={14} className="shrink-0 text-app-text-muted" />
                              <span>{t('sheetImport.detected_phase', { name: phaseNameDisp, events, mits })}</span>
                            </div>
                          );
                        })}
                        <p className="text-app-lg text-app-text-muted/80 pt-1">
                          {t('sheetImport.add_more_or_next')}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* ── Step 3: パーティ割当（条件付き） ── */}
                {step === 3 && (
                  <div className="space-y-2">
                    <p className="text-app-lg text-app-text-muted uppercase tracking-wider">
                      {t('sheetImport.party_assign_label')}
                    </p>
                    <p className="text-app-lg text-app-text-muted/80">
                      {t('sheetImport.party_assign_hint')}
                    </p>
                    <div className="space-y-2">
                      {(['tank', 'healer', 'dps'] as SlotRole[])
                        .filter((role) => detectedByRole[role].length > 0)
                        .map((role) => (
                          <div
                            key={role}
                            className="grid grid-cols-[4rem_1fr] items-start gap-2"
                          >
                            <span className="text-app-lg text-app-text-muted pt-2">
                              {t(`sheetImport.party_role_${role}`)}
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {SLOTS_BY_ROLE[role].map((slot) => {
                                const required = isSlotRequired(assignment, slot, detectedByRole);
                                return (
                                  <div
                                    key={slot}
                                    className={clsx(
                                      'flex flex-col gap-1 p-2 rounded-lg border transition-all duration-200',
                                      required
                                        ? 'border-app-red-border bg-app-red-dim'
                                        : assignment[slot]
                                          ? 'border-app-text bg-app-text/5'
                                          : 'border-app-border',
                                    )}
                                  >
                                    <span
                                      className={clsx(
                                        'text-app-lg font-mono',
                                        required ? 'text-app-red' : 'text-app-text-muted',
                                      )}
                                    >
                                      {slot}
                                    </span>
                                    <div className="relative">
                                      <select
                                        value={assignment[slot] ?? ''}
                                        onChange={(e) => handleSlotChange(slot, e.target.value || null)}
                                        className="w-full appearance-none bg-app-surface2 border border-app-border rounded-md pl-2 pr-6 py-1 text-app-2xl text-app-text focus:outline-none focus:border-app-text cursor-pointer"
                                      >
                                        <option value="">{t('sheetImport.party_slot_unassigned')}</option>
                                        {detectedByRole[role].map((jid) => (
                                          <option key={jid} value={jid}>
                                            {jobName(jid)}
                                          </option>
                                        ))}
                                      </select>
                                      <ChevronDown
                                        size={14}
                                        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-app-text-muted"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                    {!partyComplete && (
                      <p className="text-app-lg text-app-red">{t('sheetImport.party_incomplete')}</p>
                    )}
                  </div>
                )}

                {/* ── Step 4: 確認して作成 ── */}
                {step === 4 && (
                  <>
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
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer（戻る/次へ/作成） */}
          <div className="px-5 py-4 border-t border-app-border bg-app-surface2 flex flex-col gap-3 shrink-0">
            {step === 2 && hasPendingDraft && (
              <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-3 rounded-lg border border-app-amber-border text-app-2xl">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{t('sheetImport.pending_draft_warning')}</p>
              </div>
            )}
            {step === 3 && !partyComplete && (
              <div className="flex items-start gap-2 text-app-red bg-app-red-dim p-3 rounded-lg border border-app-red-border text-app-2xl">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{t('sheetImport.party_required_warning')}</p>
              </div>
            )}
            {step === 4 && blockReason === 'pending_draft' && (
              <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-3 rounded-lg border border-app-amber-border text-app-2xl">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{t('sheetImport.pending_draft_warning')}</p>
              </div>
            )}
            {step === 4 && blockReason === 'party_incomplete' && (
              <div className="flex items-start gap-2 text-app-red bg-app-red-dim p-3 rounded-lg border border-app-red-border text-app-2xl">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{t('sheetImport.party_required_warning')}</p>
              </div>
            )}

            <div className="flex justify-between gap-3">
              {/* 左: Step1=キャンセル / それ以外=戻る */}
              {step === 1 ? (
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-app-2xl font-bold text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-95"
                >
                  {t('common.cancel')}
                </button>
              ) : (
                <button
                  onClick={goBack}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-app-2xl font-bold text-app-text border border-app-border hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-95"
                >
                  <ArrowLeft size={16} />
                  {t('sheetImport.wizard_back')}
                </button>
              )}

              {/* 右: Step1-3=次へ / Step4=作成 */}
              {step < 4 ? (
                <button
                  onClick={goNext}
                  disabled={!canAdvance}
                  className={clsx(
                    'flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold transition-all duration-300',
                    canAdvance
                      ? 'bg-app-toggle text-app-toggle-text hover:opacity-80 cursor-pointer active:scale-95'
                      : 'bg-app-surface2 text-app-text-muted cursor-not-allowed',
                  )}
                >
                  {t(nextLabelKey)}
                  <ArrowRight size={16} />
                </button>
              ) : (
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
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
