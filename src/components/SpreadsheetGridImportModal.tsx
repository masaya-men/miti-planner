import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, ClipboardPaste } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { getJobsFromStore, getMitigationsFromStore } from '../hooks/useSkillsData';
import type { Job } from '../types';
import type { SheetImportResult } from '../lib/sheetImport/buildPlanFromSheets';
import { buildPlanFromSheets } from '../lib/sheetImport/buildPlanFromSheets';
import type { ParsedSheet } from '../lib/sheetImport/types';
import type { GridTable, GridField, GridColumn } from '../lib/sheetImport/gridTypes';
import { buildPlanFromGrid } from '../lib/sheetImport/buildPlanFromGrid';
import { gridRowsFromResult } from '../lib/sheetImport/gridRowsFromResult';
import { validateGridColumn } from '../lib/sheetImport/validateGridColumn';
import { applyTemplateTargetsToResult } from '../lib/sheetImport/applyTemplateTargets';
import { parseGridPaste, isMatrixSheetFormat } from '../lib/sheetImport/parseGridPaste';
import { parseMitigationSheet } from '../lib/sheetImport/parseMitigationSheet';
import {
  SLOTS_BY_ROLE, emptyAssignment, assignSlot, buildPartyOverride,
  type PartyAssignment, type PartySlot, type SlotRole,
} from '../lib/sheetImport/partyAssignment';
import { importBlockReason } from '../lib/sheetImport/importBlockReason';
import { ImportContentSelector } from './ImportContentSelector';
import { resolveInitialSelection, deriveContentId } from '../lib/contentSelection';
import type { ContentSelectionDefault } from '../lib/contentSelection';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: SheetImportResult, opts: { contentId: string | null }) => Promise<boolean>;
  defaultSelection: ContentSelectionDefault;
}

/** 貼り付け内容の取込ソース。grid=自作(編集可) / matrix=行列形式(実証パーサ・読み取り表示)。 */
type ImportSource = 'none' | 'grid' | 'matrix';

/** ウィザードのステップ。1=コンテンツ選択 / 2=スプシ風グリッド。 */
type WizardStep = 1 | 2;

/** 固定の正典列(member は検出後に動的追加)。 */
const BASE_FIELDS: GridField[] = ['phase', 'label', 'time', 'action', 'damage', 'target', 'damageType'];

/**
 * 「この列は？」セレクタに表示する割当可能フィールド。モジュールレベルで定義してレンダーごとの再生成を避ける。
 * member は jobId なしで手動設定すると確定ブロックの永久デッドエンドになるため除外。
 * unknown も選択肢に含めない（解除先がないため意味なし）。
 */
const ASSIGNABLE_FIELDS: GridField[] = ['phase', 'label', 'time', 'action', 'damage', 'target', 'damageType', 'ignore'];

/** 見出しだけの空グリッド(コンテンツ選択直後の初期表示用)。t は呼び出し側で渡す。 */
function emptyHeaderTable(t: (k: string) => string): GridTable {
  return {
    columns: BASE_FIELDS.map((f) => ({ field: f, header: t(`gridImport.col_${f}`) })),
    rows: [],
  };
}

/**
 * 指定列インデックスに values を書き込んだ新しい GridTable を返す純粋関数。
 * - 既存行より values が多い場合は行を追加し、他列を '' で埋める。
 * - 既存行の方が多い場合は values の末尾を '' として扱う。
 * - rows は常に columns 長さに揃える。
 */
export function setColumnValues(table: GridTable, colIndex: number, values: string[]): GridTable {
  const numCols = table.columns.length;
  const targetRows = Math.max(table.rows.length, values.length);
  const newRows: string[][] = [];
  for (let r = 0; r < targetRows; r++) {
    const existing = table.rows[r] ?? [];
    const row: string[] = [];
    for (let c = 0; c < numCols; c++) {
      if (c === colIndex) {
        row.push(values[r] ?? '');
      } else {
        row.push(existing[c] ?? '');
      }
    }
    newRows.push(row);
  }
  return { ...table, rows: newRows };
}

/**
 * member 列を対象に、ロール内にメンバー列が1本だけかつ空き枠があれば先頭枠を自動割当。
 * autoFillSingles の GridTable 版。
 */
