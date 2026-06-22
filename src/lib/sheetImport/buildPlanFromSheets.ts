import type { ParsedSheet, SkippedSkill, ImportSheet } from './types';
import type { Mitigation, Job, TimelineEvent, AppliedMitigation, Phase, Label } from '../../types';
import { resolveSheetSkill } from './resolveSheetSkill';
import { resolveImportParty } from './resolveImportParty';
import { detectUsedJobIds } from './detectUsedJobIds';
import { JOB_JA_TO_ID } from './skillAliases';

export interface SheetImportResult {
  timelineEvents: TimelineEvent[];
  timelineMitigations: AppliedMitigation[];
  phases: Phase[];
  labels: Label[];
  party: { slot: string; jobId: string }[];
  skipped: SkippedSkill[];
}

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function buildPlanFromSheets(
  sheets: ImportSheet[],
  deps: { mitigations: Mitigation[]; jobs: Job[] },
  options: { includeMitigations: boolean; partyOverride?: { slot: string; jobId: string }[] },
): SheetImportResult {
  const parsedSheets: ParsedSheet[] = sheets.map((s) => s.parsed);

  // 全シートの行を Total Time 昇順マージ。列はシート固有なので行に紐付けて持つ。
  const merged = parsedSheets.flatMap((s) => s.rows.map((row) => ({ row, columns: s.columns })));
  merged.sort((a, b) => a.row.totalTimeSec - b.row.totalTimeSec);
  const maxTime = merged.length ? merged[merged.length - 1].row.totalTimeSec : 0;

  const timelineEvents: TimelineEvent[] = merged.map(({ row }) => ({
    id: uid('ev'),
    time: row.totalTimeSec,
    name: { ja: row.action, en: row.action },
    damageType: row.damageType ?? 'magical',
    ...(row.damageAmount != null ? { damageAmount: row.damageAmount } : {}),
  }));

  // phases = ユーザー入力名（1 ImportSheet = 1 フェーズ）。startTime=そのシート最小時刻、
  // endTime=次フェーズ開始（末尾は maxTime+1）。startTime 昇順に確定。
  const phases: Phase[] = sheets
    .map((s) => {
      const times = s.parsed.rows.map((r) => r.totalTimeSec);
      const start = times.length ? Math.min(...times) : 0;
      return { id: uid('ph'), name: { ja: s.phaseName, en: s.phaseName }, startTime: start, endTime: start };
    })
    .sort((a, b) => a.startTime - b.startTime);
  for (let i = 0; i < phases.length - 1; i++) phases[i].endTime = phases[i + 1].startTime;
  if (phases.length) phases[phases.length - 1].endTime = maxTime + 1;

  // labels = スプシ Phase 列。シート内で連続する同 phaseLabel 行を 1 ラベルに。
  // 空 phaseLabel はラベルを作らない。隣接同名は統合（境界割れの保険）。
  const rawLabels: Label[] = [];
  for (const s of parsedSheets) {
    const rows = [...s.rows].sort((a, b) => a.totalTimeSec - b.totalTimeSec);
    let curLabel: string | null = null;
    for (const row of rows) {
      if (!row.phaseLabel) continue;
      if (row.phaseLabel !== curLabel) {
        curLabel = row.phaseLabel;
        rawLabels.push({
          id: uid('lb'),
          name: { ja: row.phaseLabel, en: row.phaseLabel },
          startTime: row.totalTimeSec,
          endTime: row.totalTimeSec,
        });
      }
    }
  }
  rawLabels.sort((a, b) => a.startTime - b.startTime);
  const labels: Label[] = [];
  for (const lb of rawLabels) {
    const last = labels[labels.length - 1];
    if (last && last.name.ja === lb.name.ja) continue;
    labels.push(lb);
  }
  for (let i = 0; i < labels.length - 1; i++) labels[i].endTime = labels[i + 1].startTime;
  if (labels.length) labels[labels.length - 1].endTime = maxTime + 1;

  if (!options.includeMitigations) {
    return { timelineEvents, timelineMitigations: [], phases, labels, party: [], skipped: [] };
  }

  // 使用ジョブ検出 → パーティ。override があればそれを優先（全空スタートのユーザー割当）。
  const usedJobIds = detectUsedJobIds(parsedSheets);
  const party = options.partyOverride ?? resolveImportParty(usedJobIds, deps.jobs);
  const slotByJobId = new Map(party.map((p) => [p.jobId, p.slot] as const));

  // スプシ「効果時間中ずっと TRUE」→ rising-edge（非TRUE→TRUE の立ち上がりだけ新規使用）。
  const timelineMitigations: AppliedMitigation[] = [];
  const skippedSet = new Map<string, SkippedSkill>();
  for (const sheet of parsedSheets) {
    const rowsInOrder = [...sheet.rows].sort((a, b) => a.totalTimeSec - b.totalTimeSec);
    for (const col of sheet.columns) {
      const mitId = resolveSheetSkill(col.job, col.skillNameRaw, deps.mitigations);
      const mit = mitId ? deps.mitigations.find((m) => m.id === mitId) : undefined;
      const duration = mit?.duration ?? 0;
      const jobId = JOB_JA_TO_ID[col.job];
      const ownerId = jobId ? slotByJobId.get(jobId) : undefined;
      let hadTrue = false;
      let inRun = false;
      for (const row of rowsInOrder) {
        const isTrue = row.trueColumnIndexes.includes(col.index);
        if (!isTrue) {
          inRun = false;
          continue;
        }
        hadTrue = true;
        if (!inRun) {
          inRun = true;
          if (mitId && ownerId) {
            timelineMitigations.push({ id: uid('mit'), mitigationId: mitId, time: row.totalTimeSec, duration, ownerId });
          }
        }
      }
      if (hadTrue && !mitId) {
        skippedSet.set(`${col.job}/${col.skillNameRaw}`, { job: col.job, skillName: col.skillNameRaw });
      }
    }
  }

  // 同一 (mitigationId, ownerId, time) は重複排除。
  const seen = new Set<string>();
  const dedupedMitigations: AppliedMitigation[] = [];
  for (const m of timelineMitigations) {
    const key = `${m.mitigationId}@${m.ownerId}@${m.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedMitigations.push(m);
  }
  dedupedMitigations.sort((a, b) => a.time - b.time);

  return { timelineEvents, timelineMitigations: dedupedMitigations, phases, labels, party, skipped: [...skippedSet.values()] };
}
