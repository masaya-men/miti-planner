import type { Mitigation, Job, TimelineEvent, AppliedMitigation, Phase, Label } from '../../types';
import type { SheetImportResult } from './buildPlanFromSheets';
import type { GridTable, GridColumn } from './gridTypes';
import type { SkippedSkill } from './types';
import { mmssToSec } from './time';
import { resolveSheetSkill } from './resolveSheetSkill';
import { normalizeTarget, normalizeDamageType } from './normalizeFields';

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** カンマ除去の正の有限数。それ以外 null。 */
function parseDamage(raw: string): number | null {
  const n = Number((raw ?? '').replace(/,/g, ''));
  return isFinite(n) && n > 0 ? n : null;
}

/** 引き継ぎ列(phase/label)→区間。隣接同名統合・空はスキップ・末尾は maxTime+1。 */
function buildBands(
  cells: { value: string; time: number }[],
  maxTime: number,
  mk: (name: string, start: number) => Phase | Label,
): (Phase | Label)[] {
  const raw: (Phase | Label)[] = [];
  let cur: string | null = null;
  for (const c of cells) {
    if (!c.value) continue;
    if (c.value !== cur) {
      cur = c.value;
      raw.push(mk(c.value, c.time));
    }
  }
  const out: (Phase | Label)[] = [];
  for (const b of raw) {
    const last = out[out.length - 1];
    if (last && last.name.ja === b.name.ja) continue;
    out.push(b);
  }
  for (let i = 0; i < out.length - 1; i++) out[i].endTime = out[i + 1].startTime;
  if (out.length) out[out.length - 1].endTime = maxTime + 1;
  return out;
}

export function buildPlanFromGrid(
  table: GridTable,
  deps: { mitigations: Mitigation[]; jobs: Job[] },
  options: { includeMitigations: boolean },
): SheetImportResult {
  const col = (f: GridColumn['field']) => table.columns.findIndex((c) => c.field === f);
  const iTime = col('time'), iAction = col('action'), iDamage = col('damage');
  const iTarget = col('target'), iType = col('damageType'), iPhase = col('phase'), iLabel = col('label');

  // 有効データ行(time が解釈できる行のみ)を時刻付きで抽出
  const valid = table.rows
    .map((cells) => ({ cells, t: iTime >= 0 ? mmssToSec(cells[iTime]) : null }))
    .filter((r): r is { cells: string[]; t: number } => r.t !== null)
    .sort((a, b) => a.t - b.t);
  const maxTime = valid.length ? valid[valid.length - 1].t : 0;

  const timelineEvents: TimelineEvent[] = valid.map(({ cells, t }) => {
    const dt = iType >= 0 ? normalizeDamageType(cells[iType] ?? '') : null;
    const tgt = iTarget >= 0 ? normalizeTarget(cells[iTarget] ?? '') : null;
    const dmg = iDamage >= 0 ? parseDamage(cells[iDamage] ?? '') : null;
    const action = iAction >= 0 ? (cells[iAction] ?? '').trim() : '';
    return {
      id: uid('ev'),
      time: t,
      name: { ja: action, en: action },
      damageType: dt ?? 'magical',
      ...(dmg != null ? { damageAmount: dmg } : {}),
      ...(tgt ? { target: tgt } : {}),
    };
  });

  const labels = iLabel >= 0
    ? (buildBands(valid.map((v) => ({ value: (v.cells[iLabel] ?? '').trim(), time: v.t })), maxTime,
        (name, start) => ({ id: uid('lb'), name: { ja: name, en: name }, startTime: start, endTime: start })) as Label[])
    : [];
  const phases = iPhase >= 0
    ? (buildBands(valid.map((v) => ({ value: (v.cells[iPhase] ?? '').trim(), time: v.t })), maxTime,
        (name, start) => ({ id: uid('ph'), name: { ja: name, en: name }, startTime: start, endTime: start })) as Phase[])
    : [];

  // パーティ = 枠割当されたメンバー列
  const memberCols = table.columns
    .map((c, idx) => ({ c, idx }))
    .filter(({ c }) => c.field === 'member' && c.jobId && c.slot);
  const party = memberCols.map(({ c }) => ({ slot: c.slot as string, jobId: c.jobId as string }));

  if (!options.includeMitigations) {
    return { timelineEvents, timelineMitigations: [], phases, labels, party, skipped: [] };
  }

  // member セル → 軽減(同一スキルが連続する行は立ち上がりだけ採用)
  const jobJaById = new Map(deps.jobs.map((j) => [j.id, j.name.ja] as const));
  const mits: AppliedMitigation[] = [];
  const skippedSet = new Map<string, SkippedSkill>();
  for (const { c, idx } of memberCols) {
    const jobJa = jobJaById.get(c.jobId as string) ?? '';
    let prevSkill: string | null = null;
    for (const { cells, t } of valid) {
      const raw = (cells[idx] ?? '').trim();
      if (!raw) { prevSkill = null; continue; }
      if (raw === prevSkill) continue; // 連続同名は立ち上がりのみ
      prevSkill = raw;
      const mitId = resolveSheetSkill(jobJa, raw, deps.mitigations);
      if (!mitId) { skippedSet.set(`${jobJa}/${raw}`, { job: jobJa, skillName: raw }); continue; }
      const dur = deps.mitigations.find((m) => m.id === mitId)?.duration ?? 0;
      mits.push({ id: uid('mit'), mitigationId: mitId, time: t, duration: dur, ownerId: c.slot as string });
    }
  }
  // 重複排除
  const seen = new Set<string>();
  const deduped = mits.filter((m) => {
    const k = `${m.mitigationId}@${m.ownerId}@${m.time}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => a.time - b.time);

  return { timelineEvents, timelineMitigations: deduped, phases, labels, party, skipped: [...skippedSet.values()] };
}
