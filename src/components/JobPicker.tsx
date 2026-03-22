import React from 'react';
import { JOBS } from '../data/mockData';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from './ui/Tooltip';

interface JobPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (jobId: string) => void;
    position: { x: number; y: number };
    currentJobId: string | null;
}

import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';

export const JobPicker: React.FC<JobPickerProps> = ({ isOpen, onClose, onSelect, position, currentJobId }) => {
    const { t } = useTranslation();
    const { contentLanguage, theme } = useThemeStore();

    if (!isOpen) return null;

    // Group jobs by role
    const tanks = JOBS.filter(j => j.role === 'tank');
    const healers = JOBS.filter(j => j.role === 'healer');

    // Split DPS
    // Melee: mnk, drg, nin, sam, rpr, vpr
    const melee = JOBS.filter(j => ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].includes(j.id));
    // Phys Ranged: brd, mch, dnc
    const physRanged = JOBS.filter(j => ['brd', 'mch', 'dnc'].includes(j.id));
    // Magic Ranged: blm, smn, rdm, pct, blu
    const magicRanged = JOBS.filter(j => ['blm', 'smn', 'rdm', 'pct'].includes(j.id));

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-start justify-start pointer-events-none">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/20 pointer-events-auto"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="pointer-events-auto glass-panel rounded-xl shadow-sm p-2 w-[220px] flex flex-col gap-2 absolute ring-1 ring-white/5 z-[100]"
                    style={{
                        left: Math.min(position.x, window.innerWidth - 240),
                        top: Math.min(position.y + 10, window.innerHeight - 300)
                    }}
                >
                    <div className="flex justify-between items-center border-b border-white/[0.03] pb-1.5 px-1">
                        <h3 className="font-bold text-app-text-primary text-xs tracking-wide">{t('jobs.select_job')}</h3>
                        <button onClick={onClose} className="text-app-text-muted hover:text-slate-800 dark:text-white transition-colors cursor-pointer">
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
                        <div className="flex gap-1 flex-wrap justify-start pl-1 border-t border-white/[0.05] pt-1.5">
                            {healers.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} theme={theme} />
                            ))}
                        </div>

                        {/* DPS */}
                        <div className="flex gap-1 flex-wrap justify-start pl-1 border-t border-white/[0.05] pt-1.5">
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

const JobButton: React.FC<{ job: any, currentJobId: string | null, onSelect: () => void, contentLanguage: 'ja' | 'en', theme: 'light' | 'dark' }> = ({ job, currentJobId, onSelect, contentLanguage, theme }) => (
    <button
        onClick={onSelect}
        className={clsx(
            "flex flex-col items-center justify-center w-9 h-9 rounded border transition-all relative overflow-hidden group cursor-pointer",
            currentJobId === job.id
                ? "bg-blue-500/30 border-blue-500/60 shadow-[0_0_12px_rgba(59,130,246,0.4)] ring-1 ring-blue-500/40"
                : clsx(
                    "transition-all duration-200 hover:scale-110",
                    theme === 'dark'
                        ? "bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.1] hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                        : "bg-black/[0.03] border-black/[0.05] hover:bg-blue-500/[0.08] hover:border-blue-500/30 hover:shadow-[0_4px_12px_rgba(59,130,246,0.15)]"
                )
        )}
    >
        <Tooltip content={contentLanguage === 'en' ? job.name.en : job.name.ja}>
            <img src={job.icon} alt={contentLanguage === 'en' ? job.name.en : job.name.ja} className="w-6 h-6 object-contain drop-shadow-md z-10" />
        </Tooltip>
    </button>
);
