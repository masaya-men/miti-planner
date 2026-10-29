import clsx from 'clsx';
import { useMitigationStore } from '../../store/useMitigationStore';
import { getPhaseName } from '../../types';
import type { Job } from '../../types';

interface MitigationTargetBadgeProps {
    /** 対象。スプシ表示で同じマスに重なった時は複数(横に並べる) */
    targetIds: string[];
    JOBS: Job[];
    contentLanguage: Parameters<typeof getPhaseName>[1];
    isSheetIcon: boolean;
}

/** 軽減アイコンの右下に出す「対象」バッジ(対象メンバーのジョブアイコン、無ければ対象 ID の文字) */
export const MitigationTargetBadge = ({ targetIds, JOBS, contentLanguage, isSheetIcon }: MitigationTargetBadgeProps) => (
    <div className={clsx("absolute z-30 pointer-events-none flex drop-shadow-[0_2px_4px_rgba(0,0,0,1)]", isSheetIcon ? "-bottom-[3px] -right-[4px]" : "-bottom-2 -right-2")}>
        {targetIds.map(id => <TargetMark key={id} targetId={id} JOBS={JOBS} contentLanguage={contentLanguage} isSheetIcon={isSheetIcon} />)}
    </div>
);

const TargetMark = ({ targetId, JOBS, contentLanguage, isSheetIcon }: Omit<MitigationTargetBadgeProps, 'targetIds'> & { targetId: string }) => {
    const members = useMitigationStore.getState().partyMembers;
    const targetMember = members.find((m: import('../../types').PartyMember) => m.id === targetId);
    const targetJob = targetMember?.jobId ? JOBS.find(j => j.id === targetMember.jobId) : null;
    return (
        <>
            {targetJob ? (
                <img src={targetJob.icon} alt={getPhaseName(targetJob.name, contentLanguage)} className={clsx("object-contain rounded-sm", isSheetIcon ? "w-[10px] h-[10px]" : "w-[20px] h-[20px]")} />
            ) : (
                <div className={clsx("bg-black/90 rounded px-1 py-0.5 text-app-xs font-black text-slate-800 dark:text-white ring-1 ring-white/20 origin-bottom-right", isSheetIcon && "scale-[.6]")}>
                    {targetId}
                </div>
            )}
        </>
    );
};
