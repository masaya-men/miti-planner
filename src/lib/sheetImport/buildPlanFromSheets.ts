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

  // フェーズ = 各シート内で連続する同 phaseLabel 行の塊。
  // シート（フェーズタブ）の末尾と次タブの先頭は Total Time が数秒重なるため、全行を
  // 時刻マージしてから塊化すると境界でフェーズが交互化（女神→開幕→女神…のピンポン）する。
  // → シート単位で塊を作り、startTime 昇順に並べてから endTime を「次フェーズ開始」で確定する。
  const rawPhases: Phase[] = [];
  for (const sheet of sheets) {
    const rows = [...sheet.rows].sort((a, b) => a.totalTimeSec - b.totalTimeSec);
    let curLabel: string | null = null;
    for (const row of rows) {
      if (row.phaseLabel !== curLabel) {
        curLabel = row.phaseLabel;
        rawPhases.push({
          id: uid('ph'),
          name: { ja: row.phaseLabel, en: row.phaseLabel },
          startTime: row.totalTimeSec,
          endTime: row.totalTimeSec,
        });
      }
    }
  }
  rawPhases.sort((a, b) => a.startTime - b.startTime);
  // 隣接する同名フェーズは統合（境界で割れた場合の保険。非隣接の同名は別フェーズのまま残す）。
  const phases: Phase[] = [];
  for (const ph of rawPhases) {
    const last = phases[phases.length - 1];
    if (last && last.name.ja === ph.name.ja) continue;
    phases.push(ph);
  }
  const maxTime = merged.length ? merged[merged.length - 1].row.totalTimeSec : 0;
  for (let i = 0; i < phases.length - 1; i++) phases[i].endTime = phases[i + 1].startTime;
  if (phases.length) phases[phases.length - 1].endTime = maxTime + 1;

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
  // 連続する TRUE-run（間に FALSE/欠落行が無い塊）を 1 回の使用に畳む。判定は rising-edge：
  // 直前行が非TRUE で今 TRUE になった所だけ「新しい使用」とし、run 先頭の時刻に 1 配置する。
  // duration 基準（time >= 直前 + duration）だと、run の span が duration を超える技
  // （ニュートラルセクト/パッセージ等）で run 終端に幽霊配置が出ていた（実データで確認）。
  // 別々の使用はシートが必ず TRUE-run の間に FALSE/欠落行を挟むため rising-edge で正しく分離される
  // （リキャストは全 mit で最大 run span を上回り、1 run に 2 キャストは物理的に入らない＝実データで検証済み）。
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
      let inRun = false;
      for (const row of rowsInOrder) {
        const isTrue = row.trueColumnIndexes.includes(col.index);
        if (!isTrue) {
          inRun = false; // run が切れた（次の TRUE は新しい使用）
          continue;
        }
        hadTrue = true;
        if (!inRun) {
          // rising-edge：非TRUE→TRUE の立ち上がり＝新しい使用。run 先頭で 1 回だけ配置。
          inRun = true;
          if (mitId && ownerId) {
            timelineMitigations.push({
              id: uid('mit'),
              mitigationId: mitId,
              time: row.totalTimeSec,
              duration,
              ownerId,
            });
          }
        }
        // run 継続中（連続 TRUE）は同一使用＝追加配置しない
      }
      // 実際に使用（TRUE）があったのに LoPo 未対応な技だけ「入らなかった技」へ
      if (hadTrue && !mitId) {
        skippedSet.set(`${col.job}/${col.skillNameRaw}`, { job: col.job, skillName: col.skillNameRaw });
      }
    }
  }
  // 同一 (mitigationId, ownerId, time) は同一使用＝重複排除。
  // 同じ技が複数列に現れる/同時刻に複数イベントがある等で二重配置されても 1 個に。
  // （同じ枠・同じ技を同じ瞬間に2回使うことは不可能なので、この畳み込みは常に安全）
  const seen = new Set<string>();
  const dedupedMitigations: AppliedMitigation[] = [];
  for (const m of timelineMitigations) {
    const key = `${m.mitigationId}@${m.ownerId}@${m.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedMitigations.push(m);
  }
  dedupedMitigations.sort((a, b) => a.time - b.time);

  return { timelineEvents, timelineMitigations: dedupedMitigations, phases, party, skipped: [...skippedSet.values()] };
}
