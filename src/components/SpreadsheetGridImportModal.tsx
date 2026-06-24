import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { getJobsFromStore, getMitigationsFromStore } from '../hooks/useSkillsData';
import type { Job } from '../types';
import type { SheetImportResult } from '../lib/sheetImport/buildPlanFromSheets';
import type { GridTable, GridField, GridColumn } from '../lib/sheetImport/gridTypes';
import { buildPlanFromGrid } from '../lib/sheetImport/buildPlanFromGrid';
import { validateGridColumn } from '../lib/sheetImport/validateGridColumn';
import { applyTemplateTargetsToResult } from '../lib/sheetImport/applyTemplateTargets';
import { parseGridPaste, isMatrixSheetFormat } from '../lib/sheetImport/parseGridPaste';
import {
  SLOTS_BY_ROLE,
  type PartySlot, type SlotRole,
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

/** 固定の正典列(member は検出後に動的追加)。 */
const BASE_FIELDS: GridField[] = ['phase', 'label', 'time', 'action', 'damage', 'target', 'damageType'];

/**
 * 「この列は？」セレクタに表示する割当可能フィールド。モジュールレベルで定義してレンダーごとの再生成を避ける。
 * member は jobId なしで手動設定すると確定ブロックの永久デッドエンドになるため除外。
 * unknown も選択肢に含めない（解除先がないため意味なし）。
 */
const ASSIGNABLE_FIELDS: GridField[] = ['phase', 'label', 'time', 'action', 'damage', 'target', 'damageType', 'ignore'];

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

export const SpreadsheetGridImportModal: React.FC<Props> = ({ isOpen, onClose, onImport, defaultSelection }) => {
  useEscapeClose(isOpen, onClose);
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ja';
  const jobs = useMemo(() => getJobsFromStore(), []);
  const mitigations = useMemo(() => getMitigationsFromStore(), []);

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

  // グリッドテーブル状態
  const [table, setTable] = useState<GridTable>({
    columns: BASE_FIELDS.map((f) => ({ field: f, header: t(`gridImport.col_${f}`) })),
    rows: [],
  });

  // 貼り付けdraft
  const [draft, setDraft] = useState('');
  const [famousWarn, setFamousWarn] = useState(false);

  // 列ごとに貼り付けモード
  const [byColumnMode, setByColumnMode] = useState(false);

  // まるごと貼り付けハンドラ
  const onPasteWhole = useCallback(() => {
    if (!draft.trim()) return;
    if (isMatrixSheetFormat(draft)) {
      setFamousWarn(true);
      return;
    }
    setFamousWarn(false);
    const parsed = parseGridPaste(draft, jobs);
    setTable(autoAssignSingleSlots(parsed, jobs));
    setDraft('');
  }, [draft, jobs]);

  // 列ごと貼り付けハンドラ: 指定列に改行区切りのテキストを流し込む
  const onColumnPaste = useCallback((colIndex: number, text: string) => {
    const rawLines = text.split(/\r?\n/);
    // 末尾の空行を除去
    let end = rawLines.length;
    while (end > 0 && rawLines[end - 1].trim() === '') end--;
    const values = rawLines.slice(0, end);
    setTable((prev) => setColumnValues(prev, colIndex, values));
  }, []);

  // プレビュー
  const preview = useMemo<SheetImportResult | null>(
    () => (table.rows.length ? buildPlanFromGrid(table, { mitigations, jobs }, { includeMitigations: true }) : null),
    [table, mitigations, jobs],
  );

  // 確定ブロック判定
  // partyComplete = jobId のあるメンバー列のうちスキルが存在するものが全て枠割当済み
  // jobId なしの member 列（手動操作等で発生し得る）は判定対象外にしてデッドエンドを防ぐ
  const partyComplete = useMemo(() => {
    const memberCols = table.columns.filter((c) => c.field === 'member');
    if (memberCols.length === 0) return true;
    return memberCols.every((col) => {
      // jobId がない member 列はスロット選択 UI が出ないため、ブロック対象から除外
      if (!col.jobId) return true;
      const colIdx = table.columns.indexOf(col);
      const cells = table.rows.map((r) => r[colIdx] ?? '').filter((v) => v.trim() !== '');
      if (cells.length === 0) return true; // スキルなし列は無視
      return col.slot != null;
    });
  }, [table]);

  const hasPendingDraft = draft.trim() !== '';

  const blockReason = importBlockReason({
    hasPreviewEvents: preview !== null && preview.timelineEvents.length > 0,
    partyComplete,
    hasPendingDraft,
  });
  const canConfirm = blockReason === null;

  const handleConfirm = useCallback(async () => {
    if (!canConfirm || !preview) return;
    const finalResult = await applyTemplateTargetsToResult(preview, selectedContentId);
    const ok = await onImport(finalResult, { contentId: selectedContentId });
    if (ok) onClose();
  }, [canConfirm, preview, onImport, onClose, selectedContentId]);

  // スロット未割当警告チェック: jobId のある member 列のみ対象（jobId なしはスロット UI が出ないため除外）
  const hasUnassignedMemberCols = useMemo(() => {
    return table.columns.some((c, ci) => {
      if (c.field !== 'member') return false;
      if (!c.jobId) return false; // jobId なし列はスロット割当不可なので警告しない
      const cells = table.rows.map((r) => r[ci] ?? '').filter((v) => v.trim() !== '');
      return cells.length > 0 && !c.slot;
    });
  }, [table]);

  // no_phases バナーはデータが貼り付けられているのにイベント行が0の時のみ表示
  // (初期状態の空グリッドでは表示しない)
  const showNoPhasesWarning = blockReason === 'no_phases' && table.rows.length > 0;

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
          {/* コンテンツ選択 */}
          <div className="px-5 py-3 border-b border-app-border bg-app-surface2 shrink-0">
            <ImportContentSelector
              selLevel={selLevel} setSelLevel={setSelLevel}
              selCategory={selCategory} setSelCategory={setSelCategory}
              selBoss={selBoss} setSelBoss={setSelBoss}
              selTitle={selTitle} setSelTitle={setSelTitle}
              lang={lang}
            />
          </div>
          {/* 貼り付けバー */}
          <div className="px-5 py-3 border-b border-app-border bg-app-surface2 flex flex-col gap-2 shrink-0">
            <div className="flex gap-3 items-start flex-wrap">
              <textarea
                className="flex-1 min-w-[240px] h-20 rounded-lg border border-app-border bg-app-surface2 text-app-text text-app-lg px-3 py-2 resize-none focus:outline-none focus:border-app-text"
                placeholder={t('gridImport.paste_placeholder')}
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setFamousWarn(false); }}
              />
              <div className="flex flex-col gap-2">
                {/* まるごと貼り付けボタン: クリックで解析・取り込み実行 */}
                <button
                  className="px-4 py-2 rounded-lg text-app-2xl font-bold bg-app-toggle text-app-toggle-text"
                  onClick={onPasteWhole}
                >
                  {t('gridImport.paste_whole')}
                </button>
                {/* 列ごとに貼り付けボタン: クリックでモード切替 */}
                <button
                  className={clsx('px-4 py-2 rounded-lg text-app-2xl font-bold',
                    byColumnMode ? 'bg-app-toggle text-app-toggle-text' : 'border border-app-border text-app-text')}
                  onClick={() => setByColumnMode((v) => !v)}
                >
                  {t('gridImport.paste_by_column')}
                </button>
              </div>
            </div>
            {famousWarn && (
              <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-2 rounded-lg border border-app-amber-border text-app-2xl">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>{t('gridImport.famous_sheet_warning')}</p>
              </div>
            )}
            <p className="text-app-lg text-app-text-muted">{t('gridImport.help')}</p>
          </div>
          {/* グリッド */}
          <div className="flex-1 overflow-auto">
            <GridView table={table} setTable={setTable} deps={{ mitigations, jobs }} byColumnMode={byColumnMode} onColumnPaste={onColumnPaste} />
          </div>
          {/* フッター */}
          <div className="px-5 py-4 border-t border-app-border bg-app-surface2 flex flex-col gap-2 shrink-0">
            {hasUnassignedMemberCols && (
              <div className="flex items-center gap-2 text-app-amber text-app-2xl">
                <AlertCircle size={14} className="shrink-0" />
                <span>{t('gridImport.slot_unassigned_warning')}</span>
              </div>
            )}
            {blockReason === 'pending_draft' && (
              <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-2 rounded-lg border border-app-amber-border text-app-2xl">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>{t('gridImport.pending_draft_warning')}</p>
              </div>
            )}
            {blockReason === 'party_incomplete' && (
              <div className="flex items-start gap-2 text-app-red bg-app-red-dim p-2 rounded-lg border border-app-red-border text-app-2xl">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>{t('gridImport.party_incomplete_warning')}</p>
              </div>
            )}
            {showNoPhasesWarning && (
              <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-2 rounded-lg border border-app-amber-border text-app-2xl">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>{t('gridImport.no_phases_warning')}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
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
  byColumnMode: boolean;
  onColumnPaste: (colIndex: number, text: string) => void;
}> = ({ table, setTable, deps, byColumnMode, onColumnPaste }) => {
  const { t } = useTranslation();
  const cellsOf = (ci: number) => table.rows.map((r) => r[ci] ?? '');

  // 列の field を変更
  const setColField = (ci: number, field: GridField) => {
    const cols = table.columns.map((c, i) =>
      i !== ci ? c : field === 'ignore' ? { field: 'ignore' as GridField, header: c.header } : { ...c, field }
    );
    setTable({ ...table, columns: cols });
  };

  // member 列の枠を変更
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
                  {/* 列ごと貼り付けモード: 各列に textarea。
                      key にテーブル形状を含めることで、まるごと貼り付け後やリセット後に
                      古いテキストが残らないよう React に再マウントさせる。 */}
                  {byColumnMode && (
                    <textarea
                      key={`col-paste-${ci}-${table.rows.length}-${table.columns.length}`}
                      className="mt-1 w-full h-16 rounded border border-app-border bg-app-surface2 text-app-text text-app-sm px-1 py-0.5 resize-none focus:outline-none focus:border-app-text"
                      placeholder={t('gridImport.col_paste_placeholder')}
                      onChange={(e) => onColumnPaste(ci, e.target.value)}
                    />
                  )}
                  {/* 「この列は？」セレクタ (unknown 列) */}
                  {c.field === 'unknown' && (
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
                  {/* 枠セレクタ (member 列) */}
                  {c.field === 'member' && role && (
                    <select
                      className="mt-1 w-full appearance-none bg-app-surface2 border border-app-border rounded px-1 py-0.5 text-app-sm text-app-text focus:outline-none"
                      value={c.slot ?? ''}
                      onChange={(e) => {
                        const val = e.target.value as PartySlot | '';
                        setColSlot(ci, val || null);
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
