import React from 'react';
import { JOBS } from '../data/mockData';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface JobPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (jobId: string) => void;
    position: { x: number; y: number };
    currentJobId: string | null;
}

import { useThemeStore } from '../store/useThemeStore';

export const JobPicker: React.FC<JobPickerProps> = ({ isOpen, onClose, onSelect, position, currentJobId }) => {
    const { contentLanguage } = useThemeStore();

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
                    className="pointer-events-auto glass-panel rounded-xl shadow-2xl p-2 w-[220px] flex flex-col gap-2 absolute ring-1 ring-white/5 z-[100]"
                    style={{
                        left: Math.min(position.x, window.innerWidth - 240),
                        top: Math.min(position.y + 10, window.innerHeight - 300)
                    }}
                >
                    <div className="flex justify-between items-center border-b border-white/[0.03] pb-1.5 px-1">
                        <h3 className="font-bold text-app-text-primary text-xs tracking-wide">Select Job</h3>
                        <button onClick={onClose} className="text-app-text-muted hover:text-white transition-colors">
                            <X size={14} />
                        </button>
                    </div>

                    {/* Ultra Compact Grid Layout - Left Aligned */}
                    <div className="flex flex-col gap-1.5">
                        {/* Tanks */}
                        <div className="flex gap-1 flex-wrap justify-start pl-1">
                            {tanks.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} />
                            ))}
                        </div>

                        {/* Healers */}
                        <div className="flex gap-1 flex-wrap justify-start pl-1 border-t border-white/[0.05] pt-1.5">
                            {healers.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} />
                            ))}
                        </div>

                        {/* DPS */}
                        <div className="flex gap-1 flex-wrap justify-start pl-1 border-t border-white/[0.05] pt-1.5">
                            {melee.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} />
                            ))}
                            {physRanged.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} />
                            ))}
                            {magicRanged.map(job => (
                                <JobButton key={job.id} job={job} currentJobId={currentJobId} onSelect={() => onSelect(job.id)} contentLanguage={contentLanguage} />
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const JobButton: React.FC<{ job: any, currentJobId: string | null, onSelect: () => void, contentLanguage: 'ja' | 'en' }> = ({ job, currentJobId, onSelect, contentLanguage }) => (
    <button
        onClick={onSelect}
        className={clsx(
            "flex flex-col items-center justify-center w-9 h-9 rounded border transition-all hover:scale-105 relative overflow-hidden group",
            currentJobId === job.id
                ? "bg-blue-500/20 border-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/30"
                : "bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.08]"
        )}
        title={contentLanguage === 'en' && job.nameEn ? job.nameEn : job.name}
    >
        <img src={job.icon} alt={contentLanguage === 'en' && job.nameEn ? job.nameEn : job.name} className="w-6 h-6 object-contain drop-shadow-md z-10" />
    </button>
);
