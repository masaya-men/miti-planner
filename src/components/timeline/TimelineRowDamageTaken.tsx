import React from 'react';
import type { PartyMember, TimelineEvent, AppliedMitigation, Phase } from '../../types';
import { isEventLethal } from './isEventLethal';
import { useTranslation } from 'react-i18next';
import { AnimatedDamage } from '../AnimatedDamage';
import type { DamageInfo } from './timelineRowTypes';

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
