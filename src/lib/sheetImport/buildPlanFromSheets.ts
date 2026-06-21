import type { ParsedSheet, SheetColumn, SkippedSkill } from './types';
import type { Mitigation, Job, TimelineEvent, AppliedMitigation, Phase } from '../../types';
import { resolveSheetSkill } from './resolveSheetSkill';
import { resolveImportParty } from './resolveImportParty';
import { JOB_JA_TO_ID } from './skillAliases';

export interface SheetImportResult {
  timelineEvents: TimelineEvent[];
  timelineMitigations: AppliedMitigation[];
  phases: Phase[];
  party: { slot: string; jobId: string }[];
  skipped: SkippedSkill[];
}

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function buildPlanFromSheets(
  sheets: ParsedSheet[],
  deps: { mitigations: Mitigation[]; jobs: Job[] },
  options: { includeMitigations: boolean },
): SheetImportResult {
  // 全シートの行を Total Time 昇順マージ。列はシート固有なので行に紐付けて持つ。
  // Array.sort は安定ソート＝同時刻イベントは元の順序を保つ。
  const merged = sheets.flatMap((s) => s.rows.map((row) => ({ row, columns: s.columns })));
  merged.sort((a, b) => a.row.totalTimeSec - b.row.totalTimeSec);

  const timelineEvents: TimelineEvent[] = merged.map(({ row }) => ({
    id: uid('ev'),
    time: row.totalTimeSec,
    name: { ja: row.action, en: row.action },
    damageType: row.damageType ?? 'magical',
    ...(row.damageAmount != null ? { damageAmount: row.damageAmount } : {}),
  }));

  // フェーズ = phaseLabel の連続塊
  const phases: Phase[] = [];
  for (const { row } of merged) {
    const last = phases[phases.length - 1];
    if (!last || last.name.ja !== row.phaseLabel) {
      if (last) last.endTime = row.totalTimeSec;
      phases.push({
        id: uid('ph'),
        name: { ja: row.phaseLabel, en: row.phaseLabel },
        startTime: row.totalTimeSec,
        endTime: row.totalTimeSec,
      });
    }
  }
  if (phases.length) phases[phases.length - 1].endTime = (merged.at(-1)?.row.totalTimeSec ?? 0) + 1;

  if (!options.includeMitigations) {
    return { timelineEvents, timelineMitigations: [], phases, party: [], skipped: [] };
  }

  // 使用ジョブ検出（TRUE が1つでもある列のジョブ・Set で dedupe・時刻順で初出を保つ）
  const usedJobJa = new Set<string>();
  for (const { row, columns } of merged) {
    for (const idx of row.trueColumnIndexes) {
      const col = columns.find((c) => c.index === idx);
      if (col) usedJobJa.add(col.job);
    }
  }
  const usedJobIds = [...usedJobJa].map((ja) => JOB_JA_TO_ID[ja]).filter(Boolean) as string[];
  const party = resolveImportParty(usedJobIds, deps.jobs);
  const slotByJobId = new Map(party.map((p) => [p.jobId, p.slot] as const));

  const timelineMitigations: AppliedMitigation[] = [];
  const skippedSet = new Map<string, SkippedSkill>();
  for (const { row, columns } of merged) {
    for (const idx of row.trueColumnIndexes) {
      const col: SheetColumn | undefined = columns.find((c) => c.index === idx);
      if (!col) continue;
      const mitId = resolveSheetSkill(col.job, col.skillNameRaw, deps.mitigations);
      if (!mitId) {
        skippedSet.set(`${col.job}/${col.skillNameRaw}`, { job: col.job, skillName: col.skillNameRaw });
        continue;
      }
      const jobId = JOB_JA_TO_ID[col.job];
      const ownerId = jobId ? slotByJobId.get(jobId) : undefined;
      if (!ownerId) continue; // ロール枠超過等で枠が無い → 配置できない
      const mit = deps.mitigations.find((m) => m.id === mitId);
      timelineMitigations.push({
        id: uid('mit'),
        mitigationId: mitId,
        time: row.totalTimeSec,
        duration: mit?.duration ?? 0,
        ownerId,
      });
    }
  }

  return { timelineEvents, timelineMitigations, phases, party, skipped: [...skippedSet.values()] };
}
