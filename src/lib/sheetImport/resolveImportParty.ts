import type { Job } from '../../types';
import { dpsRank } from '../../data/dpsOrder';

const SLOTS_BY_ROLE: Record<'tank' | 'healer' | 'dps', string[]> = {
  tank: ['MT', 'ST'],
  healer: ['H1', 'H2'],
  dps: ['D1', 'D2', 'D3', 'D4'],
};

/**
 * 検出ジョブをロール枠(MT/ST・H1/H2・D1〜D4)へ割り当てる。
 * - タンク/ヒラ: 検出順のまま枠に詰める(挙動不変)。
 * - DPS: サブロール順(近接 → 遠隔物理 → キャスター = dpsRank 昇順)で D1〜D4 を決める。
 *   同サブロール内・未知ジョブ(rank 同値)は検出順を保つ(安定ソート)。
 * ロール枠超過分は捨てる。
 *
 * 戻り値の配列順は元の usedJobIds 順を保つ(slot だけ上記規則で確定)。
 * 順序に依存する consumer(既存テスト・表示前整列)を壊さないため。
 */
export function resolveImportParty(
  usedJobIds: string[],
  jobs: Job[],
): { slot: string; jobId: string }[] {
  const roleOf = new Map(jobs.map((j) => [j.id, j.role] as const));

  // DPS の jobId → slot を先に決める: 検出順の DPS をサブロール順に並べ替えて D1〜D4 を採番。
  // Array.prototype.sort は安定なので同 rank(同サブロール・未知)は検出順を維持。
  const dpsIds = usedJobIds.filter((id) => roleOf.get(id) === 'dps');
  const dpsSlotByJob = new Map<string, string>();
  [...dpsIds]
    .sort((a, b) => dpsRank(a) - dpsRank(b))
    .forEach((jobId, i) => {
      const slot = SLOTS_BY_ROLE.dps[i];
      if (slot) dpsSlotByJob.set(jobId, slot);
    });

  // 出力は検出順。タンク/ヒラは順番に枠を採番、DPS は上で決めた slot を引く。
  const tankHealerNext: Record<'tank' | 'healer', number> = { tank: 0, healer: 0 };
  const out: { slot: string; jobId: string }[] = [];
  for (const jobId of usedJobIds) {
    const role = roleOf.get(jobId);
    if (role === 'tank' || role === 'healer') {
      const slot = SLOTS_BY_ROLE[role][tankHealerNext[role]];
      if (!slot) continue; // ロール枠超過は捨てる
      tankHealerNext[role] += 1;
      out.push({ slot, jobId });
    } else if (role === 'dps') {
      const slot = dpsSlotByJob.get(jobId);
      if (!slot) continue; // D4 超過は捨てる
      out.push({ slot, jobId });
    }
    // 未知ロールは捨てる
  }
  return out;
}
