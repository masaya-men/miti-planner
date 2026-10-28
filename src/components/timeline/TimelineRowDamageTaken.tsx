import React from 'react';
import type { PartyMember, TimelineEvent, AppliedMitigation, Phase } from '../../types';
import { getEffectiveTarget } from '../../utils/effectiveTarget';
import { useTranslation } from 'react-i18next';
import { AnimatedDamage } from '../AnimatedDamage';
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

// PC用: 1 段ぶんの TAKEN(軽減後ダメージ)。致死判定は挑発によるタンクスイッチ後の実効ターゲットで行う
export const DamageTakenCell: React.FC<{
    event: TimelineEvent;
    damage: DamageInfo | null | undefined;
    partyMembers: PartyMember[];
    swapMarkers: readonly AppliedMitigation[];
    phases: readonly Phase[];
}> = ({ event, damage, partyMembers, swapMarkers, phases }) => {
    const { t } = useTranslation();
    if (!damage || !(damage.unmitigated > 0 || damage.isInvincible)) return null;
    const isLethal = isEventLethal(event, damage, partyMembers, swapMarkers, phases);
    const colorClass = isLethal ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";
    return (
        <>
            <AnimatedDamage value={damage.mitigated} isLethal={isLethal} className={`${colorClass} !h-[16px]`} />
            {damage.isInvincible ? (
                <div className="text-app-sm text-app-text-muted font-normal tracking-tighter scale-90 whitespace-nowrap">
                    {t('timeline.invuln', 'Invuln')}
                </div>
            ) : (damage.mitigationPercent > 0 || damage.shieldTotal > 0) ? (
                <div className="text-app-sm text-app-text-muted font-normal tracking-tighter scale-90 whitespace-nowrap hidden md:flex flex-row items-center justify-center gap-1 w-full px-1 truncate leading-none">
                    {damage.mitigationPercent > 0 && <span>▼ {damage.mitigationPercent}%</span>}
                    {damage.mitigationPercent > 0 && damage.shieldTotal > 0 && <span className="opacity-50">|</span>}
                    {damage.shieldTotal > 0 && (
                        <span className="flex items-center gap-0.5">
                            🛡️ {damage.shieldTotal.toLocaleString()}
                        </span>
                    )}
                </div>
            ) : null}
        </>
    );
};