export function autoAssignSingleSlots(table: GridTable, jobs: Job[]): GridTable {
  // role → 割当済みスロット を先に集計
  const usedSlots = new Set<PartySlot>();
  for (const col of table.columns) {
    if (col.field === 'member' && col.slot) usedSlots.add(col.slot);
  }

  // role → 未割当のメンバー列インデックス一覧
  const byRole: Record<SlotRole, number[]> = { tank: [], healer: [], dps: [] };
  table.columns.forEach((col, i) => {
    if (col.field !== 'member' || col.slot) return;
    const job = jobs.find((j) => j.id === col.jobId);
    if (!job) return;
    const role = job.role as SlotRole;
    if (role in byRole) byRole[role].push(i);
  });

  const updatedCols: GridColumn[] = [...table.columns];
  const localUsed = new Set<PartySlot>(usedSlots);

  for (const role of (['tank', 'healer', 'dps'] as SlotRole[])) {
    const indices = byRole[role];
    if (indices.length !== 1) continue; // ロール内が1本だけの時のみ自動割当
    const freeSlots = SLOTS_BY_ROLE[role].filter((s) => !localUsed.has(s));
    if (freeSlots.length === 0) continue;
    const slot = freeSlots[0];
    updatedCols[indices[0]] = { ...updatedCols[indices[0]], slot };
    localUsed.add(slot);
  }

  return { ...table, columns: updatedCols };
}

/**
 * result.party を PartyAssignment に変換する。matrix 経路で枠を編集する際の起点。
 * 不正な slot 名(PartySlot 以外)は無視する。
 */
function assignmentFromParty(party: { slot: string; jobId: string }[]): PartyAssignment {
  let a = emptyAssignment();
  for (const p of party) {
    if ((SLOTS_BY_ROLE.tank as string[]).includes(p.slot)
      || (SLOTS_BY_ROLE.healer as string[]).includes(p.slot)
      || (SLOTS_BY_ROLE.dps as string[]).includes(p.slot)) {
      a = assignSlot(a, p.slot as PartySlot, p.jobId);
    }
  }
  return a;
}

