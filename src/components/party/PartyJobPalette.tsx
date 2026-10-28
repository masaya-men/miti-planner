import React from 'react';
import clsx from 'clsx';
import { Ripple } from '../Ripple';
import { Tooltip } from '../ui/Tooltip';
import { getPhaseName, type Job } from '../../types';
import { MELEE_IDS } from './partyJobGroups';

interface PartyJobPaletteProps {
    JOBS: Job[];
    contentLanguage: string;
    handleJobSelect: (jobId: string) => void;
    drag: { startDrag: (job: Job, e: React.TouchEvent | React.MouseEvent) => void };
}

export const PartyJobPalette: React.FC<PartyJobPaletteProps> = ({ JOBS, contentLanguage, handleJobSelect, drag }) => {
        const categories = [
            { id: 'tank', name: 'Tank', jobs: JOBS.filter(j => j.role === 'tank'), color: 'hover:border-blue-500 hover:bg-blue-500/20' },
            { id: 'healer', name: 'Healer', jobs: JOBS.filter(j => j.role === 'healer'), color: 'hover:border-green-500 hover:bg-green-500/20' },
            { id: 'melee', name: 'Melee', jobs: JOBS.filter(j => MELEE_IDS.includes(j.id)), color: 'hover:border-red-500 hover:bg-red-500/20' },
            { id: 'ranged', name: 'Ranged', jobs: JOBS.filter(j => ['brd', 'mch', 'dnc'].includes(j.id)), color: 'hover:border-red-500 hover:bg-red-500/20' },
            { id: 'caster', name: 'Caster', jobs: JOBS.filter(j => ['blm', 'smn', 'rdm', 'pct'].includes(j.id)), color: 'hover:border-red-500 hover:bg-red-500/20' },
        ];

        return (
            // 👇 スマホ時にパレット全体がスクロールできるようにする
            <div data-tutorial="party-palette-pick" className="flex flex-col gap-0.5 overflow-y-auto custom-scrollbar pr-1 pt-2 pb-2">
                {categories.map((cat, idx) => (
                    <React.Fragment key={cat.id}>
                        {idx !== 0 && <hr className="border-t border-app-border w-full m-0" />}
                        <div className="flex items-center gap-3">
                            <div className="w-12 text-right text-app-sm font-black text-app-text uppercase tracking-wider shrink-0 dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                {cat.name}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {cat.jobs.map(job => {
                                    return (
                                        <button
                                            key={job.id}
                                            data-job-id={job.id}
                                            onClick={() => handleJobSelect(job.id)}
                                            onMouseDown={(e) => drag.startDrag(job, e)}
                                            className={clsx(
                                                "btn-tactile w-9 h-9 rounded-lg border flex items-center justify-center relative group/btn cursor-pointer",
                                                "bg-transparent border-transparent hover:bg-app-surface2",
                                                cat.color
                                            )}
                                        >
                                            <Ripple />
                                            <Tooltip content={getPhaseName(job.name, contentLanguage)}>
                                                <img src={job.icon} alt={getPhaseName(job.name, contentLanguage)} className="w-8 h-8 object-contain transition-transform group-hover/btn:scale-110 relative z-10 pointer-events-none" />
                                            </Tooltip>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
        );
};
