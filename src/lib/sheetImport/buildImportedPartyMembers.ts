import type { PartyMember } from '../../types';
import {
  DEFAULT_TANK_STATS,
  DEFAULT_HEALER_STATS,
} from '../../store/useMitigationStore';
import { getJobsFromStore } from '../../hooks/useSkillsData';

type SlotRole = 'tank' | 'healer' | 'dps';

const SLOT_DEFAULTS: { id: string; role: SlotRole }[] = [
  { id: 'MT', role: 'tank' },
  { id: 'ST', role: 'tank' },
  { id: 'H1', role: 'healer' },
  { id: 'H2', role: 'healer' },
  { id: 'D1', role: 'dps' },
  { id: 'D2', role: 'dps' },
  { id: 'D3', role: 'dps' },
  { id: 'D4', role: 'dps' },
];

function defaultStats(role: SlotRole) {
  return role === 'tank' ? { ...DEFAULT_TANK_STATS } : { ...DEFAULT_HEALER_STATS };
}

/**
 * 取り込み結果 party（{slot, jobId}[]）から 8 枠固定の PartyMember[] を構築する。
 * result.party にある枠は jobId + role を上書き。ない枠は jobId:null + デフォルト role。
 */
export function buildImportedPartyMembers(
  party: { slot: string; jobId: string }[],
): PartyMember[] {
  const jobs = getJobsFromStore();
  const partyMap = new Map(party.map((p) => [p.slot, p.jobId]));

  return SLOT_DEFAULTS.map(({ id, role: defaultRole }) => {
    const jobId = partyMap.get(id) ?? null;
    const job = jobId ? jobs.find((j) => j.id === jobId) : null;
    const role: SlotRole = (job?.role as SlotRole | undefined) ?? defaultRole;
    return {
      id,
      jobId,
      role,
      stats: defaultStats(role),
      computedValues: {},
    };
  });
}
