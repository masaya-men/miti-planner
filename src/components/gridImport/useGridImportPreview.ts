import { useCallback, useMemo } from 'react';
import { getMitigationsFromStore } from '../../hooks/useSkillsData';
import type { Job, TimelineEvent } from '../../types';
import { type SheetImportResult, buildPlanFromSheets } from '../../lib/sheetImport/buildPlanFromSheets';
import type { ParsedSheet, ImportSheet, SkippedSkill } from '../../lib/sheetImport/types';
import type { GridTable } from '../../lib/sheetImport/gridTypes';
import { buildPlanFromGrid } from '../../lib/sheetImport/buildPlanFromGrid';
import { buildPartyOverride, isAssignmentComplete, type PartyAssignment, type SlotRole } from '../../lib/sheetImport/partyAssignment';
import { importBlockReason } from '../../lib/sheetImport/importBlockReason';
import { applyResolvedTargets } from '../../lib/sheetImport/resolveEventTargets';
import type { CarryTarget } from '../../lib/sheetImport/carryOverTargets';
import type { ImportSource, WizardStep } from './gridImportModel';
import type { TFunction } from 'i18next';

export function useGridImportPreview(args: {
  t: TFunction;
  step: WizardStep;
  jobs: Job[];
  mitigations: ReturnType<typeof getMitigationsFromStore>;
  source: ImportSource;
  table: GridTable;
  entries: ImportSheet[];
  matrixParsed: ParsedSheet | null;
  phaseName: string;
  assignment: PartyAssignment;
  detectedByRole: Record<SlotRole, string[]>;
  onImport: (result: SheetImportResult, opts: { contentId: string | null }) => Promise<boolean>;
  onClose: () => void;
  selectedContentId: string | null;
  templateEvents: TimelineEvent[];
  toOverridesById: (events: TimelineEvent[]) => Record<string, CarryTarget | 'none'>;
}) {
  const { t, step, jobs, mitigations, source, table, entries, matrixParsed, phaseName, assignment, detectedByRole, onImport, onClose, selectedContentId, templateEvents, toOverridesById } = args;

  // ── プレビュー(create に使う result) ──────────────────────────────────────
  // matrix: 蓄積した entries 全体を partyOverride 付きで build(複数フェーズを1プランに統合)。
  //         まだ未追加の現在の貼り付けはプレビューに含めない(追加してから反映=実証ウィザード踏襲)。
  // grid:   現在のテーブルから buildPlanFromGrid(自作は単一ブロック)。
  const isGrid = source === 'grid';
  const partyOverride = useMemo(() => buildPartyOverride(assignment), [assignment]);
  const matrixPreview = useMemo<SheetImportResult | null>(
    () =>
      entries.length > 0
        ? buildPlanFromSheets(entries, { mitigations, jobs }, { includeMitigations: true, partyOverride })
        : null,
    [entries, mitigations, jobs, partyOverride],
  );
  const gridPreview = useMemo<SheetImportResult | null>(
    () => (isGrid ? buildPlanFromGrid(table, { mitigations, jobs }, { includeMitigations: true }) : null),
    [isGrid, table, mitigations, jobs],
  );
  const preview = isGrid ? gridPreview : matrixPreview;

  /**
   * GridView の previewEvents: 表示中テーブルに対応する events を返す。
   * - grid: gridPreview の events (表示テーブルと同一ソース)。
   * - matrix draft あり: 現在の draft を単体でビルドした events (表示テーブルと time/name.ja が一致)。
   *   create には使わない。表示用専用。
   * - それ以外: 空配列。
   */
  const displayedPreviewEvents = useMemo<TimelineEvent[]>(() => {
    if (isGrid) return gridPreview?.timelineEvents ?? [];
    if (source === 'matrix' && matrixParsed) {
      return buildPlanFromSheets(
        [{ parsed: matrixParsed, phaseName }],
        { mitigations, jobs },
        { includeMitigations: true },
      ).timelineEvents;
    }
    return [];
  }, [isGrid, gridPreview, source, matrixParsed, phaseName, mitigations, jobs]);

  // スマホ確認サマリーの「検出イベント数」。grid=表示テーブル, matrix=現在の貼付ドラフトの events。
  const mobileEventCount = source === 'none' ? 0 : displayedPreviewEvents.length;

  // 追加済みフェーズの「軽減N件」表示用(各フェーズ単体の実配置数)
  const perPhaseMits = useMemo<number[]>(
    () =>
      entries.map(
        (e) =>
          buildPlanFromSheets([e], { mitigations, jobs }, { includeMitigations: true }).timelineMitigations.length,
      ),
    [entries, mitigations, jobs],
  );

  // 読み取れなかった軽減(全フェーズ統合の skipped)
  const skipped: SkippedSkill[] = preview?.skipped ?? [];

  // ── 確定ブロック判定(実証ウィザードの importBlockReason を再利用) ──────────
  // matrix: パーティ完成は isAssignmentComplete。未追加の貼り付けがあれば pending 扱い。
  // grid:   パーティはセル由来。jobId 付き member 列でスキルありかつ枠未割当があれば不完全。
  const partyComplete = useMemo(() => {
    if (isGrid) {
      const memberCols = table.columns.filter((c) => c.field === 'member');
      if (memberCols.length === 0) return true;
      return memberCols.every((col) => {
        if (!col.jobId) return true; // jobId なし member 列はブロック対象外
        const colIdx = table.columns.indexOf(col);
        const cells = table.rows.map((r) => r[colIdx] ?? '').filter((v) => v.trim() !== '');
        if (cells.length === 0) return true; // スキルなし列は無視
        return col.slot != null;
      });
    }
    // matrix: 検出ジョブが全て枠に座っているか
    return isAssignmentComplete(assignment, detectedByRole);
  }, [isGrid, table, assignment, detectedByRole]);

  // 未追加の matrix 貼り付けが残っているか(作成時に自動取込するためブロック理由にはしない=§9.7 D)。
  const hasPendingMatrixDraft = source === 'matrix' && matrixParsed !== null;

  // 「作成できる」プレビューがあるか: 追加済み entries のイベント or 未追加の matrix draft(自動取込される)。
  const hasPreviewEvents =
    (preview?.timelineEvents.length ?? 0) > 0 ||
    (hasPendingMatrixDraft && (matrixParsed?.rows.length ?? 0) > 0);

  const blockReason = importBlockReason({ hasPreviewEvents, partyComplete });
  const canConfirm = blockReason === null;

  const handleConfirm = useCallback(async () => {
    // 未追加の matrix 貼り付けが残っていれば自動で取り込んでから作成(袋小路撤去=§9.7 D)。
    let effectiveEntries = entries;
    if (source === 'matrix' && matrixParsed) {
      effectiveEntries = [...entries, { parsed: matrixParsed, phaseName }];
    }
    const finalPreview = isGrid
      ? gridPreview
      : (effectiveEntries.length > 0
          ? buildPlanFromSheets(effectiveEntries, { mitigations, jobs }, { includeMitigations: true, partyOverride })
          : null);
    if (!finalPreview || finalPreview.timelineEvents.length === 0) return;
    // 対象適用: 手動 > 自作列 > テンプレ > なし の優先順で実効値を確定。
    const overridesById = toOverridesById(finalPreview.timelineEvents);
    const withTargets: SheetImportResult = {
      ...finalPreview,
      timelineEvents: applyResolvedTargets(finalPreview.timelineEvents, templateEvents, overridesById),
    };
    const ok = await onImport(withTargets, { contentId: selectedContentId });
    if (ok) onClose();
  }, [entries, source, matrixParsed, phaseName, isGrid, gridPreview, mitigations, jobs, partyOverride, onImport, onClose, selectedContentId, templateEvents, toOverridesById]);

  // スロット未割当警告(grid のみ): jobId のある member 列で、スキルありかつ枠未割当
  const hasUnassignedMemberCols = useMemo(() => {
    if (!isGrid) return false;
    return table.columns.some((c, ci) => {
      if (c.field !== 'member') return false;
      if (!c.jobId) return false;
      const cells = table.rows.map((r) => r[ci] ?? '').filter((v) => v.trim() !== '');
      return cells.length > 0 && !c.slot;
    });
  }, [isGrid, table]);

  // 時間列欠落警告(grid のみ): 貼り付け済みで time 列が無い
  const hasNoTimeCol = isGrid && !table.columns.some((c) => c.field === 'time');

  // グリッド本体に表示中のデータが無い(=空状態)か
  const isGridEmpty = source === 'none' && table.rows.length === 0;

  // 作成ブロック表示面: grid=step2 / matrix=step3。
  const showCreateBlock = (step === 2 && isGrid) || step === 3;
  const blockMsg: { text: string; tone: 'red' | 'amber' } | null =
    !showCreateBlock
      ? null
      : hasNoTimeCol
        ? { text: t('gridImport.no_time_warning'), tone: 'amber' }
        : blockReason === 'party_incomplete'
          ? hasUnassignedMemberCols
            ? { text: t('gridImport.slot_unassigned_warning'), tone: 'amber' }
            : { text: t('gridImport.party_incomplete_warning'), tone: 'red' }
          : blockReason === 'no_phases' && source !== 'none'
            ? { text: t('gridImport.no_phases_warning'), tone: 'amber' }
            : null;

  return { isGrid, preview, displayedPreviewEvents, mobileEventCount, perPhaseMits, skipped, canConfirm, handleConfirm, isGridEmpty, showCreateBlock, blockMsg };
}
