import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { getJobsFromStore, getMitigationsFromStore } from '../hooks/useSkillsData';
import type { SheetImportResult } from '../lib/sheetImport/buildPlanFromSheets';
import type { GridTable, GridField } from '../lib/sheetImport/gridTypes';
import { buildPlanFromGrid } from '../lib/sheetImport/buildPlanFromGrid';
import { validateGridColumn } from '../lib/sheetImport/validateGridColumn';
import { applyTemplateTargetsToResult } from '../lib/sheetImport/applyTemplateTargets';
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

export const SpreadsheetGridImportModal: React.FC<Props> = ({ isOpen, onClose, onImport, defaultSelection }) => {
  useEscapeClose(isOpen, onClose);
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ja';
  const jobs = useMemo(() => getJobsFromStore(), []);
  const mitigations = useMemo(() => getMitigationsFromStore(), []);

  // 取り込み先コンテンツ選択(既存モーダルと同じ ImportContentSelector・必須)
  const [selLevel, setSelLevel] = useState<ContentLevel | null>(null);
  const [selCategory, setSelCategory] = useState<ContentCategory | null>(null);
  const [selBoss, setSelBoss] = useState<ContentDefinition | null>(null);
  const [selTitle, setSelTitle] = useState('');
  // 開いた瞬間だけ初期選択を復元(既存モーダルと同作法・dep は [isOpen] のみ)
  const defaultSelRef = useRef(defaultSelection);
  defaultSelRef.current = defaultSelection;
  useEffect(() => {
    if (!isOpen) return;
    const init = resolveInitialSelection(defaultSelRef.current);
    setSelLevel(init.level); setSelCategory(init.category); setSelBoss(init.boss); setSelTitle(init.title);
  }, [isOpen]);
  const selectedContentId = deriveContentId(selBoss, selCategory, selTitle);

  const [table, setTable] = useState<GridTable>({
    columns: BASE_FIELDS.map((f) => ({ field: f, header: t(`gridImport.col_${f}`) })),
    rows: [],
  });

  const preview = useMemo<SheetImportResult | null>(
    () => (table.rows.length ? buildPlanFromGrid(table, { mitigations, jobs }, { includeMitigations: true }) : null),
    [table, mitigations, jobs],
  );

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    // 既存モーダルと同じ実証済み手順: テンプレ対象引き継ぎ → onImport(=handleSheetImport→commitImportedPlan)
    const finalResult = await applyTemplateTargetsToResult(preview, selectedContentId);
    const ok = await onImport(finalResult, { contentId: selectedContentId });
    if (ok) onClose();
  }, [preview, onImport, onClose, selectedContentId]);

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
          {/* コンテンツ選択（既存と同じ実証済み部品・必須） */}
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
          <div className="px-5 py-3 border-b border-app-border bg-app-surface2 flex flex-col gap-1 shrink-0">
            <div className="flex gap-3 items-start flex-wrap">
              <button className="px-4 py-2 rounded-lg text-app-2xl font-bold bg-app-toggle text-app-toggle-text">{t('gridImport.paste_whole')}</button>
              <button className="px-4 py-2 rounded-lg text-app-2xl font-bold border border-app-border text-app-text">{t('gridImport.paste_by_column')}</button>
            </div>
            <p className="text-app-lg text-app-text-muted">{t('gridImport.help')}</p>
          </div>
          {/* グリッド */}
          <div className="flex-1 overflow-auto">
            <GridView table={table} setTable={setTable} deps={{ mitigations, jobs }} />
          </div>
          {/* フッター */}
          <div className="px-5 py-4 border-t border-app-border bg-app-surface2 flex items-center justify-between shrink-0">
            <span className="text-app-2xl text-app-text-muted">
              {preview && t('gridImport.summary', { labels: preview.labels.length, events: preview.timelineEvents.length, mits: preview.timelineMitigations.length })}
            </span>
            <button onClick={handleConfirm} disabled={!preview}
              className={clsx('flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold',
                preview ? 'bg-app-toggle text-app-toggle-text' : 'bg-app-surface2 text-app-text-muted')}>
              <CheckCircle2 size={16} /> {t('gridImport.create')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
  return createPortal(node, document.body);
};

/** グリッド本体: 列ヘッダー(チップ)+ 行データ。最小実装。 */
const GridView: React.FC<{
  table: GridTable; setTable: (t: GridTable) => void;
  deps: { mitigations: ReturnType<typeof getMitigationsFromStore>; jobs: ReturnType<typeof getJobsFromStore> };
}> = ({ table, deps }) => {
  const { t } = useTranslation();
  const cellsOf = (ci: number) => table.rows.map((r) => r[ci] ?? '');
  return (
    <table className="w-full text-app-lg border-separate" style={{ borderSpacing: 0 }}>
      <thead>
        <tr>
          {table.columns.map((c, ci) => {
            const st = validateGridColumn(c, cellsOf(ci), deps);
            return (
              <th key={ci} className="sticky top-0 bg-app-surface2 border-b border-r border-app-border px-3 py-2 text-left">
                <div className="flex flex-col gap-1 min-w-[90px]">
                  <span className="font-bold">{c.field === 'member' ? c.header : t(`gridImport.col_${c.field}`)}</span>
                  <StatusChip status={st} />
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
  // app-blue / app-blue-dim / app-blue-border は src/index.css で定義済み
  const map = {
    ok: 'text-app-blue bg-app-blue-dim border-app-blue-border',
    partial: 'text-app-amber bg-app-amber-dim border-app-amber-border',
    empty: 'text-app-text-muted bg-app-text/5 border-app-border',
  } as const;
  const label = status === 'ok' ? t('gridImport.status_ok') : status === 'partial' ? t('gridImport.status_partial') : t('gridImport.status_empty');
  return <span className={clsx('text-app-sm font-bold rounded-full px-2 py-0.5 border w-max', map[status])}>{label}</span>;
};
