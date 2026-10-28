import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Mitigation, PartyMember } from '../../types';
import type { useJobs } from '../../hooks/useSkillsData';

interface MitigationTargetPickerProps {
    partyMembers: PartyMember[];
    JOBS: ReturnType<typeof useJobs>;
    selectedSingleTargetMit: Mitigation | null;
    ownerId?: string | null;
    onSelect: (targetId: string) => void;
}

// 単体対象スキルを選んだ時に、スキルの直下へ開く対象(パーティ 8 人)の選択パネル。
export const MitigationTargetPicker: React.FC<MitigationTargetPickerProps> = ({
    partyMembers, JOBS, selectedSingleTargetMit, ownerId, onSelect,
}) => {
    const { t } = useTranslation();
    return (
                                        <div
                                            className={clsx(
                                                "w-full mt-1 mb-2 p-3 rounded-xl border-t-white/20",
                                                "glass-panel shadow-[0_8px_30px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)]",
                                                "animate-in slide-in-from-top-2 fade-in duration-300 relative z-20"
                                            )}
                                            style={{ pointerEvents: 'auto' }}
                                        >
                                            <div className="grid grid-cols-4 grid-rows-2 gap-2 pb-1 pt-1">
                                                {partyMembers.map((member: PartyMember) => {
                                                    const job = member.jobId ? JOBS.find(j => j.id === member.jobId) : null;
                                                    const isSelfTargetRestricted = selectedSingleTargetMit?.targetCannotBeSelf && member.id === ownerId;
                                                    const isDisabled = isSelfTargetRestricted;

                                                    return (
                                                        <button
                                                            key={`target-${member.id}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!isDisabled) onSelect(member.id);
                                                            }}
                                                            disabled={isDisabled}
                                                            className={clsx(
                                                                "flex items-center justify-center p-2 rounded-lg border transition-all duration-200",
                                                                "bg-app-surface2 border-app-border",
                                                                "hover:bg-app-surface2 hover:border-app-border",
                                                                "shadow-sm dark:shadow-none hover:shadow-md",
                                                                isDisabled ? "opacity-30 cursor-not-allowed grayscale shadow-none" : "cursor-pointer active:scale-95 hover:scale-[1.03]"
                                                            )}
                                                        >
                                                            {job ? (
                                                                <img 
                                                                    src={job.icon} 
                                                                    alt={job.name?.en || job.id} 
                                                                    className="w-8 h-8 object-contain drop-shadow-md" 
                                                                />
                                                            ) : (
                                                                <span className={clsx(
                                                                    "text-app-2xl font-black tracking-tighter uppercase drop-shadow-sm",
                                                                    member.role === 'tank' ? 'text-app-role-tank' : 
                                                                    member.role === 'healer' ? 'text-app-role-healer' : 
                                                                    'text-app-role-dps'
                                                                )}>
                                                                    {t(`modal.${member.id.toLowerCase()}`, member.id)}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
    );
};
