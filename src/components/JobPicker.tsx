import React from 'react';
import { useJobs } from '../hooks/useSkillsData';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from './ui/Tooltip';
import { getPhaseName } from '../types';

interface JobPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (jobId: string) => void;
    position: { x: number; y: number };
    currentJobId: string | null;
}

import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import type { ContentLanguage } from '../store/useThemeStore';

export const JobPicker: React.FC<JobPickerProps> = ({ isOpen, onClose, onSelect, position, currentJobId }) => {
    const { t } = useTranslation();
    const { contentLanguage, theme } = useThemeStore();
    const jobs = useJobs();

    if (!isOpen) return null;

    // Group jobs by role
    const tanks = jobs.filter(j => j.role === 'tank');
    const healers = jobs.filter(j => j.role === 'healer');

    // Split DPS
    // Melee: mnk, drg, nin, sam, rpr, vpr
    const melee = jobs.filter(j => ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].includes(j.id));
    // Phys Ranged: brd, mch, dnc
    const physRanged = jobs.filter(j => ['brd', 'mch', 'dnc'].includes(j.id));
    // Magic Ranged: blm, smn, rdm, pct, blu
    const magicRanged = jobs.filter(j => ['blm', 'smn', 'rdm', 'pct'].includes(j.id));

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-start justify-start pointer-events-none">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 pointer-events-auto"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="pointer-events-auto glass-tier3 rounded-xl p-2 w-[220px] flex flex-col gap-2 absolute z-[100]"
                    style={{
                        left: Math.min(position.x, window.innerWidth - 240),
                        top: Math.min(position.y + 10, window.innerHeight - 300)
                    }}
                >
                    <div className="flex justify-between items-center border-b border-app-border pb-1.5 px-1">
                        <h3 className="font-bold text-app-text-primary text-app-lg tracking-wide">{t('jobs.select_job')}</h3>
                        <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90">
                            <X size={14} />
                        </button>
                    </div>

                    {/* Ultra Compact Grid Layout - Left Aligned */}
                    <div className="flex flex-col gap-1.5">
                        {/* Tanks */}
                        <div className="flex gap-1 flex-wrap justify-start pl-1">
                            {tanks.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} theme={theme} />
                            ))}
                        </div>

                        {/* Healers */}
                        <div className="flex gap-1 flex-wrap justify-start pl-1 border-t border-app-border pt-1.5">
                            {healers.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} theme={theme} />
                            ))}
                        </div>

                        {/* DPS */}
                        <div className="flex gap-1 flex-wrap justify-start pl-1 border-t border-app-border pt-1.5">
                            {melee.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} theme={theme} />
                            ))}
                            {physRanged.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} theme={theme} />
                            ))}
                            {magicRanged.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} theme={theme} />
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const JobButton: React.FC<{ job: any, currentJobId: string | null, onSelect: () => void, contentLanguage: ContentLanguage, theme: 'light' | 'dark' }> = ({ job, currentJobId, onSelect, contentLanguage }) => (
    <button
        onClick={onSelect}
        className={clsx(
            "flex flex-col items-center justify-center w-9 h-9 rounded border transition-all duration-200 relative overflow-hidden group cursor-pointer",
            currentJobId === job.id
                ? "bg-white/15 border-white/40 ring-1 ring-white/30 dark:bg-white/15 dark:border-white/40 dark:ring-white/30"
                : "bg-transparent border-app-border hover:scale-110 hover:border-app-text-muted"
        )}
    >
        <Tooltip content={getPhaseName(job.name, contentLanguage)}>
            <img src={job.icon} alt={getPhaseName(job.name, contentLanguage)} className="w-6 h-6 object-contain drop-shadow-md z-10" />
        </Tooltip>
    </button>
);
