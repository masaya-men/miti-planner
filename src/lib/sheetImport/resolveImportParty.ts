import type { Job } from '../../types';

const SLOTS_BY_ROLE: Record<'tank' | 'healer' | 'dps', string[]> = {
  tank: ['MT', 'ST'],
  healer: ['H1', 'H2'],
  dps: ['D1', 'D2', 'D3', 'D4'],
};

export function resolveImportParty(
  usedJobIds: string[],
  jobs: Job[],
): { slot: string; jobId: string }[] {
  const roleOf = new Map(jobs.map((j) => [j.id, j.role] as const));
  const next: Record<'tank' | 'healer' | 'dps', number> = { tank: 0, healer: 0, dps: 0 };
  const out: { slot: string; jobId: string }[] = [];
  for (const jobId of usedJobIds) {
    const role = roleOf.get(jobId);
    if (!role) continue;
    const slot = SLOTS_BY_ROLE[role][next[role]];
    if (!slot) continue; // ロール枠超過は捨てる
    next[role] += 1;
    out.push({ slot, jobId });
  }
  return out;
}
