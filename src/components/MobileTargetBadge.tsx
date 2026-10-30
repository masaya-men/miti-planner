import React from 'react';
import clsx from 'clsx';
import type { PartyMember, TimelineEvent } from '../types';
import { useJobs } from '../hooks/useSkillsData';

/** 対象バッジ（AoE以外）。effTarget = 挑発考慮済みの実効ターゲット */
export const TargetBadge: React.FC<{ effTarget: TimelineEvent['target']; partyMembers: PartyMember[] }> = ({ effTarget, partyMembers }) => {
    const JOBS = useJobs();
    if (effTarget === 'AoE') return null;
    const member = partyMembers.find(m => m.id === effTarget);
    const job = member ? JOBS.find(j => j.id === member.jobId) : null;
    if (job) {
        return (
            <span className="inline-flex items-center gap-0.5 px-1 py-px rounded-md bg-app-text/5 flex-shrink-0">
                <img referrerPolicy="no-referrer" src={job.icon} className="w-3.5 h-3.5 rounded flex-shrink-0" alt={effTarget ?? ''} />
            </span>
        );
    }
    return (
        <span className={clsx(
            "text-app-sm font-black px-1 py-px rounded-md flex-shrink-0",
            effTarget === 'MT' ? "text-app-role-mt bg-app-role-mt-dim" : "text-app-role-st bg-app-role-st-dim"
        )}>
            {effTarget}
        </span>
    );
};