export const SpreadsheetGridImportModal: React.FC<Props> = ({ isOpen, onClose, onImport, defaultSelection }) => {
  useEscapeClose(isOpen, onClose);
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ja';
  // gridRowsFromResult には 4 言語を正確に渡す（ImportContentSelector 向けの 2 値 lang とは別）
  const gridLang = (['ja', 'en', 'ko', 'zh'] as const).includes(i18n.language as 'ja' | 'en' | 'ko' | 'zh')
    ? (i18n.language as 'ja' | 'en' | 'ko' | 'zh')
    : 'ja';
  const jobs = useMemo(() => getJobsFromStore(), []);
  const mitigations = useMemo(() => getMitigationsFromStore(), []);

  // ── ウィザードステップ(1=コンテンツ選択 / 2=グリッド) ──
  const [step, setStep] = useState<WizardStep>(1);

  // 取り込み先コンテンツ選択
  const [selLevel, setSelLevel] = useState<ContentLevel | null>(null);
  const [selCategory, setSelCategory] = useState<ContentCategory | null>(null);
  const [selBoss, setSelBoss] = useState<ContentDefinition | null>(null);
  const [selTitle, setSelTitle] = useState('');
  const defaultSelRef = useRef(defaultSelection);
  defaultSelRef.current = defaultSelection;
  useEffect(() => {
    if (!isOpen) return;
    const init = resolveInitialSelection(defaultSelRef.current);
    setSelLevel(init.level); setSelCategory(init.category); setSelBoss(init.boss); setSelTitle(init.title);
  }, [isOpen]);
  const selectedContentId = deriveContentId(selBoss, selCategory, selTitle);

  // グリッドテーブル状態(自作=編集可テーブル / matrix=result から導いた表示用テーブル)
  const [table, setTable] = useState<GridTable>(() => emptyHeaderTable(t));

  // 取込ソース。none=未貼付 / grid=自作編集テーブル / matrix=行列形式 result
  const [source, setSource] = useState<ImportSource>('none');

  // matrix 経路: 実証パーサの parsed と build 結果を保持し、枠変更で再構築する。
  const [matrixParsed, setMatrixParsed] = useState<ParsedSheet | null>(null);
  const [matrixResult, setMatrixResult] = useState<SheetImportResult | null>(null);

  // 形式は読めたが内容を解釈できなかった時の汎用エラー(特定スプシ名を出さない中立文言)
  const [parseFailed, setParseFailed] = useState(false);

  // 列ごとに貼り付けモード(自作テーブルのみ有効)
  const [byColumnMode, setByColumnMode] = useState(false);

  // グリッド貼り付けサーフェス(Ctrl+V を捕捉する focusable コンテナ)
  const pasteSurfaceRef = useRef<HTMLDivElement>(null);

  // モーダルを開くたびに step1・見出しだけの空グリッドへリセット
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setTable(emptyHeaderTable(t));
    setSource('none');
    setMatrixParsed(null);
    setMatrixResult(null);
    setParseFailed(false);
    setByColumnMode(false);
    // t はレンダーごとに同一性が変わり得るが、見出し文言は安定。開いた瞬間の値で構築すれば十分。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 取り込み本処理: 貼り付けテキスト(またはクリップボードテキスト)を形式判定して配置する。
  // textarea onChange ではなく、グリッド本体への paste で発火する。
  const ingestText = useCallback((text: string) => {
    setParseFailed(false);

    // 空 → 見出しだけの空グリッドへ戻す
    if (!text.trim()) {
      setTable(emptyHeaderTable(t));
      setSource('none');
      setMatrixParsed(null);
      setMatrixResult(null);
      return;
    }

    // TRUE/FALSE 行列形式 → 実証パーサ→実証ビルダーで読み、結果を表示用テーブルへ変換(読み取り専用)
    if (isMatrixSheetFormat(text)) {
      const parsed = parseMitigationSheet(text);
      if (!parsed) {
        // 行列形式だが内容が解釈不能 → 汎用エラー(別経路への誘導はしない)
        setParseFailed(true);
        setSource('none');
        setMatrixParsed(null);
        setMatrixResult(null);
        setTable(emptyHeaderTable(t));
        return;
      }
      const result = buildPlanFromSheets(
        [{ parsed, phaseName: '' }],
        { mitigations, jobs },
        { includeMitigations: true },
      );
      setMatrixParsed(parsed);
      setMatrixResult(result);
      setSource('matrix');
      setTable(gridRowsFromResult(result, { mitigations, jobs }, gridLang));
      return;
    }

    // 見出し形式(自作) → 編集可グリッド
    const grid = parseGridPaste(text, jobs);
    setTable(autoAssignSingleSlots(grid, jobs));
    setSource('grid');
    setMatrixParsed(null);
    setMatrixResult(null);
  }, [t, mitigations, jobs, gridLang]);

  // グリッド本体への貼り付けハンドラ。clipboardData からテキストを読み、規定動作は止める。
  const handleGridPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    ingestText(text);
  }, [ingestText]);

  // step2 へ入ったら貼り付けサーフェスへフォーカスし Ctrl+V を確実に捕捉する
  useEffect(() => {
    if (step !== 2) return;
    // レイアウト確定後にフォーカス(happy-dom でも focus() は no-op で安全)
    pasteSurfaceRef.current?.focus?.();
  }, [step]);

  // 列ごと貼り付けハンドラ: 指定列に改行区切りのテキストを流し込む(自作テーブルのみ)
  const onColumnPaste = useCallback((colIndex: number, text: string) => {
    const rawLines = text.split(/\r?\n/);
    // 末尾の空行を除去
    let end = rawLines.length;
    while (end > 0 && rawLines[end - 1].trim() === '') end--;
    const values = rawLines.slice(0, end);
    setSource('grid');
    setTable((prev) => setColumnValues(prev, colIndex, values));
  }, []);

  // matrix 経路: メンバー列の枠を変更 → party を再割当 → 同 parsed から result を再構築
  const onMatrixSlotChange = useCallback((jobId: string, slot: PartySlot | null) => {
    if (!matrixParsed || !matrixResult) return;
    let assignment = assignmentFromParty(matrixResult.party);
    if (slot === null) {
      // 枠を外す: jobId が現在座っている枠を空にする
      const cur = matrixResult.party.find((p) => p.jobId === jobId);
      if (cur) assignment = assignSlot(assignment, cur.slot as PartySlot, null);
    } else {
      // 枠を割り当て(assignSlot が同ジョブの旧枠を自動で外す)
      assignment = assignSlot(assignment, slot, jobId);
    }
    const partyOverride = buildPartyOverride(assignment);
    const rebuilt = buildPlanFromSheets(
      [{ parsed: matrixParsed, phaseName: '' }],
      { mitigations, jobs },
      { includeMitigations: true, partyOverride },
    );
    setMatrixResult(rebuilt);
    setTable(gridRowsFromResult(rebuilt, { mitigations, jobs }, gridLang));
  }, [matrixParsed, matrixResult, mitigations, jobs, gridLang]);

  // プレビュー(create に使う result)。matrix=実証 result をそのまま / grid=テーブルから再構築。
  const preview = useMemo<SheetImportResult | null>(() => {
    if (source === 'matrix') return matrixResult;
    if (source === 'grid') return buildPlanFromGrid(table, { mitigations, jobs }, { includeMitigations: true });
    return null;
  }, [source, matrixResult, table, mitigations, jobs]);

  // 確定ブロック判定
  // grid: jobId のあるメンバー列のうちスキルが存在するものが全て枠割当済みなら true
  //       jobId なしの member 列はスロット選択 UI が出ないため判定対象外(デッドエンド防止)
  // matrix: party は常に割当済みなので true
  const partyComplete = useMemo(() => {
    if (source !== 'grid') return true;
    const memberCols = table.columns.filter((c) => c.field === 'member');
    if (memberCols.length === 0) return true;
    return memberCols.every((col) => {
      if (!col.jobId) return true; // jobId なし member 列はブロック対象外
      const colIdx = table.columns.indexOf(col);
      const cells = table.rows.map((r) => r[colIdx] ?? '').filter((v) => v.trim() !== '');
      if (cells.length === 0) return true; // スキルなし列は無視
      return col.slot != null;
    });
  }, [source, table]);

  const blockReason = importBlockReason({
    hasPreviewEvents: preview !== null && preview.timelineEvents.length > 0,
    partyComplete,
    hasPendingDraft: false,
  });
  const canConfirm = blockReason === null;

  const handleConfirm = useCallback(async () => {
    if (!canConfirm || !preview) return;
    const finalResult = await applyTemplateTargetsToResult(preview, selectedContentId);
    const ok = await onImport(finalResult, { contentId: selectedContentId });
    if (ok) onClose();
  }, [canConfirm, preview, onImport, onClose, selectedContentId]);

  // スロット未割当警告チェック(grid のみ): jobId のある member 列で、スキルありかつ枠未割当
  const hasUnassignedMemberCols = useMemo(() => {
    if (source !== 'grid') return false;
    return table.columns.some((c, ci) => {
      if (c.field !== 'member') return false;
      if (!c.jobId) return false; // jobId なし列はスロット割当不可なので警告しない
      const cells = table.rows.map((r) => r[ci] ?? '').filter((v) => v.trim() !== '');
      return cells.length > 0 && !c.slot;
    });
  }, [source, table]);

  // no_phases バナーはデータが貼り付けられているのにイベント行が0の時のみ表示
  // (初期状態の空グリッドでは表示しない)
  const showNoPhasesWarning = blockReason === 'no_phases' && source !== 'none';

  // グリッド本体に表示中のデータが無い(=空状態)か
  const isGridEmpty = source === 'none' && table.rows.length === 0;

  if (!isOpen) return null;

  const node = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3" onClick={onClose}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
          className="relative z-[201] w-[96vw] max-w-[1280px] h-[88vh] glass-tier3 rounded-2xl overflow-hidden flex flex-col"
          style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
          onClick={(e) => e.stopPropagation()}>
          {/* ヘッダー */}
          <div className="px-5 py-4 border-b border-app-border bg-app-surface2 flex items-center justify-between shrink-0">
            <h2 className="text-app-3xl font-bold text-app-text flex items-center gap-2">
              <FileSpreadsheet size={18} /> {t('gridImport.title')}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-app-text hover:bg-app-toggle hover:text-app-toggle-text"><X size={18} /></button>
          </div>

          {/* 進捗(2ステップ) */}
          <div className="px-5 py-2.5 border-b border-app-border bg-app-surface2 flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              {[1, 2].map((i) => (
                <span
                  key={i}
                  className={clsx('h-1.5 rounded-full transition-all duration-200',
                    i === step ? 'w-5 bg-app-text' : i < step ? 'w-1.5 bg-app-text/60' : 'w-1.5 bg-app-border')}
                />
              ))}
            </div>
            <span className="text-app-lg text-app-text-muted">
              {step}/2 · {t(step === 1 ? 'gridImport.step_content' : 'gridImport.step_grid')}
            </span>
          </div>

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

          {/* ── Step 2: スプシ風グリッド(本体が貼り付けサーフェス) ── */}
          {step === 2 && (
            <>
              {/* 列ごと貼り付け fallback トグル */}
              <div className="px-5 py-2.5 border-b border-app-border bg-app-surface2 flex items-center justify-between gap-3 shrink-0">
                <p className="text-app-lg text-app-text-muted">
                  {source === 'none' ? '' : t('gridImport.help')}
                </p>
                <button
                  className={clsx('px-3 py-1.5 rounded-lg text-app-lg font-bold shrink-0',
                    byColumnMode ? 'bg-app-toggle text-app-toggle-text' : 'border border-app-border text-app-text')}
                  onClick={() => setByColumnMode((v) => !v)}
                >
                  {t('gridImport.paste_by_column')}
                </button>
              </div>

              {parseFailed && (
                <div className="px-5 py-2 shrink-0">
                  <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-2 rounded-lg border border-app-amber-border text-app-2xl">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <p>{t('gridImport.parse_failed')}</p>
                  </div>
                </div>
              )}

              {/* グリッド本体 = 貼り付けサーフェス(tabIndex で focusable・onPaste で Ctrl+V 捕捉) */}
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
                  onMatrixSlotChange={onMatrixSlotChange}
                />
                {/* 空状態: グリッド本体エリアに大きく貼り付けプロンプトを出す */}
                {isGridEmpty && (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 px-5 text-center select-none">
                    <ClipboardPaste size={36} className="text-app-text-muted" />
                    <p className="text-app-3xl font-bold text-app-text">{t('gridImport.paste_prompt')}</p>
                    <p className="text-app-lg text-app-text-muted">{t('gridImport.paste_hint')}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* フッター */}
          <div className="px-5 py-4 border-t border-app-border bg-app-surface2 flex flex-col gap-2 shrink-0">
            {step === 2 && hasUnassignedMemberCols && (
              <div className="flex items-center gap-2 text-app-amber text-app-2xl">
                <AlertCircle size={14} className="shrink-0" />
                <span>{t('gridImport.slot_unassigned_warning')}</span>
              </div>
            )}
            {step === 2 && blockReason === 'party_incomplete' && (
              <div className="flex items-start gap-2 text-app-red bg-app-red-dim p-2 rounded-lg border border-app-red-border text-app-2xl">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>{t('gridImport.party_incomplete_warning')}</p>
              </div>
            )}
            {step === 2 && showNoPhasesWarning && (
              <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-2 rounded-lg border border-app-amber-border text-app-2xl">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>{t('gridImport.no_phases_warning')}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              {/* 左: Step1=キャンセル / Step2=戻る */}
              {step === 1 ? (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-app-2xl font-bold text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200"
                >
                  {t('common.cancel')}
                </button>
              ) : (
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-app-2xl font-bold text-app-text border border-app-border hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200"
                >
                  <ArrowLeft size={16} /> {t('gridImport.back')}
                </button>
              )}

              {/* 右: Step1=次へ(常に有効) / Step2=summary + 作成 */}
              {step === 1 ? (
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold bg-app-toggle text-app-toggle-text hover:opacity-80 transition-all duration-200"
                >
                  {t('gridImport.next')} <ArrowRight size={16} />
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-app-2xl text-app-text-muted">
                    {preview && t('gridImport.summary', { labels: preview.labels.length, events: preview.timelineEvents.length, mits: preview.timelineMitigations.length })}
                  </span>
                  <button
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    className={clsx('flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold',
                      canConfirm ? 'bg-app-toggle text-app-toggle-text' : 'bg-app-surface2 text-app-text-muted cursor-not-allowed')}
                  >
                    <CheckCircle2 size={16} /> {t('gridImport.create')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
  return createPortal(node, document.body);
};

/** グリッド本体: 列ヘッダー(チップ)+ 行データ。 */
const GridView: React.FC<{
  table: GridTable; setTable: (t: GridTable) => void;
  deps: { mitigations: ReturnType<typeof getMitigationsFromStore>; jobs: ReturnType<typeof getJobsFromStore> };
  source: ImportSource;
  byColumnMode: boolean;
  onColumnPaste: (colIndex: number, text: string) => void;
  onMatrixSlotChange: (jobId: string, slot: PartySlot | null) => void;
}> = ({ table, setTable, deps, source, byColumnMode, onColumnPaste, onMatrixSlotChange }) => {
  const { t } = useTranslation();
  const cellsOf = (ci: number) => table.rows.map((r) => r[ci] ?? '');

  // 列の field を変更
  const setColField = (ci: number, field: GridField) => {
    const cols = table.columns.map((c, i) =>
      i !== ci ? c : field === 'ignore' ? { field: 'ignore' as GridField, header: c.header } : { ...c, field }
    );
    setTable({ ...table, columns: cols });
  };

  // member 列の枠を変更(自作テーブル)
  const setColSlot = (ci: number, slot: PartySlot | null) => {
    const cols = table.columns.map((c, i) => i !== ci ? c : { ...c, slot });
    setTable({ ...table, columns: cols });
  };

  return (
    <table className="w-full text-app-lg border-separate" style={{ borderSpacing: 0 }}>
      <thead>
        <tr>
          {table.columns.map((c, ci) => {
            const st = validateGridColumn(c, cellsOf(ci), deps);
            const job = c.field === 'member' ? deps.jobs.find((j) => j.id === c.jobId) : undefined;
            const role = job ? (job.role as 'tank' | 'healer' | 'dps') : undefined;
            return (
              <th key={ci} className="sticky top-0 bg-app-surface2 border-b border-r border-app-border px-3 py-2 text-left">
                <div className="flex flex-col gap-1 min-w-[90px]">
                  <span className="font-bold">
                    {c.field === 'member' ? c.header : c.field === 'unknown' ? (c.header || t('gridImport.col_unknown')) : t(`gridImport.col_${c.field}`)}
                  </span>
                  <StatusChip status={st} />
                  {/* 列ごと貼り付けモード: 各列に textarea(自作テーブルのみ)。
                      key にテーブル形状を含めることで、貼り付け後やリセット後に
                      古いテキストが残らないよう React に再マウントさせる。 */}
                  {byColumnMode && (
                    <textarea
                      key={`col-paste-${ci}-${table.rows.length}-${table.columns.length}`}
                      className="mt-1 w-full h-16 rounded border border-app-border bg-app-surface2 text-app-text text-app-sm px-1 py-0.5 resize-none focus:outline-none focus:border-app-text"
                      placeholder={t('gridImport.col_paste_placeholder')}
                      onChange={(e) => onColumnPaste(ci, e.target.value)}
                    />
                  )}
                  {/* 「この列は？」セレクタ (unknown 列・自作テーブルのみ) */}
                  {c.field === 'unknown' && source !== 'matrix' && (
                    <select
                      className="mt-1 w-full appearance-none bg-app-surface2 border border-app-border rounded px-1 py-0.5 text-app-sm text-app-text focus:outline-none"
                      value=""
                      onChange={(e) => {
                        const val = e.target.value as GridField;
                        if (val) setColField(ci, val);
                      }}
                    >
                      <option value="">{t('gridImport.this_column')}</option>
                      {ASSIGNABLE_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {f === 'ignore' ? t('gridImport.ignore_column') : t(`gridImport.col_${f}`)}
                        </option>
                      ))}
                    </select>
                  )}
                  {/* 枠セレクタ (member 列)。自作=テーブル更新 / matrix=result 再構築。 */}
                  {c.field === 'member' && role && (
                    <select
                      className="mt-1 w-full appearance-none bg-app-surface2 border border-app-border rounded px-1 py-0.5 text-app-sm text-app-text focus:outline-none"
                      value={c.slot ?? ''}
                      onChange={(e) => {
                        const val = e.target.value as PartySlot | '';
                        if (source === 'matrix') {
                          onMatrixSlotChange(c.jobId as string, val || null);
                        } else {
                          setColSlot(ci, val || null);
                        }
                      }}
                    >
                      <option value="">{t('gridImport.assign_slot')}</option>
                      {SLOTS_BY_ROLE[role].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r, ri) => (
          <tr key={ri}>
            {table.columns.map((_, ci) => (
              <td key={ci} className="border-b border-r border-app-border px-3 py-1.5 text-app-text">{r[ci] ?? ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const StatusChip: React.FC<{ status: 'ok' | 'partial' | 'empty' }> = ({ status }) => {
  const { t } = useTranslation();
  const map = {
    ok: 'text-app-blue bg-app-blue-dim border-app-blue-border',
    partial: 'text-app-amber bg-app-amber-dim border-app-amber-border',
    empty: 'text-app-text-muted bg-app-text/5 border-app-border',
  } as const;
  const label = status === 'ok' ? t('gridImport.status_ok') : status === 'partial' ? t('gridImport.status_partial') : t('gridImport.status_empty');
  return <span className={clsx('text-app-sm font-bold rounded-full px-2 py-0.5 border w-max', map[status])}>{label}</span>;
};
