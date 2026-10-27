import React, { useCallback, useMemo, useEffect } from 'react';
import type { Job } from '../../types';
import type { ParsedSheet, ImportSheet } from '../../lib/sheetImport/types';
import type { GridTable } from '../../lib/sheetImport/gridTypes';
import { detectUsedJobIds } from '../../lib/sheetImport/detectUsedJobIds';
import { assignSlot, groupByRole, autoFillSingles, seedAssignment, type PartyAssignment, type PartySlot, type SlotRole } from '../../lib/sheetImport/partyAssignment';
import type { ImportSource } from './gridImportModel';

export function useGridImportParty(args: {
  jobs: Job[];
  source: ImportSource;
  table: GridTable;
  setTable: React.Dispatch<React.SetStateAction<GridTable>>;
  entries: ImportSheet[];
  matrixParsed: ParsedSheet | null;
  setAssignment: React.Dispatch<React.SetStateAction<PartyAssignment>>;
}) {
  const { jobs, source, table, setTable, entries, matrixParsed, setAssignment } = args;

  // 役割解決(store 由来)
  const roleOf = useCallback(
    (id: string) => jobs.find((j) => j.id === id)?.role as SlotRole | undefined,
    [jobs],
  );

  // スマホ用: member 列の枠(slot)を更新(PC の GridView 内 setColSlot と同等・PC は不変)
  const setMobileColumnSlot = useCallback((ci: number, slot: PartySlot | null) => {
    setTable((prev) => ({
      ...prev,
      columns: prev.columns.map((c, i) => (i === ci ? { ...c, slot } : c)),
    }));
  }, []);

  // スマホ grid 割当リスト対象: jobId 付き member 列(プレイヤー)
  const mobileMemberColumns = useMemo(
    () =>
      source !== 'grid'
        ? []
        : table.columns
            .map((col, ci) => ({ col, ci, role: col.jobId ? roleOf(col.jobId) : undefined }))
            .filter((x) => x.col.field === 'member' && !!x.col.jobId),
    [source, table.columns, roleOf],
  );

  // 蓄積した全フェーズ + 未追加の現在の貼り付け(matrix)で使われたジョブ(検出順)。
  // 未追加 draft も含めることで partyComplete ゲートが draft のジョブを覆い、
  // 枠未割当のまま作成 → 軽減サイレント消失を防ぐ(空 partyOverride 落とし穴の封鎖)。
  const detectedJobIds = useMemo(
    () => detectUsedJobIds([
      ...entries.map((e) => e.parsed),
      ...(source === 'matrix' && matrixParsed ? [matrixParsed] : []),
    ]),
    [entries, source, matrixParsed],
  );
  const detectedByRole = useMemo(() => groupByRole(detectedJobIds, roleOf), [detectedJobIds, roleOf]);

  // 検出ジョブが変わるたびに割当を再シード。手動済み枠は保持し、空き枠を resolveImportParty 既定で埋める。
  useEffect(() => {
    setAssignment((prev) => seedAssignment(prev, detectedJobIds, jobs));
  }, [detectedJobIds, jobs]);

  const handleSlotChange = useCallback(
    (slot: PartySlot, jobId: string | null) => {
      setAssignment((prev) => autoFillSingles(assignSlot(prev, slot, jobId), detectedByRole));
    },
    [detectedByRole],
  );

  return { setMobileColumnSlot, mobileMemberColumns, detectedByRole, handleSlotChange };
}
