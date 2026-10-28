import React from 'react';
import clsx from 'clsx';
import { getPhaseName, type PartyMember, type TimelineEvent, type AppliedMitigation } from '../../types';
import { useJobs, useMitigations } from '../../hooks/useSkillsData';

// スマホ用: 対象バッジ（AoE以外の場合に表示）
// effTarget: 挑発によるタンクスイッチを反映した実効ターゲット（表示用）
export const MobileTargetBadge: React.FC<{ partyMembers: PartyMember[]; effTarget: TimelineEvent['target'] }> = ({ partyMembers, effTarget }) => {
    const JOBS = useJobs();
    if (effTarget === 'AoE') return null;
    const member = partyMembers.find(m => m.id === effTarget);
    const job = member ? JOBS.find(j => j.id === member.jobId) : null;
    if (job) {
        return <img src={job.icon} className="w-3.5 h-3.5 rounded-sm flex-shrink-0" alt={effTarget} />;
    }
    return (
        <span className={clsx(
            "text-app-2xs font-black px-0.5 rounded flex-shrink-0",
            effTarget === 'MT' ? "text-app-role-mt bg-app-role-mt-dim" : "text-app-role-st bg-app-role-st-dim"
        )}>
            {effTarget}
        </span>
    );
};

// スマホ用: 軽減アイコンリスト
export const MobileMitiIcons: React.FC<{
    mitigations: AppliedMitigation[];
    contentLanguage: string;
    myMemberId: string | null;
    size?: string;
}> = ({ mitigations, contentLanguage, myMemberId, size = 'w-3 h-3' }) => {
    const MITIGATIONS = useMitigations();
    return (
    <div className="flex md:hidden items-center gap-px flex-shrink-0 ml-auto">
        {mitigations.map(mit => {
            const def = MITIGATIONS.find(m => m.id === mit.mitigationId);
            if (!def) return null;
            // 薄暗くの ON/OFF は親 .timeline-scroll-container[data-myjob-highlight] + CSS が担当。
            // ここでは「自分以外」の印(data-myjob-dim)だけ付ける（myJobHighlight は購読しない）。
            const isNotMine = !!myMemberId && mit.ownerId !== myMemberId;
            return (
                <img
                    key={mit.id}
                    src={def.icon}
                    alt={def.name ? getPhaseName(def.name, contentLanguage) : ''}
                    data-myjob-dim={isNotMine ? 'gray' : undefined}
                    className={clsx(size, "object-cover rounded-sm opacity-90")}
                />
            );
        })}
    </div>
); };
