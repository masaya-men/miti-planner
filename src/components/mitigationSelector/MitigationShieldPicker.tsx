import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Mitigation, AppliedMitigation, PartyMember } from '../../types';
import type { useJobs } from '../../hooks/useSkillsData';
import { matchesCopiesShieldSource } from '../../utils/scholarShieldRules';
import { calculateLinkedShieldValue } from '../../utils/calculator';

interface MitigationShieldPickerProps {
    mitigation: Mitigation;
    selectedTime: number;
    timelineMitigations: AppliedMitigation[];
    partyMembers: PartyMember[];
    JOBS: ReturnType<typeof useJobs>;
    MITIGATIONS: Mitigation[];
    onSelect: (linkedMitigationId?: string) => void;
}

// copiesShield 系スキル(展開する鼓舞を選ぶもの)を選んだ時に、スキルの直下へ開く鼓舞の選択パネル。
export const MitigationShieldPicker: React.FC<MitigationShieldPickerProps> = ({
    mitigation, selectedTime, timelineMitigations, partyMembers, JOBS, MITIGATIONS, onSelect,
}) => {
    const { t } = useTranslation();
                                        const availableShields = timelineMitigations.filter(l =>
                                            matchesCopiesShieldSource(l.mitigationId, mitigation.copiesShield!) &&
                                            l.time <= selectedTime &&
                                            l.time + l.duration > selectedTime
                                        );
                                        return (
                                            <div
                                                className={clsx(
                                                    "w-full mt-1 mb-2 p-3 rounded-xl border-t-white/20",
                                                    "glass-panel shadow-[0_8px_30px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)]",
                                                    "animate-in slide-in-from-top-2 fade-in duration-300 relative z-20"
                                                )}
                                                style={{ pointerEvents: 'auto' }}
                                            >
                                                {availableShields.length === 0 ? (
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-app-base text-app-amber font-bold text-center">
                                                            {t('mitigation.no_shield', '有効な鼓舞がありません')}
                                                        </p>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onSelect(undefined);
                                                            }}
                                                            className={clsx(
                                                                "w-full p-2 rounded-lg border transition-all duration-200",
                                                                "bg-app-surface2 border-app-border",
                                                                "hover:bg-app-surface2 hover:border-app-border",
                                                                "shadow-sm dark:shadow-none hover:shadow-md",
                                                                "cursor-pointer active:scale-95 hover:scale-[1.01]",
                                                                "text-app-base text-app-text-sec"
                                                            )}
                                                        >
                                                            {t('mitigation.no_shield', '有効な鼓舞がありません')}（{t('mitigation.shield_value', { value: 0 })}）
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {availableShields.map(shield => {
                                                            const shieldOwner = partyMembers.find(p => p.id === shield.ownerId);
                                                            const targetMember = shield.targetId
                                                                ? partyMembers.find(p => p.id === shield.targetId)
                                                                : shieldOwner;
                                                            const targetJob = targetMember?.jobId ? JOBS.find(j => j.id === targetMember.jobId) : null;
                                                            const barrierValue = calculateLinkedShieldValue(
                                                                shield, timelineMitigations, partyMembers, MITIGATIONS
                                                            );
                                                            return (
                                                                <button
                                                                    key={`shield-${shield.id}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onSelect(shield.id);
                                                                    }}
                                                                    className={clsx(
                                                                        "flex items-center gap-3 p-2 rounded-lg border transition-all duration-200",
                                                                        "bg-app-surface2 border-app-border",
                                                                        "hover:bg-app-surface2 hover:border-app-border",
                                                                        "shadow-sm dark:shadow-none hover:shadow-md",
                                                                        "cursor-pointer active:scale-95 hover:scale-[1.01]"
                                                                    )}
                                                                >
                                                                    {targetJob ? (
                                                                        <img
                                                                            src={targetJob.icon}
                                                                            alt={targetJob.name?.en || targetJob.id}
                                                                            className="w-8 h-8 object-contain drop-shadow-md shrink-0"
                                                                        />
                                                                    ) : (
                                                                        <span className={clsx(
                                                                            "w-8 h-8 flex items-center justify-center text-app-2xl font-black tracking-tighter uppercase drop-shadow-sm shrink-0",
                                                                            targetMember?.role === 'tank' ? 'text-app-role-tank' :
                                                                            targetMember?.role === 'healer' ? 'text-app-role-healer' :
                                                                            'text-app-role-dps'
                                                                        )}>
                                                                            {t(`modal.${(targetMember?.id || '').toLowerCase()}`, targetMember?.id || '')}
                                                                        </span>
                                                                    )}
                                                                    <div className="flex flex-col items-start min-w-0">
                                                                        <span className="text-app-base font-bold text-app-text truncate">
                                                                            {t(`modal.${(targetMember?.id || '').toLowerCase()}`, targetMember?.id || '')}
                                                                        </span>
                                                                        <span className="text-app-sm text-app-text-sec">
                                                                            {t('mitigation.shield_value', { value: barrierValue.toLocaleString() })}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
};
