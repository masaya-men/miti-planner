import React from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Mitigation, PartyMember } from '../../types';
import type { useJobs } from '../../hooks/useSkillsData';

interface MitigationTargetPickerProps {
    partyMembers: PartyMember[];
    JOBS: ReturnType<typeof useJobs>;
    selectedSingleTargetMit: Mitigation | null;
    ownerId?: string | null;
    onSelect: (targetId: string) => void;
    /** この秒にもう相手にした人 → 配置 ID(押すとその 1 つを消す) */
    used?: ReadonlyMap<string, string>;
    /** まだ足せるか(チャージが残っているか) */
    canAddMore?: boolean;
    onRemoveTarget?: (instanceId: string) => void;
}

// 単体対象スキルを選んだ時に、スキルの直下へ開く対象(パーティ 8 人)の選択パネル。
export const MitigationTargetPicker: React.FC<MitigationTargetPickerProps> = ({
    partyMembers, JOBS, selectedSingleTargetMit, ownerId, onSelect, used, canAddMore = true, onRemoveTarget,
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
                                                    const usedId = used?.get(member.id);
                                                    const isDisabled = !usedId && (isSelfTargetRestricted || !canAddMore);

                                                    return (
                                                        <button
                                                            key={`target-${member.id}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (usedId) onRemoveTarget?.(usedId);
                                                                else if (!isDisabled) onSelect(member.id);
                                                            }}
                                                            disabled={isDisabled}
                                                            aria-pressed={usedId ? true : undefined}
                                                            aria-label={usedId ? t('mitigation.remove') : undefined}
                                                            className={clsx(
                                                                "relative",
                                                                "flex items-center justify-center p-2 rounded-lg border transition-all duration-200",
                                                                usedId ? "bg-app-surface2 border-app-red" : "bg-app-surface2 border-app-border",
                                                                usedId ? "hover:bg-app-red-dim" : "hover:bg-app-surface2 hover:border-app-border",
                                                                "shadow-sm dark:shadow-none hover:shadow-md",
                                                                isDisabled ? "opacity-30 cursor-not-allowed grayscale shadow-none" : "cursor-pointer active:scale-95 hover:scale-[1.03]"
                                                            )}
                                                        >
                                                            {job ? (
                                                                <img referrerPolicy="no-referrer" 
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
                                                            {/* この秒にもう使った人: 押すと消える印 */}
                                                            {usedId && (
                                                                <span className="absolute -top-1.5 -right-1.5 rounded-full bg-app-red text-white p-0.5 shadow-sm">
                                                                    <X size={10} strokeWidth={3} />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
    );
};
