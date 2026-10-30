import React from 'react';
import { Star, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Ripple } from '../Ripple';
import { Tooltip } from '../ui/Tooltip';
import { getPhaseName, type Job, type PartyMember } from '../../types';

interface SlotItemProps {
    index: number;
    member: PartyMember;
    isFocused: boolean;
    isMyJob: boolean;
    isDropTarget?: boolean;
    theme: string;
    jobs: Job[];
    contentLanguage: string;
    onFocusToggle: (index: number) => void;
    onRemoveJob: (memberId: string) => void;
    onMyJobToggle: (memberId: string, isMyJob: boolean) => void;
    dataTutorial?: string;
}

export const SlotItem = React.memo<SlotItemProps>(({
    index, member, isFocused, isMyJob, isDropTarget, theme, jobs, contentLanguage,
    onFocusToggle, onRemoveJob, onMyJobToggle, dataTutorial
}) => {
    const { t } = useTranslation();
    if (!member) return null;
    const job = jobs.find(j => j.id === member.jobId);

    const getSlotColor = () => {
        if (job) return job.role === 'tank' ? 'blue' : job.role === 'healer' ? 'green' : 'red';
        return member.role === 'tank' ? 'blue' : member.role === 'healer' ? 'green' : 'red';
    };
    const activeColor = getSlotColor();

    return (
        <div
            id={`party-slot-${index}`}
            {...(dataTutorial ? { 'data-tutorial': dataTutorial } : {})}
            onClick={() => {
                onFocusToggle(index);
            }}
            className={clsx(
                "btn-tactile h-14 rounded-xl flex items-center justify-between px-3 cursor-pointer border relative group/slot overflow-hidden transition-transform",
                isDropTarget && "ring-2 ring-blue-400 scale-[1.03]",
                isFocused
                    ? activeColor === 'blue'
                        ? "bg-blue-500/[0.12] border-[1.5px] border-blue-300/80"
                        : activeColor === 'green'
                            ? "bg-emerald-500/[0.12] border-[1.5px] border-emerald-300/80"
                            : "bg-rose-500/[0.12] border-[1.5px] border-rose-300/80"
                    : job
                        ? activeColor === 'blue'
                            ? "bg-blue-500/[0.06] border-[1.5px] border-blue-300/50 hover:bg-blue-500/[0.10] hover:border-blue-300/70"
                            : activeColor === 'green'
                                ? "bg-emerald-500/[0.06] border-[1.5px] border-emerald-300/50 hover:bg-emerald-500/[0.10] hover:border-emerald-300/70"
                                : "bg-rose-500/[0.06] border-[1.5px] border-rose-300/50 hover:bg-rose-500/[0.10] hover:border-rose-300/70"
                        : activeColor === 'blue'
                            ? "bg-blue-500/[0.03] border-[1.5px] border-blue-300/25 hover:bg-blue-500/[0.06] border-dashed"
                            : activeColor === 'green'
                                ? "bg-emerald-500/[0.03] border-[1.5px] border-emerald-300/25 hover:bg-emerald-500/[0.06] border-dashed"
                                : "bg-rose-500/[0.03] border-[1.5px] border-rose-300/25 hover:bg-rose-500/[0.06] border-dashed"
            )}
        >
            <Ripple />

            {/* Left side: Tag and Icon */}
            <div className="flex items-center gap-3 z-10 pointer-events-none">
                <div className={clsx(
                    "text-app-base font-black tracking-tighter w-6 z-10",
                    theme === 'dark'
                        ? activeColor === 'blue'
                            ? "text-blue-200"
                            : activeColor === 'green'
                                ? "text-emerald-200"
                                : "text-rose-200"
                        : activeColor === 'blue'
                            ? "text-blue-800"
                            : activeColor === 'green'
                                ? "text-emerald-800"
                                : "text-rose-800"
                )}>
                    {member.id}
                </div>
                {job ? (
                    <img referrerPolicy="no-referrer"
                        src={job.icon}
                        alt={getPhaseName(job.name, contentLanguage)}
                        className="w-8 h-8 object-contain"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full border border-app-border bg-app-surface2 flex flex-col items-center justify-center">
                        <span className="text-app-xs text-app-text-muted font-black uppercase tracking-widest">Select</span>
                    </div>
                )}
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2 z-20">
                {job && (
                    <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMyJobToggle(member.id, isMyJob);
                            }}
                            className={clsx("p-2 rounded-lg transition-all flex items-center justify-center border cursor-pointer group/star",
                                isMyJob
                                    ? "bg-app-amber-border border-app-amber text-app-amber scale-110"
                                    : "bg-app-surface2 text-app-text/30 border-app-border hover:bg-app-surface2 hover:text-app-text/80"
                            )}
                        >
                            <Tooltip content={t('party.my_job')}>
                                <Star size={16} className={clsx("transition-all duration-300",
                                    isMyJob
                                        ? "fill-app-amber text-app-amber"
                                        : "group-hover/star:scale-110"
                                )} />
                            </Tooltip>
                        </button>
                        <button
                            data-tutorial-remove={member.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveJob(member.id);
                            }}
                            className="p-2 rounded-lg text-app-red/40 hover:text-app-red hover:bg-app-red-dim transition-colors border border-transparent hover:border-app-red-border cursor-pointer"
                        >
                            <Trash2 size={16} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
});
