import type { Job } from '../../types';
import { dpsRank, tankRank, healerRank } from '../../data/dpsOrder';

type SlotRole = 'tank' | 'healer' | 'dps';

const SLOTS_BY_ROLE: Record<SlotRole, readonly string[]> = {
  tank: ['MT', 'ST'],
  healer: ['H1', 'H2'],
  dps: ['D1', 'D2', 'D3', 'D4'],
};

/** ロールごとの並び順ランク(小さいほど先頭枠寄り)。 */
const RANK: Record<SlotRole, (id: string) => number> = {
  tank: tankRank,
  healer: healerRank,
  dps: dpsRank,
};

/**
 * 検出ジョブをロール枠(MT/ST・H1/H2・D1〜D4)へ割り当てる。
 * - 各ロール内をサブロール/並び順ランク昇順で安定ソートして枠を採番:
 *   タンク=canonical 順(pld→war→drk→gnb)で MT/ST、ヒラ=PH(白/占)→BH(学/賢)で H1/H2、
 *   DPS=近接→遠隔物理→キャスターで D1〜D4。同ランク(未知)は検出順を保つ(安定ソート)。
 * - ロール枠超過・未知ロール/未知ジョブは捨てる。
 *
 * 戻り値の配列順は元の usedJobIds 順を保つ(slot だけ上記規則で確定)。
 * 順序に依存する consumer(既存テスト・表示前整列)を壊さないため。
 */
export function resolveImportParty(
  usedJobIds: string[],
  jobs: Job[],
): { slot: string; jobId: string }[] {
  const roleOf = new Map(jobs.map((j) => [j.id, j.role] as const));

  // ロールごとに jobId→slot を先に確定。
  const slotByJob = new Map<string, string>();
  for (const role of ['tank', 'healer', 'dps'] as SlotRole[]) {
    const ids = usedJobIds.filter((id) => roleOf.get(id) === role);
    [...ids]
      .sort((a, b) => RANK[role](a) - RANK[role](b))
      .forEach((jobId, i) => {
        const slot = SLOTS_BY_ROLE[role][i];
        if (slot) slotByJob.set(jobId, slot);
      });
  }

  // 出力は検出順を保持。枠が決まらなかった(超過/未知)ものは捨てる。
  const out: { slot: string; jobId: string }[] = [];
  for (const jobId of usedJobIds) {
    const slot = slotByJob.get(jobId);
    if (slot) out.push({ slot, jobId });
  }
  return out;
}
