import type { PartyMember, ContentLevel } from '../../types';
import {
  getDefaultTankStats,
  getDefaultHealerStats,
} from '../../store/useMitigationStore';
import { getJobsFromStore } from '../../hooks/useSkillsData';
import { DEFAULT_NEW_MODE } from '../../utils/mitigationResolver';

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

// 既定ステータスはコンテンツのレベルに依存する(Lv80 と Lv100 で HP/ステータスが違う)。
// tank 以外(healer/dps)は healer 既定値を使う(INITIAL_PARTY と同じ作法)。
function defaultStats(role: SlotRole, level: ContentLevel) {
  return role === 'tank' ? getDefaultTankStats(level) : getDefaultHealerStats(level);
}

/**
 * 取り込み結果 party（{slot, jobId}[]）から 8 枠固定の PartyMember[] を構築する。
 * result.party にある枠は jobId + role を上書き。ない枠は jobId:null + デフォルト role。
 *
 * `level` は必須。コンテンツのレベルに応じた既定ステータスを入れるため。
 * (必須にすることで、新しい取込/作成経路がレベル反映を忘れるとコンパイルエラーになる。)
 */
export function buildImportedPartyMembers(
  party: { slot: string; jobId: string }[],
  level: ContentLevel,
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
      mode: DEFAULT_NEW_MODE,
      stats: defaultStats(role, level),
      computedValues: {},
    };
  });
}
