import type { PartyMember, TimelineEvent, AppliedMitigation, Phase } from '../../types';
import { getEffectiveTarget } from '../../utils/effectiveTarget';
import type { DamageInfo } from './timelineRowTypes';

// 1 段(攻撃 1 つ)が致死か。挑発によるタンクスイッチ後の実効ターゲットの最大 HP と比べる
export const isEventLethal = (
    event: TimelineEvent,
    damage: DamageInfo | null | undefined,
    partyMembers: PartyMember[],
    swapMarkers: readonly AppliedMitigation[],
    phases: readonly Phase[],
): boolean => {
    if (!damage || !(damage.unmitigated > 0 || damage.isInvincible)) return false;
    const evtEff = getEffectiveTarget(event, swapMarkers, phases);
    let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
    if (evtEff === 'MT' || evtEff === 'ST') {
        maxHp = partyMembers.find(m => m.id === evtEff)?.stats.hp || 1;
    }
    return damage.mitigated >= maxHp;
};
