import type { Job } from '../../types';
import { resolveImportParty } from './resolveImportParty';

export const PARTY_SLOTS = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'] as const;
export type PartySlot = (typeof PARTY_SLOTS)[number];
export type SlotRole = 'tank' | 'healer' | 'dps';

export const SLOT_ROLE: Record<PartySlot, SlotRole> = {
  MT: 'tank', ST: 'tank', H1: 'healer', H2: 'healer',
  D1: 'dps', D2: 'dps', D3: 'dps', D4: 'dps',
};
export const SLOTS_BY_ROLE: Record<SlotRole, PartySlot[]> = {
  tank: ['MT', 'ST'], healer: ['H1', 'H2'], dps: ['D1', 'D2', 'D3', 'D4'],
};

export type PartyAssignment = Record<PartySlot, string | null>;

export function emptyAssignment(): PartyAssignment {
  return { MT: null, ST: null, H1: null, H2: null, D1: null, D2: null, D3: null, D4: null };
}

/** ジョブを枠へ割り当て（1ジョブ1枠：同ジョブが他枠にあれば外す）。jobId=null で枠を空に。 */
export function assignSlot(a: PartyAssignment, slot: PartySlot, jobId: string | null): PartyAssignment {
  const next = { ...a };
  if (jobId !== null) {
    for (const s of PARTY_SLOTS) if (next[s] === jobId) next[s] = null;
  }
  next[slot] = jobId;
  return next;
}

/** 検出から消えたジョブの割当だけ外し、残った割当は保持する。
 *  フェーズ追加/貼り直しで検出ジョブ集合が変わっても、まだ居るジョブの枠割当を消さないため。 */
export function pruneAssignment(a: PartyAssignment, byRole: Record<SlotRole, string[]>): PartyAssignment {
  const next = { ...a };
  for (const slot of PARTY_SLOTS) {
    const jobId = next[slot];
    if (jobId === null) continue;
    if (!byRole[SLOT_ROLE[slot]].includes(jobId)) next[slot] = null;
  }
  return next;
}

/** 検出ジョブをロール別に分類（roleOf 不明は捨てる・入力順保持）。 */
export function groupByRole(
  jobIds: string[],
  roleOf: (id: string) => SlotRole | undefined,
): Record<SlotRole, string[]> {
  const out: Record<SlotRole, string[]> = { tank: [], healer: [], dps: [] };
  for (const id of jobIds) {
    const r = roleOf(id);
    if (r) out[r].push(id);
  }
  return out;
}

const ROLES: SlotRole[] = ['tank', 'healer', 'dps'];

/** あるロールで「未割当の検出ジョブが1人 かつ 空き枠が1つ」なら自動で埋める（全ロールに適用）。 */
export function autoFillSingles(a: PartyAssignment, byRole: Record<SlotRole, string[]>): PartyAssignment {
  let next = a;
  for (const role of ROLES) {
    const slots = SLOTS_BY_ROLE[role];
    const seated = slots.map((s) => next[s]).filter((v): v is string => v !== null);
    const unseated = byRole[role].filter((j) => !seated.includes(j));
    const emptySlots = slots.filter((s) => next[s] === null);
    if (unseated.length === 1 && emptySlots.length === 1) {
      next = assignSlot(next, emptySlots[0], unseated[0]);
    }
  }
  return next;
}

/** 全検出ジョブが座ったか（ロール枠超過分は capacity 上限でカウント＝詰み防止）。 */
export function isAssignmentComplete(a: PartyAssignment, byRole: Record<SlotRole, string[]>): boolean {
  return ROLES.every((role) => {
    const slots = SLOTS_BY_ROLE[role];
    const need = Math.min(byRole[role].length, slots.length);
    const seated = slots.filter((s) => a[s] !== null).length;
    return seated >= need;
  });
}

/** 埋まっている枠だけ {slot, jobId}[] に。 */
export function buildPartyOverride(a: PartyAssignment): { slot: string; jobId: string }[] {
  return PARTY_SLOTS.filter((s) => a[s] !== null).map((s) => ({ slot: s, jobId: a[s] as string }));
}

/** その空き枠を「未割当の必須枠」として赤表示すべきか（ロールに未割当検出ジョブが残るなら true）。 */
export function isSlotRequired(a: PartyAssignment, slot: PartySlot, byRole: Record<SlotRole, string[]>): boolean {
  if (a[slot] !== null) return false;
  const role = SLOT_ROLE[slot];
  const slots = SLOTS_BY_ROLE[role];
  const seated = slots.filter((s) => a[s] !== null).length;
  const need = Math.min(byRole[role].length, slots.length);
  return seated < need;
}

/**
 * 検出ジョブを枠へ自動で仮割当しつつ、既存(手動含む)の割当は保持する。
 * - prev のうち検出に残るジョブの枠は維持、消えたジョブの枠は外す(prune)。
 * - まだ座っていない検出ジョブを resolveImportParty の既定配置で空き枠に詰める。
 *   既定の枠が埋まっていれば同ロールの別の空き枠へ。空きが無ければ捨てる。
 * 純関数(prev は変更しない)。
 */
export function seedAssignment(
  prev: PartyAssignment,
  detectedJobIds: string[],
  jobs: Job[],
): PartyAssignment {
  const roleOf = (id: string): SlotRole =>
    jobs.find((j) => j.id === id)?.role as SlotRole;
  const byRole = groupByRole(detectedJobIds, roleOf);
  let next = pruneAssignment(prev, byRole); // shallow copy(prev 不変)
  const seated = new Set(
    PARTY_SLOTS.map((s) => next[s]).filter((v): v is string => v !== null),
  );
  for (const { slot, jobId } of resolveImportParty(detectedJobIds, jobs)) {
    if (seated.has(jobId)) continue;
    if (next[slot as PartySlot] === null) {
      next = assignSlot(next, slot as PartySlot, jobId);
      seated.add(jobId);
      continue;
    }
    // 既定枠が埋まっている → 同ロールの空き枠へ
    const role = roleOf(jobId);
    if (!role) continue;
    const empty = SLOTS_BY_ROLE[role].find((s) => next[s] === null);
    if (empty) {
      next = assignSlot(next, empty, jobId);
      seated.add(jobId);
    }
  }
  return next;
}
