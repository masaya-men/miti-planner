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
