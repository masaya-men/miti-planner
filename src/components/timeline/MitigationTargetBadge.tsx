import clsx from 'clsx';
import { useMitigationStore } from '../../store/useMitigationStore';
import { getPhaseName } from '../../types';
import type { AppliedMitigation, Job } from '../../types';

interface MitigationTargetBadgeProps {
    mitigation: AppliedMitigation;
    JOBS: Job[];
    contentLanguage: Parameters<typeof getPhaseName>[1];
    isSheetIcon: boolean;
}

/** 軽減アイコンの右下に出す「対象」バッジ(対象メンバーのジョブアイコン、無ければ対象 ID の文字) */
export const MitigationTargetBadge = ({ mitigation, JOBS, contentLanguage, isSheetIcon }: MitigationTargetBadgeProps) => {
    const members = useMitigationStore.getState().partyMembers;
    const targetMember = members.find((m: import('../../types').PartyMember) => m.id === mitigation.targetId);
    const targetJob = targetMember?.jobId ? JOBS.find(j => j.id === targetMember.jobId) : null;
    return (
        <div className={clsx("absolute z-30 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,1)]", isSheetIcon ? "-bottom-[3px] -right-[4px]" : "-bottom-2 -right-2")}>
            {targetJob ? (
                <img src={targetJob.icon} alt={getPhaseName(targetJob.name, contentLanguage)} className={clsx("object-contain rounded-sm", isSheetIcon ? "w-[10px] h-[10px]" : "w-[20px] h-[20px]")} />
            ) : (
                <div className={clsx("bg-black/90 rounded px-1 py-0.5 text-app-xs font-black text-slate-800 dark:text-white ring-1 ring-white/20 origin-bottom-right", isSheetIcon && "scale-[.6]")}>
                    {mitigation.targetId}
                </div>
            )}
        </div>
    );
};
