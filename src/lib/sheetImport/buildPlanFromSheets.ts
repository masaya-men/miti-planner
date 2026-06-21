import type { ParsedSheet, SkippedSkill } from './types';
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

  // スプシは「効果時間中ずっと TRUE」を入れる仕様。LoPo は 1 回の使用＋duration で表現するため、
  // 連続する TRUE を 1 回の使用に畳む。判定は duration 基準（time >= 直前使用 + duration なら再使用）。
  // 列は各シート（フェーズ）固有なので、シート単位・列単位で時刻順に評価する。
  const timelineMitigations: AppliedMitigation[] = [];
  const skippedSet = new Map<string, SkippedSkill>();
  for (const sheet of sheets) {
    const rowsInOrder = [...sheet.rows].sort((a, b) => a.totalTimeSec - b.totalTimeSec);
    for (const col of sheet.columns) {
      const mitId = resolveSheetSkill(col.job, col.skillNameRaw, deps.mitigations);
      const mit = mitId ? deps.mitigations.find((m) => m.id === mitId) : undefined;
      const duration = mit?.duration ?? 0;
      const jobId = JOB_JA_TO_ID[col.job];
      const ownerId = jobId ? slotByJobId.get(jobId) : undefined;
      let hadTrue = false;
      let lastEmitTime = -Infinity;
      for (const row of rowsInOrder) {
        if (!row.trueColumnIndexes.includes(col.index)) continue;
        hadTrue = true;
        if (!mitId || !ownerId) continue; // 未対応 or 枠なし → 配置はしない（skipped は下で集約）
        // 直前の使用が duration で切れていれば新しい使用（連続 TRUE は同一使用＝畳む）
        if (row.totalTimeSec >= lastEmitTime + duration) {
          timelineMitigations.push({
            id: uid('mit'),
            mitigationId: mitId,
            time: row.totalTimeSec,
            duration,
            ownerId,
          });
          lastEmitTime = row.totalTimeSec;
        }
      }
      // 実際に使用（TRUE）があったのに LoPo 未対応な技だけ「入らなかった技」へ
      if (hadTrue && !mitId) {
        skippedSet.set(`${col.job}/${col.skillNameRaw}`, { job: col.job, skillName: col.skillNameRaw });
      }
    }
  }
  timelineMitigations.sort((a, b) => a.time - b.time);

  return { timelineEvents, timelineMitigations, phases, party, skipped: [...skippedSet.values()] };
}
